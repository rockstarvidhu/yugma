begin;
insert into auth.users (id) values
  ('c7000000-0000-4000-8000-000000000001'), ('c7000000-0000-4000-8000-000000000002');
insert into public.invitations (id, owner_id, template_id, data)
select ('c7100000-0000-4000-8000-00000000000' || n)::uuid,
  'c7000000-0000-4000-8000-000000000001', t.id,
  '{"couple":{"partnerOne":"Asha","partnerTwo":"Neel"},"timeZone":"Asia/Kolkata"}'
from public.templates t cross join generate_series(1, 6) n where t.registry_key = 'afterglow';
insert into public.orders (invitation_id, owner_id, template_id, amount_paise, gateway_order_id, status)
select id, owner_id, template_id, 89900, 'order_Entitlement' || right(id::text, 1), 'test_created'
from public.invitations where left(id::text, 8) = 'c7100000';

set local role anon;
do $$ begin
  if has_function_privilege('public.get_test_publication(text)', 'EXECUTE')
    or has_function_privilege('public.record_razorpay_test_payment(text,text,integer,text,text,uuid,text,text,timestamptz)', 'EXECUTE')
  then raise exception 'Anonymous caller can access staging payment service RPCs'; end if;
end $$;
set local role authenticated;
do $$ begin
  if has_function_privilege('public.authorize_razorpay_test_checkout(uuid,uuid,text)', 'EXECUTE')
    or has_column_privilege('public.orders','test_entitlement','UPDATE')
    or has_function_privilege('public.record_razorpay_test_payment(text,text,integer,text,text,uuid,text,text,timestamptz)', 'EXECUTE')
  then raise exception 'Authenticated caller can mutate payment entitlement'; end if;
end $$;

set local role service_role;
do $$
declare
  owner_id constant uuid := 'c7000000-0000-4000-8000-000000000001';
  stranger constant uuid := 'c7000000-0000-4000-8000-000000000002';
  order_ref text;
  pay_ref text;
  target uuid;
  slug text;
  entitlement text;
  saved_at timestamptz;
  late_order uuid;
  n integer;
begin
  for n in 1..4 loop
    entitlement := case when n <= 2 then 'suspended' else 'revoked' end;
    target := ('c7100000-0000-4000-8000-00000000000' || n)::uuid;
    order_ref := 'order_Entitlement' || n;
    pay_ref := 'pay_Entitlement' || n;
    slug := 'refund-fixture-' || n;
    if public.record_razorpay_test_payment(order_ref,pay_ref,89900,'INR','captured',owner_id,null)
      <> 'verified' then raise exception 'Capture did not activate entitlement'; end if;
    select verified_at into strict saved_at from public.orders where gateway_order_id = order_ref;
    if n % 2 = 0 and public.publish_test_invitation(owner_id,target,1,'Wedding',slug) <> 'published'
    then raise exception 'Valid payment could not publish'; end if;
    if public.record_razorpay_test_payment(order_ref,pay_ref,89900,'INR',entitlement,stranger,null)
      <> 'ignored' then raise exception 'Wrong owner mutated entitlement'; end if;

    if public.record_razorpay_test_payment(order_ref,pay_ref,89900,'INR','pending_review',
      null,'evt_refund_' || n,repeat(n::text,64)) <> 'awaiting_verification'
    then raise exception 'Financial notification was not held for verification'; end if;
    if exists (select 1 from public.get_test_publication(slug))
      or not exists (select 1 from public.payment_events where gateway_event_id = 'evt_refund_' || n
        and processed_at is null and outcome = 'awaiting_verification')
    then raise exception 'Pending financial review did not immediately hide the guest projection'; end if;
    if public.record_razorpay_test_payment(order_ref,pay_ref,89900,'INR',entitlement,
      null,'evt_refund_' || n,repeat(n::text,64)) <> entitlement
      or public.record_razorpay_test_payment(order_ref,pay_ref,89900,'INR',entitlement,
        null,'evt_refund_' || n,repeat(n::text,64)) <> 'duplicate'
      or public.record_razorpay_test_payment(order_ref,pay_ref,89900,'INR','captured',owner_id,null)
        <> entitlement
    then raise exception 'Refund retry or stale capture changed entitlement'; end if;
    if public.publish_test_invitation(owner_id,target,1,'Wedding',slug) <> 'unpaid'
      or exists (select 1 from public.get_test_publication(slug))
      or not exists (select 1 from public.orders where gateway_order_id = order_ref
        and status = 'test_verified' and gateway_payment_id = pay_ref and verified_at = saved_at
        and test_entitlement = entitlement)
      or not exists (select 1 from public.invitations where id = target and data ? 'couple'
        and (n % 2 = 0 and share_slug = slug and status = 'published' or n % 2 = 1 and status = 'draft'))
    then raise exception 'Guest gate, immutable receipt, reserved slug or owner data was lost'; end if;
  end loop;

  select id into strict late_order from public.orders where gateway_order_id = 'order_Entitlement5';
  if public.record_razorpay_test_payment('order_Entitlement5','pay_Late',89900,'INR','failed',owner_id,null) <> 'failed'
    or public.record_razorpay_test_payment('order_Entitlement5','pay_Late',89900,'INR','authorized',owner_id,null) <> 'processing'
    or public.authorize_razorpay_test_checkout(owner_id, late_order, 'pay_Late')
  then raise exception 'Late authorization did not control retry'; end if;
  if not exists (select 1 from public.orders where id = late_order and test_entitlement is null)
    or public.record_razorpay_test_payment('order_Entitlement5','pay_Late',89900,'INR','failed',
      owner_id,null,null,statement_timestamp() - interval '1 minute') <> 'processing'
    or public.record_razorpay_test_payment('order_Entitlement5','pay_Late',89900,'INR','failed',owner_id,null) <> 'failed'
    or not public.authorize_razorpay_test_checkout(owner_id, late_order, 'pay_Late')
    or public.authorize_razorpay_test_checkout(owner_id, late_order, 'pay_Late')
    or public.record_razorpay_test_payment('order_Entitlement5','pay_Late',89900,'INR','captured',owner_id,null) <> 'verified'
    or public.authorize_razorpay_test_checkout(owner_id, late_order, 'pay_Late')
  then raise exception 'Late authorization, definitive failure, or capture did not control retry'; end if;

  if public.record_razorpay_test_payment('order_Entitlement6','pay_Ahead',89900,'INR','revoked',owner_id,null)
      <> 'revoked'
    or public.record_razorpay_test_payment('order_Entitlement6','pay_Ahead',89900,'INR','captured',owner_id,null)
      <> 'revoked'
  then raise exception 'Out-of-order refund and capture reactivated a held order'; end if;
end $$;
set local role anon;
do $$ begin
  if exists (select 1 from public.get_published_invitation('refund-fixture-2'))
    or exists (select 1 from public.get_published_invitation('refund-fixture-4'))
  then raise exception 'Legacy guest RPC exposed a suspended staging publication'; end if;
end $$;
rollback;
