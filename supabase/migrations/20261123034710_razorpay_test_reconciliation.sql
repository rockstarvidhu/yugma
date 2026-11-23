-- Use the existing Afterglow sandbox price without overriding an active catalogue entry.
update public.templates
set status = 'active', price_in_paise = coalesce(price_in_paise, 89900)
where registry_key = 'afterglow' and status = 'demo';

alter table public.orders
  drop constraint orders_status_check,
  alter column gateway_order_id drop not null,
  add constraint orders_status_check check (
    status in ('created', 'captured', 'failed', 'cancelled', 'refunded',
      'test_reserving', 'test_created', 'test_failed', 'test_processing', 'test_verified')
  ),
  add column reservation_token uuid,
  add column reservation_expires_at timestamptz,
  add column last_failed_at timestamptz,
  add column processing_at timestamptz,
  add constraint orders_reservation_check check (
    (status = 'test_reserving' and gateway_order_id is null
      and reservation_token is not null and reservation_expires_at is not null)
    or (status <> 'test_reserving' and gateway_order_id is not null
      and reservation_token is null and reservation_expires_at is null)
  ),
  add constraint orders_test_attempt_check check (
    (status <> 'test_failed' or (gateway_payment_id is not null and last_failed_at is not null))
    and (status <> 'test_processing' or (gateway_payment_id is not null and processing_at is not null))
  );

drop index public.orders_one_test_checkout_idx;
create unique index orders_one_test_checkout_idx on public.orders (invitation_id)
  where status in ('test_reserving', 'test_created', 'test_failed', 'test_processing', 'test_verified');

create function yugma_private.protect_test_order_snapshot()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if starts_with(old.status, 'test_') then
    if not starts_with(new.status, 'test_')
      or row(new.id, new.invitation_id, new.owner_id, new.template_id, new.amount_paise,
        new.currency, new.created_at)
      is distinct from row(old.id, old.invitation_id, old.owner_id, old.template_id,
        old.amount_paise, old.currency, old.created_at)
      or (old.status = 'test_reserving' and new.status not in ('test_reserving', 'test_created'))
      or (old.gateway_order_id is distinct from new.gateway_order_id
        and not (old.status = 'test_reserving' and new.status = 'test_created'))
      or (old.status = 'test_verified' and row(new.status, new.gateway_payment_id, new.verified_at)
        is distinct from row(old.status, old.gateway_payment_id, old.verified_at))
    then
      raise exception 'Test order binding and verified capture are immutable' using errcode = '23514';
    end if;
  elsif starts_with(new.status, 'test_') then
    raise exception 'Order mode is immutable' using errcode = '23514';
  end if;
  return new;
end;
$$;

revoke all on function yugma_private.protect_test_order_snapshot() from public, anon, authenticated;
create trigger protect_test_order_snapshot before update on public.orders
for each row execute function yugma_private.protect_test_order_snapshot();

create function public.reserve_razorpay_test_order(p_owner_id uuid, p_invitation_id uuid)
returns table (id uuid, amount_paise integer, currency text, reservation_token uuid, recovering boolean)
language plpgsql
set search_path = ''
as $$
declare
  claim uuid := gen_random_uuid();
  expires_at timestamptz := statement_timestamp() + interval '45 seconds';
begin
  return query
    insert into public.orders as o (
      invitation_id, owner_id, template_id, amount_paise, currency, status,
      reservation_token, reservation_expires_at
    )
    select i.id, i.owner_id, i.template_id, t.price_in_paise, t.currency, 'test_reserving',
      claim, expires_at
    from public.invitations as i
    join public.templates as t on t.id = i.template_id
    where i.id = p_invitation_id and i.owner_id = p_owner_id and i.status = 'draft'
      and t.registry_key = 'afterglow' and t.draft_eligible and t.status = 'active'
      and t.price_in_paise >= 100 and t.currency = 'INR'
    on conflict (invitation_id)
      where status in ('test_reserving', 'test_created', 'test_failed', 'test_processing', 'test_verified')
      do nothing
    returning o.id, o.amount_paise, o.currency, o.reservation_token, false;
  if found then return; end if;

  return query
    update public.orders as o
    set reservation_token = claim, reservation_expires_at = expires_at
    from public.invitations as i
    join public.templates as t on t.id = i.template_id
    where o.invitation_id = p_invitation_id and o.owner_id = p_owner_id
      and o.status = 'test_reserving' and o.reservation_expires_at <= statement_timestamp()
      and i.id = o.invitation_id and i.status = 'draft'
      and t.registry_key = 'afterglow' and t.draft_eligible and t.status = 'active'
    returning o.id, o.amount_paise, o.currency, o.reservation_token, true;
end;
$$;

revoke all on function public.reserve_razorpay_test_order(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.reserve_razorpay_test_order(uuid, uuid)
  to service_role;

create function public.record_razorpay_test_payment(
  p_order_id text, p_payment_id text, p_amount integer, p_currency text,
  p_status text, p_owner_id uuid, p_event_id text
)
returns text
language plpgsql
set search_path = ''
as $$
declare
  test_order public.orders%rowtype;
  outcome text := 'ignored';
begin
  if (p_owner_id is null) = (p_event_id is null)
    or p_status is null or p_status not in ('authorized', 'captured', 'failed')
    or p_payment_id is null or p_amount is null or p_currency is null
  then
    raise exception 'Invalid verified payment source or evidence' using errcode = '22023';
  end if;

  select * into test_order from public.orders
  where gateway_order_id = p_order_id
    and status in ('test_created', 'test_failed', 'test_processing', 'test_verified')
    and (p_owner_id is null or owner_id = p_owner_id)
  for update;

  -- Event dedupe and the order transition commit in the same transaction.
  if p_event_id is not null then
    insert into public.payment_events (gateway_event_id, order_id, verified_source)
    values (p_event_id, test_order.id, 'webhook')
    on conflict (gateway_event_id) do nothing;
    if not found then return 'duplicate'; end if;
  end if;

  if test_order.id is not null
    and test_order.amount_paise = p_amount and test_order.currency = p_currency
  then
    if test_order.status = 'test_verified' then
      if test_order.gateway_payment_id = p_payment_id then outcome := 'verified'; end if;
    elsif p_status = 'captured' then
      update public.orders set status = 'test_verified', gateway_payment_id = p_payment_id,
        verified_at = statement_timestamp()
      where id = test_order.id;
      outcome := 'verified';
    elsif p_status = 'failed' and (
      test_order.status = 'test_created'
      or (test_order.status = 'test_failed' and test_order.gateway_payment_id <> p_payment_id)
      or (test_order.status = 'test_processing' and test_order.gateway_payment_id = p_payment_id)
    ) then
      update public.orders set status = 'test_failed', gateway_payment_id = p_payment_id,
        last_failed_at = statement_timestamp()
      where id = test_order.id;
      outcome := 'failed';
    elsif p_status = 'authorized' and (
      test_order.status = 'test_created'
      or (test_order.status = 'test_failed' and test_order.gateway_payment_id <> p_payment_id)
    ) then
      update public.orders set status = 'test_processing', gateway_payment_id = p_payment_id,
        processing_at = statement_timestamp()
      where id = test_order.id;
      outcome := 'processing';
    elsif test_order.status in ('test_failed', 'test_processing') then
      outcome := case test_order.status when 'test_failed' then 'failed' else 'processing' end;
    end if;
  end if;

  if p_event_id is not null then
    update public.payment_events set processed_at = clock_timestamp()
    where gateway_event_id = p_event_id;
  end if;
  return outcome;
end;
$$;

revoke all on function public.record_razorpay_test_payment(text, text, integer, text, text, uuid, text)
  from public, anon, authenticated;
grant execute on function public.record_razorpay_test_payment(text, text, integer, text, text, uuid, text)
  to service_role;
