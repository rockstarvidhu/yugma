begin;
insert into auth.users (id) values
  ('c1000000-0000-4000-8000-000000000001'), ('c1000000-0000-4000-8000-000000000002');
insert into public.invitations (id, owner_id, template_id, data)
select draft_id, 'c1000000-0000-4000-8000-000000000001', id, payload
from public.templates cross join (values
  ('c2000000-0000-4000-8000-000000000001'::uuid, '{
    "couple":{"partnerOne":"Asha","partnerTwo":"Neel","email":"private@example.test"},
    "timeZone":"Asia/Kolkata","welcomeNote":{"email":"private@example.test"},"hosts":["Host",{"email":"private@example.test"}],"privateNote":"private","gallery":[{"src":"https://example.test/private"}],
    "events":[{"id":"welcome","title":"Welcome","startsAt":"2028-01-01T13:00:00+05:30",
      "venue":{"name":"Garden","address":"Fictional Lane","mapsUrl":"https://maps.example.test/place","object_key":"private"},
      "privateNotes":"private"},
      {"id":"wedding","title":"Wedding","startsAt":"2028-01-02T13:00:00+05:30",
      "venue":{"name":"Hall","address":"Fictional Lane","mapsUrl":"https://user:password@example.test/place"}}]
  }'::jsonb),
  ('c2000000-0000-4000-8000-000000000002'::uuid,
    '{"coverImage":{"src":"https://unapproved.example.test/candidate","alt":"Cover"}}'::jsonb)
) values_for_draft(draft_id, payload) where registry_key = 'afterglow';
insert into public.orders (invitation_id, owner_id, template_id, amount_paise, gateway_order_id, status)
  select id, owner_id, template_id, 89900, case right(id::text, 1) when '1' then 'order_One' else 'order_Two' end,
    'test_created' from public.invitations where owner_id = 'c1000000-0000-4000-8000-000000000001';

create function yugma_private.fail_fixture_event_outcome() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.gateway_event_id = 'evt_fixture_write_failure' then raise sqlstate 'P9002'; end if;
  return new;
end $$;
create trigger fail_fixture_event_outcome before update on public.payment_events
  for each row execute function yugma_private.fail_fixture_event_outcome();

set local role authenticated;
do $$ begin
  if has_function_privilege('public.claim_razorpay_test_reconciliation(uuid,uuid)', 'EXECUTE')
    or has_function_privilege('public.record_razorpay_test_payment(text,text,integer,text,text,uuid,text,text,timestamptz)', 'EXECUTE')
    or has_table_privilege('public.orders', 'UPDATE') or has_table_privilege('public.payment_events', 'INSERT')
    then raise exception 'Authenticated actor can grant entitlement'; end if;
end $$;
set local role service_role;
do $$
declare
  owner_id constant uuid := 'c1000000-0000-4000-8000-000000000001';
  stranger constant uuid := 'c1000000-0000-4000-8000-000000000002';
  one constant uuid := 'c2000000-0000-4000-8000-000000000001';
  two constant uuid := 'c2000000-0000-4000-8000-000000000002';
  receipt uuid;
  guest jsonb;
begin
  select id into strict receipt from public.orders where gateway_order_id = 'order_One';
  if public.claim_razorpay_test_reconciliation(stranger, receipt)
    or not public.claim_razorpay_test_reconciliation(owner_id, receipt)
    or public.claim_razorpay_test_reconciliation(owner_id, receipt)
  then raise exception 'Reconciliation lease failed'; end if;

  if public.record_razorpay_test_payment('order_One','pay_One',89900,'INR','captured',stranger,null) <> 'ignored'
    or public.record_razorpay_test_payment('order_One','pay_One',1,'INR','captured',null,'evt_underpaid',repeat('1',64)) <> 'ignored'
    or public.record_razorpay_test_payment('order_One','pay_One',89900,'USD','captured',null,'evt_currency',repeat('2',64)) <> 'ignored'
    or public.record_razorpay_test_payment('order_One','pay_One',89900,'INR','failed',null,'evt_failed',repeat('3',64)) <> 'failed'
    or public.publish_test_invitation(owner_id,one,1,'Invitation','verified-fixture') <> 'unpaid'
  then raise exception 'Bad evidence changed the payment boundary'; end if;

  begin
    if public.record_razorpay_test_payment('order_One','pay_One',89900,'INR','captured',null,'evt_capture',repeat('a',64)) <> 'verified'
      then raise exception 'Capture failed before rollback test'; end if;
    raise sqlstate 'P9001';
  exception when sqlstate 'P9001' then null;
  end;
  if exists (select 1 from public.payment_events where gateway_event_id = 'evt_capture')
    or exists (select 1 from public.orders where id = receipt and status = 'test_verified')
  then raise exception 'Rollback did not undo the entitlement and event together'; end if;

  begin
    perform public.record_razorpay_test_payment('order_One','pay_One',89900,'INR','captured',
      null,'evt_fixture_write_failure',repeat('5',64));
    raise exception 'Injected event write did not fail';
  exception when sqlstate 'P9002' then null;
  end;
  if exists (select 1 from public.payment_events where gateway_event_id = 'evt_fixture_write_failure')
    or exists (select 1 from public.orders where id = receipt and status = 'test_verified')
  then raise exception 'A failed event write left a partial capture'; end if;

  if public.record_razorpay_test_payment('order_One','pay_One',89900,'INR','captured',null,'evt_capture',repeat('a',64)) <> 'verified'
    or public.record_razorpay_test_payment('order_One','pay_One',89900,'INR','captured',null,'evt_capture',repeat('a',64)) <> 'duplicate'
    or public.record_razorpay_test_payment('order_One','pay_One',89900,'INR','captured',null,'evt_replay',repeat('a',64)) <> 'duplicate'
    or public.record_razorpay_test_payment('order_One','pay_Stale',89900,'INR','failed',null,'evt_stale',repeat('b',64)) <> 'ignored'
    or public.record_razorpay_test_payment('order_Two','pay_One',89900,'INR','captured',null,'evt_conflict',repeat('c',64)) <> 'ignored'
  then raise exception 'Retry, replay, or conflicting provider ID was mishandled'; end if;

  if not exists (select 1 from public.payment_events where gateway_event_id='evt_capture'
    and outcome='verified' and processed_at is not null)
    or not exists (select 1 from public.payment_events where gateway_event_id='evt_conflict' and outcome='ignored')
    or not exists (select 1 from public.orders where id=receipt and status='test_verified'
      and test_verification_source='webhook' and gateway_payment_id='pay_One')
    or exists (select 1 from public.get_test_publication('verified-fixture'))
    or public.claim_razorpay_test_reconciliation(owner_id, receipt)
  then raise exception 'Missing durable metadata or private state changed before publish'; end if;

  if public.publish_test_invitation(owner_id,two,1,'Invitation','unapproved-cover') <> 'unpaid'
    or public.record_razorpay_test_payment('order_Two','pay_Two',89900,'INR','captured',owner_id,null) <> 'verified'
    or public.publish_test_invitation(owner_id,two,1,'Invitation','unapproved-cover') <> 'invalid_media'
    or public.publish_test_invitation(owner_id,one,1,'Invitation','verified-fixture') <> 'published'
  then raise exception 'Publication excluded required payment or media check'; end if;

  select data into strict guest from public.get_test_publication('verified-fixture');
  if guest ?| array['privateNote','gallery','coverImage','welcomeNote'] or guest #> '{couple,email}' is not null
    or guest -> 'hosts' is distinct from '["Host"]'::jsonb
    or guest #> '{events,0,privateNotes}' is not null or guest #> '{events,0,venue,object_key}' is not null
    or guest #>> '{events,0,venue,mapsUrl}' is distinct from 'https://maps.example.test/place'
    or guest #> '{events,1,venue,mapsUrl}' is not null
  then raise exception 'Explicit guest projection is incomplete'; end if;
end $$;
rollback;
