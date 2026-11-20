alter table public.orders
  drop constraint orders_status_check,
  add constraint orders_status_check check (
    status in ('created', 'captured', 'failed', 'cancelled', 'refunded', 'test_created', 'test_verified')
  ),
  add constraint orders_test_verification_check check (
    status <> 'test_verified' or (gateway_payment_id is not null and verified_at is not null)
  );

-- A test receipt has its own lifecycle. The paid/published guards continue to
-- require a captured order, which is a separate status from a test verification.
create unique index orders_one_test_checkout_idx
  on public.orders (invitation_id)
  where status in ('test_created', 'test_verified');
