-- Only the verified funding attempt controls purchase entitlement. Store other
-- attempts for reconciliation without transferring their financial holds.
create table yugma_private.razorpay_test_attempts (
  gateway_payment_id text primary key,
  order_id uuid not null references public.orders(id) on delete cascade,
  provider_state text check (provider_state in ('authorized', 'failed', 'captured')),
  checked_at timestamptz,
  capture_verified_at timestamptz,
  financial_hold text check (financial_hold in ('suspended', 'revoked')),
  financial_hold_at timestamptz,
  check ((capture_verified_at is not null) = (provider_state is not distinct from 'captured')),
  check ((financial_hold_at is null) = (financial_hold is null))
);
create index razorpay_test_attempts_order_idx on yugma_private.razorpay_test_attempts(order_id);
alter table yugma_private.razorpay_test_attempts enable row level security;
revoke all on yugma_private.razorpay_test_attempts from public, anon, authenticated, service_role;
grant select, insert, update on yugma_private.razorpay_test_attempts to service_role;

alter table public.orders
  add column test_capture_conflict_at timestamptz,
  add column test_legacy_entitlement_hold boolean not null default false;
alter table public.payment_events add column gateway_payment_id text;

-- The previous schema did not record the payment ID on refund/dispute events.
-- Keep old holds in force for operator review. A saved order payment ID does
-- not prove which payment generated an earlier financial notification.
update public.orders set test_legacy_entitlement_hold = true
  where test_entitlement in ('suspended', 'revoked');

insert into yugma_private.razorpay_test_attempts(
  gateway_payment_id, order_id, provider_state, checked_at, capture_verified_at
)
select gateway_payment_id, id, case status
  when 'test_verified' then 'captured' when 'test_processing' then 'authorized' else 'failed' end,
  coalesce(test_attempt_checked_at, verified_at, processing_at, last_failed_at, created_at),
  case when status = 'test_verified' then verified_at end
from public.orders
where gateway_payment_id is not null
  and status in ('test_verified', 'test_processing', 'test_failed');

create or replace function public.record_razorpay_test_payment(
  p_order_id text, p_payment_id text, p_amount integer, p_currency text,
  p_status text, p_owner_id uuid, p_event_id text, p_request_sha256 text default null,
  p_checked_at timestamptz default null
) returns text language plpgsql set search_path = '' as $$
declare
  test_order public.orders%rowtype;
  target_invitation uuid;
  attempt yugma_private.razorpay_test_attempts%rowtype;
  unresolved_id text;
  observed_at timestamptz := coalesce(p_checked_at, statement_timestamp());
  result_state text := 'ignored';
begin
  if (p_owner_id is null) = (p_event_id is null)
    or p_status is null or p_status not in (
      'authorized', 'captured', 'failed', 'ignored', 'suspended', 'revoked', 'pending_review'
    )
    or p_payment_id is null or char_length(p_payment_id) not between 1 and 80
    or p_amount is null or p_currency is null
    or (p_event_id is not null and p_event_id !~ '^[A-Za-z0-9_-]{1,128}$')
    or (p_request_sha256 is not null and (p_event_id is null or p_request_sha256 !~ '^[0-9a-f]{64}$'))
  then
    raise exception 'Invalid verified payment source or evidence' using errcode = '22023';
  end if;

  select o.invitation_id into target_invitation from public.orders o
  where o.gateway_order_id = p_order_id
    and (p_owner_id is null or o.owner_id = p_owner_id)
    and o.status in ('test_created', 'test_failed', 'test_processing', 'test_verified');

  -- Lock invitations before orders. Publication and versioned saves use the same invitation lock.
  perform 1 from public.invitations i
  where i.id = target_invitation and i.status in ('draft', 'published', 'revoked')
  for update;
  if found then
    select o.* into test_order from public.orders o
    join public.invitations i on (i.id, i.owner_id, i.template_id) = (o.invitation_id, o.owner_id, o.template_id)
    join public.templates t on t.id = o.template_id
    where o.invitation_id = target_invitation and o.gateway_order_id = p_order_id
      and (p_owner_id is null or o.owner_id = p_owner_id)
      and t.registry_key = 'afterglow'
      and o.status in ('test_created', 'test_failed', 'test_processing', 'test_verified')
      and (i.status = 'draft' or o.status = 'test_verified')
    for update of o;
  end if;

  if test_order.id is null and p_event_id is not null and p_order_id is not null and p_status <> 'ignored' then
    return 'retry';
  end if;

  -- Event identity and the order transition commit in the same transaction.
  -- Only classified legacy rows and explicitly deferred verification are resumable.
  if p_event_id is not null then
    insert into public.payment_events (gateway_event_id, order_id, verified_source, request_sha256, gateway_payment_id)
    values (p_event_id, test_order.id, 'webhook', p_request_sha256, p_payment_id)
    on conflict do nothing;
    if not found then
      update public.payment_events set order_id = test_order.id, request_sha256 = p_request_sha256,
        gateway_payment_id = p_payment_id
      where gateway_event_id = p_event_id and test_order.id is not null and (
        (outcome = 'legacy_unbound' and order_id is null and request_sha256 is null)
        or (outcome = 'awaiting_verification' and order_id = test_order.id
          and request_sha256 = p_request_sha256
          and (gateway_payment_id is null or gateway_payment_id = p_payment_id))
      );
      if not found then return 'duplicate'; end if;
    end if;
  end if;

  if p_status <> 'ignored' and test_order.id is not null
    and test_order.amount_paise = p_amount and test_order.currency = p_currency
    and not exists (select 1 from public.orders
      where gateway_payment_id = p_payment_id and id <> test_order.id)
  then
    insert into yugma_private.razorpay_test_attempts (gateway_payment_id, order_id)
      values (p_payment_id, test_order.id) on conflict do nothing;
    select * into attempt from yugma_private.razorpay_test_attempts
      where gateway_payment_id = p_payment_id and order_id = test_order.id;
    if found then
      if p_status in ('pending_review', 'suspended', 'revoked') then
        update yugma_private.razorpay_test_attempts set financial_hold = case
          when financial_hold = 'revoked' or p_status = 'revoked' then 'revoked' else 'suspended'
        end, financial_hold_at = coalesce(financial_hold_at, statement_timestamp())
        where gateway_payment_id = p_payment_id returning * into attempt;

        if test_order.status = 'test_verified' and test_order.gateway_payment_id = p_payment_id then
          update public.orders set test_entitlement = case
            when test_entitlement = 'revoked' then 'revoked' else attempt.financial_hold end
          where id = test_order.id;
        end if;
        result_state := case when p_status = 'pending_review' then 'awaiting_verification'
          else attempt.financial_hold end;
      elsif p_status = 'captured' then
        update yugma_private.razorpay_test_attempts set provider_state = 'captured',
          capture_verified_at = coalesce(capture_verified_at, statement_timestamp())
        where gateway_payment_id = p_payment_id;
        if test_order.status = 'test_verified' and test_order.gateway_payment_id <> p_payment_id then
          -- Never replace the historical funding receipt. Conflicting captures
          -- need operator review. An already ineligible attempt is tracked
          -- but cannot change the legitimate funding payment.
          if attempt.financial_hold is null then
            update public.orders set
              test_capture_conflict_at = coalesce(test_capture_conflict_at, statement_timestamp()),
              test_entitlement = case when test_entitlement = 'revoked' then 'revoked' else 'suspended' end
            where id = test_order.id returning test_entitlement into result_state;
          else
            result_state := attempt.financial_hold;
          end if;
        elsif attempt.financial_hold is not null then
          -- A stale capture is still auditable, but this attempt cannot fund a purchase.
          result_state := attempt.financial_hold;
        elsif test_order.status = 'test_verified' then
          if test_order.test_entitlement = 'unconfirmed' and not test_order.test_legacy_entitlement_hold
            and test_order.test_capture_conflict_at is null
          then
            update public.orders set test_entitlement = 'active' where id = test_order.id;
            result_state := 'verified';
          else
            result_state := case test_order.test_entitlement when 'active' then 'verified'
              when 'revoked' then 'revoked' else 'suspended' end;
          end if;
        else
          update public.orders set status = 'test_verified', gateway_payment_id = p_payment_id,
            verified_at = statement_timestamp(),
            test_verification_source = case when p_event_id is null then 'owner_check' else 'webhook' end,
            test_entitlement = case when test_legacy_entitlement_hold then test_entitlement else 'active' end
          where id = test_order.id
          returning case test_entitlement when 'active' then 'verified' else test_entitlement end into result_state;
        end if;
      else
        update yugma_private.razorpay_test_attempts set provider_state = p_status, checked_at = observed_at
        where gateway_payment_id = p_payment_id and capture_verified_at is null
          and (checked_at is null or checked_at < observed_at
            or (checked_at = observed_at and (p_status = 'authorized' or provider_state <> 'authorized'
              or p_checked_at is null)));

        if test_order.status = 'test_verified' then
          if test_order.gateway_payment_id = p_payment_id then
            result_state := case test_order.test_entitlement when 'active' then 'verified'
              when 'revoked' then 'revoked' else 'suspended' end;
          end if;
        else
          select a.gateway_payment_id into unresolved_id from yugma_private.razorpay_test_attempts a
          where a.order_id = test_order.id and a.provider_state = 'authorized'
            and a.financial_hold is distinct from 'revoked'
          order by a.checked_at desc, a.gateway_payment_id collate "C" limit 1;
          if found then
            update public.orders set status = 'test_processing', gateway_payment_id = unresolved_id,
              processing_at = statement_timestamp()
            where id = test_order.id and (status <> 'test_processing' or gateway_payment_id <> unresolved_id);
            result_state := 'processing';
          elsif exists (select 1 from yugma_private.razorpay_test_attempts where gateway_payment_id = p_payment_id
            and provider_state = 'failed') then
            update public.orders set status = 'test_failed', gateway_payment_id = p_payment_id,
              last_failed_at = statement_timestamp()
            where id = test_order.id and (status <> 'test_failed' or gateway_payment_id <> p_payment_id);
            result_state := 'failed';
          else
            result_state := case test_order.status when 'test_failed' then 'failed'
              when 'test_processing' then 'processing' else 'ignored' end;
          end if;
        end if;
      end if;
    end if;
  end if;

  if p_event_id is not null then
    update public.payment_events set
      processed_at = case when result_state <> 'awaiting_verification' then clock_timestamp() end,
      outcome = result_state
    where gateway_event_id = p_event_id;
  end if;
  return result_state;
end;
$$;

revoke all on function public.record_razorpay_test_payment(text, text, integer, text, text, uuid, text, text, timestamptz)
  from public, anon, authenticated, service_role;
grant execute on function public.record_razorpay_test_payment(text, text, integer, text, text, uuid, text, text, timestamptz)
  to service_role;

-- Serialize the final retry decision with payment recording and publication.
create or replace function public.authorize_razorpay_test_checkout(
  p_owner_id uuid, p_id uuid, p_expected_payment_id text
) returns boolean language plpgsql set search_path = '' as $$
declare
  target_invitation uuid;
begin
  select o.invitation_id into target_invitation from public.orders o
  where o.id = p_id and o.owner_id = p_owner_id;
  perform 1 from public.invitations i
  where i.id = target_invitation and i.owner_id = p_owner_id and i.status = 'draft'
  for update;
  if not found then return false; end if;
  update public.orders o set test_checkout_started_at = statement_timestamp()
  where o.id = p_id and o.owner_id = p_owner_id and o.invitation_id = target_invitation
    and o.test_entitlement is null and o.gateway_order_id is not null
    and o.gateway_payment_id is not distinct from p_expected_payment_id
    and o.status = case when p_expected_payment_id is null then 'test_created' else 'test_failed' end
    and not exists (
      select 1 from yugma_private.razorpay_test_attempts a where a.order_id = o.id
        and (a.capture_verified_at is not null or a.financial_hold = 'suspended'
          or (a.provider_state = 'authorized' and a.financial_hold is distinct from 'revoked'))
    )
    and (o.test_checkout_started_at is null
      or o.last_failed_at > o.test_checkout_started_at
      or o.test_checkout_started_at <= statement_timestamp() - interval '15 seconds');
  return found;
end;
$$;
revoke all on function public.authorize_razorpay_test_checkout(uuid, uuid, text)
  from public, anon, authenticated, service_role;
grant execute on function public.authorize_razorpay_test_checkout(uuid, uuid, text)
  to service_role;

-- Evaluate one authoritative order snapshot under the same lock as webhooks.
-- Apply holds before captures, and sort equal-priority IDs deterministically.
-- If the snapshot contains multiple eligible captures, the transaction ends
-- suspended before publication can observe a partially reconciled result.
create function public.reconcile_razorpay_test_attempts(
  p_owner_id uuid, p_order_id text, p_attempts jsonb, p_checked_at timestamptz
) returns jsonb language plpgsql set search_path = '' as $$
declare
  target_invitation uuid;
  item record;
  result jsonb;
begin
  if p_owner_id is null or jsonb_typeof(p_attempts) is distinct from 'array' then
    raise exception 'Invalid provider attempt snapshot' using errcode = '22023';
  end if;
  if jsonb_array_length(p_attempts) not between 1 and 100 then
    raise exception 'Invalid provider attempt count' using errcode = '22023';
  end if;
  select invitation_id into target_invitation from public.orders
  where gateway_order_id = p_order_id and owner_id = p_owner_id;
  perform 1 from public.invitations where id = target_invitation and owner_id = p_owner_id for update;
  if not found then return null; end if;

  for item in
    select * from jsonb_to_recordset(p_attempts)
      as evidence(id text, order_id text, amount integer, currency text, status text)
    where order_id = p_order_id
    order by case status when 'revoked' then 0 when 'suspended' then 1 when 'failed' then 2
      when 'authorized' then 3 else 4 end, id collate "C"
  loop
    perform public.record_razorpay_test_payment(p_order_id, item.id, item.amount, item.currency,
      item.status, p_owner_id, null, null, p_checked_at);
  end loop;

  select jsonb_build_object('paymentId', o.gateway_payment_id, 'state', case
    when o.test_entitlement = 'revoked' then 'revoked'
    when o.test_entitlement in ('unconfirmed', 'suspended') then 'suspended'
    when o.status = 'test_verified' and o.test_entitlement = 'active' then 'verified'
    when o.status = 'test_failed' then 'failed'
    when o.status = 'test_processing' then 'processing'
    else 'pending' end) into result
  from public.orders o where o.gateway_order_id = p_order_id and o.owner_id = p_owner_id
    and o.invitation_id = target_invitation;
  return result;
end;
$$;
revoke all on function public.reconcile_razorpay_test_attempts(uuid, text, jsonb, timestamptz)
  from public, anon, authenticated, service_role;
grant execute on function public.reconcile_razorpay_test_attempts(uuid, text, jsonb, timestamptz)
  to service_role;
