-- Attach these orders after all migrations, as exercised by a later provider retry.
begin;
insert into public.orders (invitation_id, owner_id, template_id, amount_paise, gateway_order_id, status)
select id, owner_id, template_id, 89900, 'order_Upgrade' || right(id::text, 1), 'test_created'
from public.invitations where left(id::text, 8) = 'c6100000' and right(id::text, 1) in ('1','2');
commit;

begin;
set local role service_role;
do $$
begin
  if (select count(*) from public.payment_events where outcome = 'legacy_unbound') <> 2
    or exists (select 1 from public.get_test_publication('upgrade-historic'))
    or not exists (select 1 from public.orders where gateway_order_id = 'order_Upgrade3'
      and status = 'test_verified' and gateway_payment_id = 'pay_Upgrade3'
      and verified_at is not null and test_entitlement = 'unconfirmed')
  then raise exception 'Migration changed capture history or failed to classify old receipts'; end if;

  if public.record_razorpay_test_payment('order_Upgrade1','pay_Upgrade1',89900,'INR',
    'captured',null,'evt_upgrade_1',repeat('a',64)) <> 'verified'
    or public.record_razorpay_test_payment('order_Upgrade1','pay_Upgrade1',89900,'INR',
      'captured',null,'evt_upgrade_1',repeat('a',64)) <> 'duplicate'
    or public.record_razorpay_test_payment('order_Upgrade2','pay_Upgrade2',1,'USD',
      'captured',null,'evt_upgrade_2',repeat('b',64)) <> 'ignored'
    or public.record_razorpay_test_payment('order_Upgrade3','pay_Upgrade3',89900,'INR',
      'captured',null,'evt_upgrade_3',repeat('c',64)) <> 'duplicate'
  then raise exception 'Valid legacy replay did not fulfil exactly once or a bad retry was accepted'; end if;

  if (select count(*) from public.payment_events where gateway_event_id = 'evt_upgrade_1'
    and outcome = 'verified' and order_id is not null) <> 1
    or not exists (select 1 from public.orders where gateway_order_id = 'order_Upgrade1'
      and test_verification_source = 'webhook' and test_entitlement = 'active')
    or not exists (select 1 from public.orders where gateway_order_id = 'order_Upgrade2'
      and status = 'test_created' and test_entitlement is null)
  then raise exception 'Legacy replay did not preserve the trusted order boundary'; end if;

  if public.record_razorpay_test_payment('order_Upgrade3','pay_Upgrade3',89900,'INR',
    'captured','c6000000-0000-4000-8000-000000000001',null) <> 'verified'
  then raise exception 'Historic, unconfirmed receipt could not recover'; end if;
  if not exists (select 1 from public.get_test_publication('upgrade-historic'))
  then raise exception 'Historic, unconfirmed receipt could not recover its original share link'; end if;

end $$;
set local role anon;
do $$ begin
  if not exists (select 1 from public.get_published_invitation('upgrade-legacy-4')
    where data #>> '{coverImage,alt}' = 'Bundled test cover'
      and data #> '{coverImage,focalPosition,x}' = '0.25'::jsonb)
    or (select count(*) from generate_series(5,7) as n
      cross join lateral public.get_published_invitation('upgrade-legacy-' || n) p
      where not (p.data ? 'coverImage')) <> 3
  then raise exception 'Legacy cover allowlist did not preserve approved cover and fallbacks'; end if;
end $$;
rollback;
