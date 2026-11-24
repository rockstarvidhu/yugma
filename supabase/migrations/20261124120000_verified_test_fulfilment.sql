-- The single verified order continues to represent the invitation entitlement.
alter table public.orders
  add column test_reconciled_at timestamptz,
  add column test_verification_source text check (test_verification_source in ('owner_check', 'webhook'));

alter table public.payment_events
  add column request_sha256 text check (request_sha256 ~ '^[0-9a-f]{64}$'),
  add column outcome text check (outcome in ('verified', 'processing', 'failed', 'ignored'));
create unique index payment_events_request_sha256_idx on public.payment_events (request_sha256)
  where request_sha256 is not null;

create function public.claim_razorpay_test_reconciliation(p_owner_id uuid, p_id uuid)
returns boolean language sql set search_path = '' as $$
  with claimed as (
    update public.orders o
    set test_reconciled_at = statement_timestamp()
    where o.id = p_id and o.owner_id = p_owner_id
      and o.status in ('test_created', 'test_failed', 'test_processing')
      and (o.test_reconciled_at is null or o.test_reconciled_at <= statement_timestamp() - interval '15 seconds')
    returning 1
  )
  select exists (select 1 from claimed);
$$;

revoke all on function public.claim_razorpay_test_reconciliation(uuid, uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.claim_razorpay_test_reconciliation(uuid, uuid) to service_role;

drop function public.record_razorpay_test_payment(text, text, integer, text, text, uuid, text);
create function public.record_razorpay_test_payment(
  p_order_id text, p_payment_id text, p_amount integer, p_currency text,
  p_status text, p_owner_id uuid, p_event_id text, p_request_sha256 text default null
) returns text language plpgsql set search_path = '' as $$
declare
  test_order public.orders%rowtype;
  target_invitation uuid;
  result_state text := 'ignored';
begin
  if (p_owner_id is null) = (p_event_id is null)
    or p_status is null or p_status not in ('authorized', 'captured', 'failed', 'ignored')
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
  where i.id = target_invitation and i.status in ('draft', 'published')
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

  -- Event identity and the order transition commit in the same transaction.
  if p_event_id is not null then
    insert into public.payment_events (gateway_event_id, order_id, verified_source, request_sha256)
    values (p_event_id, test_order.id, 'webhook', p_request_sha256)
    on conflict do nothing;
    if not found then return 'duplicate'; end if;
  end if;

  begin
    if p_status <> 'ignored' and test_order.id is not null
      and test_order.amount_paise = p_amount and test_order.currency = p_currency
    then
      if test_order.status = 'test_verified' then
        if test_order.gateway_payment_id = p_payment_id then result_state := 'verified'; end if;
      elsif p_status = 'captured' then
        update public.orders set status = 'test_verified', gateway_payment_id = p_payment_id,
          verified_at = statement_timestamp(),
          test_verification_source = case when p_event_id is null then 'owner_check' else 'webhook' end
        where id = test_order.id;
        result_state := 'verified';
      elsif p_status = 'failed' and (
        test_order.status = 'test_created'
        or (test_order.status = 'test_failed' and test_order.gateway_payment_id <> p_payment_id)
        or (test_order.status = 'test_processing' and test_order.gateway_payment_id = p_payment_id)
      ) then
        update public.orders set status = 'test_failed', gateway_payment_id = p_payment_id,
          last_failed_at = statement_timestamp()
        where id = test_order.id;
        result_state := 'failed';
      elsif p_status = 'authorized' and (
        test_order.status = 'test_created'
        or (test_order.status = 'test_failed' and test_order.gateway_payment_id <> p_payment_id)
      ) then
        update public.orders set status = 'test_processing', gateway_payment_id = p_payment_id,
          processing_at = statement_timestamp()
        where id = test_order.id;
        result_state := 'processing';
      elsif test_order.status in ('test_failed', 'test_processing') then
        result_state := case test_order.status when 'test_failed' then 'failed' else 'processing' end;
      end if;
    end if;
  exception when unique_violation then
    -- The provider payment ID is already bound to another order.
    result_state := 'ignored';
  end;

  if p_event_id is not null then
    update public.payment_events set processed_at = clock_timestamp(), outcome = result_state
    where gateway_event_id = p_event_id;
  end if;
  return result_state;
end;
$$;

revoke all on function public.record_razorpay_test_payment(text, text, integer, text, text, uuid, text, text)
  from public, anon, authenticated, service_role;
grant execute on function public.record_razorpay_test_payment(text, text, integer, text, text, uuid, text, text)
  to service_role;
