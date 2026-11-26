-- Run after the baseline migrations, before the three PR #26 migrations.
insert into auth.users (id) values ('c6000000-0000-4000-8000-000000000001');
insert into public.invitations (id, owner_id, template_id, data)
select ('c6100000-0000-4000-8000-00000000000' || n)::uuid,
  'c6000000-0000-4000-8000-000000000001', t.id,
  jsonb_build_object('coverImage', jsonb_build_object(
    'src', case n when 6 then 'https://unapproved.example.test/external'
      else 'https://images.unsplash.com/photo-1754782540893-2122877f2975?auto=format&fit=crop&w=2400&q=80'
    end,
    'alt', 'Bundled test cover', 'focalPosition', '{"x":0.25,"y":0.75}'::jsonb
  )) - case when n in (1, 2, 5, 7) then 'coverImage' else 'unused' end
from public.templates t cross join generate_series(1, 7) n
where t.registry_key = 'afterglow';

insert into public.assets (id, invitation_id, owner_id, object_key, media_type, width, height, size_bytes)
values ('c6200000-0000-4000-8000-000000000001', 'c6100000-0000-4000-8000-000000000005',
  'c6000000-0000-4000-8000-000000000001',
  'draft-media/c6100000-0000-4000-8000-000000000005/c6200000-0000-4000-8000-000000000001',
  'image/webp', 120, 120, 1234);
update public.invitations set data = '{"coverImage":{
  "src":"https://media.yugma.invalid/c6200000-0000-4000-8000-000000000001","alt":"Private fixture cover"}}'
where id = 'c6100000-0000-4000-8000-000000000005';

do $$ begin
  if public.record_razorpay_test_payment('order_Upgrade1','pay_Upgrade1',89900,'INR',
    'captured',null,'evt_upgrade_1') <> 'ignored'
    or public.record_razorpay_test_payment('order_Upgrade2','pay_Upgrade2',1,'USD',
      'captured',null,'evt_upgrade_2') <> 'ignored'
  then raise exception 'Fixture did not create pre-PR unbound receipts'; end if;
end $$;

insert into public.orders (invitation_id, owner_id, template_id, amount_paise, gateway_order_id, status)
select id, owner_id, template_id, 89900, 'order_Upgrade' || right(id::text, 1), 'test_created'
from public.invitations where id = 'c6100000-0000-4000-8000-000000000003';
select public.record_razorpay_test_payment('order_Upgrade3','pay_Upgrade3',89900,'INR',
  'captured',null,'evt_upgrade_3');
select public.publish_test_invitation('c6000000-0000-4000-8000-000000000001',
  'c6100000-0000-4000-8000-000000000003',1,'Historic Test Mode','upgrade-historic');

update public.invitations set status = 'payment_pending'
where left(id::text, 8) = 'c6100000' and right(id::text, 1) in ('4','5','6','7');
insert into public.orders (invitation_id, owner_id, template_id, amount_paise,
  gateway_order_id, gateway_payment_id, status, verified_at)
select id, owner_id, template_id, 89900, 'order_Legacy' || right(id::text, 1),
  'pay_Legacy' || right(id::text, 1), 'captured', statement_timestamp()
from public.invitations where left(id::text, 8) = 'c6100000' and status = 'payment_pending';
update public.invitations set status = 'paid'
where left(id::text, 8) = 'c6100000' and status = 'payment_pending';
update public.invitations set status = 'published', share_slug = 'upgrade-legacy-' || right(id::text, 1),
  published_at = statement_timestamp()
where left(id::text, 8) = 'c6100000' and status = 'paid';

do $$ begin
  if not exists (select 1 from public.get_published_invitation('upgrade-legacy-4')
    where data #>> '{coverImage,alt}' = 'Bundled test cover')
  then raise exception 'Recognized cover was absent before upgrade'; end if;
end $$;
