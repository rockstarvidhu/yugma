-- Use the existing Afterglow sandbox price without overriding an active catalogue entry.
update public.templates
set status = 'active', price_in_paise = coalesce(price_in_paise, 89900)
where registry_key = 'afterglow' and status = 'demo';

alter table public.orders
  drop constraint orders_status_check,
  add constraint orders_status_check check (
    status in ('created', 'captured', 'failed', 'cancelled', 'refunded',
      'test_created', 'test_failed', 'test_processing', 'test_verified')
  ),
  add column last_failed_at timestamptz,
  add column processing_at timestamptz,
  add constraint orders_test_attempt_check check (
    (status <> 'test_failed' or (gateway_payment_id is not null and last_failed_at is not null))
    and (status <> 'test_processing' or (gateway_payment_id is not null and processing_at is not null))
  );

drop index public.orders_one_test_checkout_idx;
create unique index orders_one_test_checkout_idx on public.orders (invitation_id)
  where status in ('test_created', 'test_failed', 'test_processing', 'test_verified');

create function yugma_private.protect_test_order_snapshot()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if starts_with(old.status, 'test_') then
    if not starts_with(new.status, 'test_')
      or row(new.id, new.invitation_id, new.owner_id, new.template_id, new.amount_paise,
        new.currency, new.gateway_order_id, new.created_at)
      is distinct from row(old.id, old.invitation_id, old.owner_id, old.template_id,
        old.amount_paise, old.currency, old.gateway_order_id, old.created_at)
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
