-- Run with psql -v ON_ERROR_STOP=1 against a scratch database after the migration.
-- All fixtures are fictional and roll back at the end.
begin;

insert into auth.users (id)
values ('e1000000-0000-4000-8000-000000000001'), ('e1000000-0000-4000-8000-000000000002');

select set_config(
  'yugma.test_payload',
  '{"couple":{"partnerOne":"Tara","partnerTwo":"Neel"},"timeZone":"Asia/Kolkata","events":[{"id":"ceremony","title":"Ceremony","startsAt":"2027-12-12T10:00:00+05:30","venue":{"name":"Sample Venue","address":"Sample Lane","mapsUrl":"https://example.com/maps"}}]}',
  true
);

set local role authenticated;
select set_config('request.jwt.claim.sub', 'e1000000-0000-4000-8000-000000000001', true);
select set_config('request.jwt.claims', '{"sub":"e1000000-0000-4000-8000-000000000001","role":"authenticated"}', true);

do $$
begin
  begin
    insert into public.invitations (template_id, data)
      select id, current_setting('yugma.test_payload')::jsonb
      from public.templates where slug = 'afterglow';
    raise exception 'Authenticated role could insert a draft directly';
  exception when insufficient_privilege then null;
  end;
  if has_any_column_privilege('public.invitations', 'UPDATE')
    or has_any_column_privilege('public.invitations', 'INSERT')
    or has_table_privilege('public.invitations', 'DELETE')
    or has_function_privilege('public.create_private_draft(uuid,text,jsonb)', 'EXECUTE')
    or has_function_privilege('public.save_private_draft(uuid,uuid,integer,jsonb)', 'EXECUTE')
  then
    raise exception 'Authenticated role has a direct draft mutation grant';
  end if;
end;
$$;

reset role;
set local role service_role;
do $$
declare
  draft_id uuid;
  owner uuid := 'e1000000-0000-4000-8000-000000000001';
  other_owner uuid := 'e1000000-0000-4000-8000-000000000002';
  payload jsonb := current_setting('yugma.test_payload')::jsonb;
begin
  if not exists (select 1 from public.templates where slug = 'afterglow'
    and status = 'active' and price_in_paise = 89900 and draft_eligible) then
    raise exception 'Afterglow is missing the active Test Mode catalogue price';
  end if;
  insert into public.templates (slug, registry_key) values ('fixture-design', 'fixture-design');
  if exists (select 1 from public.create_private_draft(owner, 'fixture-design', payload)) then
    raise exception 'An ineligible template accepted a draft';
  end if;
  select id into strict draft_id from public.create_private_draft(owner, 'afterglow', payload);
  perform set_config('yugma.test_draft_id', draft_id::text, true);

  if exists (select 1 from public.save_private_draft(other_owner, draft_id, 1, payload)) then
    raise exception 'Save accepted a different owner';
  end if;
  if not exists (
    select 1 from public.save_private_draft(owner, draft_id, 1,
      payload || '{"welcomeNote":"Welcome to the fictional celebration"}')
    where version = 2 and data ? 'welcomeNote'
  ) then
    raise exception 'Current-version save failed to update the draft exactly once';
  end if;
  if exists (select 1 from public.save_private_draft(owner, draft_id, 1, payload)) then
    raise exception 'A stale version updated the draft';
  end if;
end;
$$;
reset role;

set local role authenticated;
do $$
declare
  draft_id uuid := current_setting('yugma.test_draft_id')::uuid;
begin
  if not exists (
    select 1 from public.invitations
    where id = draft_id and owner_id = auth.uid() and status = 'draft'
      and schema_version = 1 and version = 2 and data ? 'welcomeNote'
  ) then
    raise exception 'Owner could not read their saved draft';
  end if;

  begin
    update public.invitations set status = 'paid' where id = draft_id;
    raise exception 'Owner was able to mark their draft paid';
  exception when insufficient_privilege then null;
  end;

  begin
    update public.invitations
      set status = 'published', share_slug = 'owner-write', published_at = now()
      where id = draft_id;
    raise exception 'Owner was able to publish their draft';
  exception when insufficient_privilege then null;
  end;

  begin
    update public.invitations
      set owner_id = 'e1000000-0000-4000-8000-000000000002' where id = draft_id;
    raise exception 'Owner was able to reassign the draft';
  exception when insufficient_privilege then null;
  end;

  begin
    update public.templates set price_in_paise = 1 where slug = 'afterglow';
    raise exception 'Owner was able to change authoritative pricing';
  exception when insufficient_privilege then null;
  end;
end;
$$;

reset role;
set local role service_role;
insert into public.assets (invitation_id, owner_id, object_key, media_type, width, height, size_bytes)
values (
  current_setting('yugma.test_draft_id')::uuid, 'e1000000-0000-4000-8000-000000000001',
  'fictional-draft-asset', 'image/webp', 480, 720, 4096
);
reset role;

set local role authenticated;
do $$
begin
  if (select count(*) from public.assets) <> 1 then
    raise exception 'Owner could not read their asset metadata';
  end if;
end;
$$;

select set_config(
  'request.jwt.claims',
  '{"sub":"e1000000-0000-4000-8000-000000000001","role":"authenticated","is_anonymous":true}',
  true
);

do $$
begin
  if exists (select 1 from public.invitations) or exists (select 1 from public.assets) then
    raise exception 'A Supabase anonymous session could read drafts or assets';
  end if;
  begin
    insert into public.invitations (template_id, data)
      select id, current_setting('yugma.test_payload')::jsonb
      from public.templates where slug = 'afterglow';
    raise exception 'A Supabase anonymous session created a draft';
  exception when insufficient_privilege then null;
  end;
end;
$$;

select set_config('request.jwt.claim.sub', 'e1000000-0000-4000-8000-000000000002', true);
select set_config('request.jwt.claims', '{"sub":"e1000000-0000-4000-8000-000000000002","role":"authenticated"}', true);

do $$
begin
  if exists (select 1 from public.invitations) or exists (select 1 from public.assets) then
    raise exception 'A second account could see the owner draft or assets';
  end if;
  begin
    update public.invitations set data = '{}'::jsonb
    where id = current_setting('yugma.test_draft_id')::uuid;
    raise exception 'A second account was granted a direct table write';
  exception when insufficient_privilege then null;
  end;
  begin
    perform 1 from public.orders;
    raise exception 'An account got direct access to orders';
  exception when insufficient_privilege then null;
  end;
  begin
    perform 1 from public.payment_events;
    raise exception 'An account got direct access to payment events';
  exception when insufficient_privilege then null;
  end;
end;
$$;

reset role;
set local role anon;
select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claims', '{}', true);

do $$
begin
  if has_function_privilege('public.create_private_draft(uuid,text,jsonb)', 'EXECUTE')
    or has_function_privilege('public.save_private_draft(uuid,uuid,integer,jsonb)', 'EXECUTE')
  then
    raise exception 'Anonymous role can execute a draft mutation';
  end if;
  begin
    perform 1 from public.invitations;
    raise exception 'An anonymous caller accessed the base invitation table';
  exception when insufficient_privilege then null;
  end;
  begin
    perform 1 from public.assets;
    raise exception 'An anonymous caller accessed draft assets';
  exception when insufficient_privilege then null;
  end;
  if exists (select 1 from public.get_published_invitation('fictional-celebration')) then
    raise exception 'The public lookup returned an unpublished invitation';
  end if;
  begin
    perform public.record_razorpay_test_payment(
      'order_test_fixture', 'pay_test_fixture', 89900, 'INR', 'captured', null, 'untrusted_event'
    );
    raise exception 'An anonymous caller could invoke the payment reconciler';
  exception when insufficient_privilege then null;
  end;
end;
$$;

reset role;
set local role service_role;

-- Simulate a newer catalogue price. Existing test snapshots must retain their original amount.
update public.templates set status = 'active', price_in_paise = 150000 where slug = 'afterglow';

do $$
declare
  draft_id uuid := current_setting('yugma.test_draft_id')::uuid;
  test_order_id uuid;
  test_checkout_id uuid;
begin
  insert into public.orders (
    invitation_id, owner_id, template_id, amount_paise, gateway_order_id, status
  )
    select i.id, i.owner_id, i.template_id, 89900, 'order_test_fixture', 'test_created'
    from public.invitations as i where i.id = draft_id
    returning id into strict test_checkout_id;

  begin
    insert into public.orders (
      invitation_id, owner_id, template_id, amount_paise, gateway_order_id, status
    )
      select i.id, i.owner_id, i.template_id, 89900, 'order_test_duplicate', 'test_created'
      from public.invitations as i where i.id = draft_id;
    raise exception 'A second test checkout was accepted for the same draft';
  exception when unique_violation then null;
  end;

  begin
    update public.orders set status = 'test_verified' where id = test_checkout_id;
    raise exception 'A test checkout was verified without a payment record';
  exception when check_violation then null;
  end;

  begin
    update public.orders set amount_paise = 150000 where id = test_checkout_id;
    raise exception 'The database accepted a changed test checkout snapshot';
  exception when check_violation then null;
  end;

  if public.record_razorpay_test_payment('order_test_fixture', 'pay_failed', 89900,
    'INR', 'failed', null, 'test_failed_event') <> 'failed'
  then raise exception 'Test failure was not recorded'; end if;
  if public.record_razorpay_test_payment('order_test_fixture', 'pay_test_fixture', 150000,
    'INR', 'captured', null, 'test_price_mismatch') <> 'ignored'
  then raise exception 'Webhook applied the new catalogue price to an old order'; end if;
  if public.record_razorpay_test_payment('order_test_fixture', 'pay_test_fixture', 89900,
    'INR', 'authorized', (select owner_id from public.invitations where id = draft_id), null) <> 'processing'
  then raise exception 'An authorized payment did not stay processing'; end if;
  if public.record_razorpay_test_payment('order_test_fixture', 'pay_failed', 89900,
    'INR', 'failed', null, 'test_late_failure') <> 'processing'
  then raise exception 'A previous attempt replaced a processing payment'; end if;
  if public.record_razorpay_test_payment('order_test_fixture', 'pay_test_fixture', 89900,
    'INR', 'captured', null, 'test_capture_event') <> 'verified'
  then raise exception 'Signed capture did not reconcile the test order'; end if;
  if public.record_razorpay_test_payment('order_test_fixture', 'pay_test_fixture', 89900,
    'INR', 'captured', null, 'test_capture_event') <> 'duplicate'
  then raise exception 'Webhook replay was not deduplicated'; end if;
  perform public.record_razorpay_test_payment('order_test_fixture', 'pay_failed', 89900,
    'INR', 'failed', null, 'test_stale_failure');
  if not exists (
    select 1 from public.orders as o
    join public.payment_events as e on e.order_id = o.id
    where o.id = test_checkout_id and o.status = 'test_verified' and o.gateway_payment_id = 'pay_test_fixture'
      and o.last_failed_at is not null and o.processing_at is not null and o.verified_at is not null
      and e.gateway_event_id = 'test_capture_event' and e.processed_at is not null
  ) then raise exception 'Webhook capture or audit timestamps were not retained'; end if;
  if not exists (select 1 from public.invitations where id = draft_id and status = 'draft' and share_slug is null)
  then raise exception 'Test checkout changed the private invitation'; end if;
  begin
    update public.orders set status = 'captured' where id = test_checkout_id;
    raise exception 'A verified test order could be converted to live';
  exception when check_violation then null;
  end;

  begin
    update public.invitations set status = 'paid' where id = draft_id;
    raise exception 'The database allowed a skipped status';
  exception when check_violation then null;
  end;
  update public.invitations set status = 'payment_pending' where id = draft_id;
  begin
    update public.invitations set status = 'paid' where id = draft_id;
    raise exception 'The database accepted a verified test order as a real capture';
  exception when check_violation then null;
  end;

  insert into public.orders (
    invitation_id, owner_id, template_id, amount_paise, gateway_order_id, gateway_payment_id,
    status, verified_at
  )
    select i.id, i.owner_id, i.template_id, t.price_in_paise, 'order_fixture', 'payment_fixture',
      'captured', now()
    from public.invitations i join public.templates t on t.id = i.template_id
    where i.id = draft_id
    returning id into strict test_order_id;

  insert into public.payment_events (gateway_event_id, order_id, verified_source)
    values ('event_fixture', test_order_id, 'webhook');
  begin
    insert into public.payment_events (gateway_event_id, order_id, verified_source)
      values ('event_fixture', test_order_id, 'webhook');
    raise exception 'A duplicate payment event ID was accepted';
  exception when unique_violation then null;
  end;

  update public.invitations set status = 'paid' where id = draft_id;
  update public.invitations
    set status = 'published', share_slug = 'fictional-celebration', published_at = now()
    where id = draft_id;
end;
$$;

reset role;
set local role anon;

do $$
declare
  invitation jsonb;
begin
  select to_jsonb(i) into strict invitation
  from public.get_published_invitation('fictional-celebration') as i;
  if (select array_agg(key order by key) from jsonb_object_keys(invitation) as keys(key))
      is distinct from array['data', 'published_at', 'registry_key', 'schema_version', 'share_slug']
    or invitation->>'registry_key' <> 'afterglow' or invitation->>'schema_version' <> '1'
  then
    raise exception 'Published lookup returned the wrong projection';
  end if;
end;
$$;

reset role;
set local role service_role;
update public.orders set status = 'refunded' where gateway_order_id = 'order_fixture';
reset role;
set local role anon;

do $$
begin
  if exists (select 1 from public.get_published_invitation('fictional-celebration')) then
    raise exception 'A refunded invitation stayed publicly readable';
  end if;
end;
$$;

rollback;
