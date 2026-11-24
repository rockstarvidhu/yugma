begin;

insert into auth.users (id) values
  ('81000000-0000-4000-8000-000000000001'), ('81000000-0000-4000-8000-000000000002');
insert into public.invitations (id, owner_id, template_id, data)
select draft_id, '81000000-0000-4000-8000-000000000001', id, '{}'
from public.templates cross join (values
  ('82000000-0000-4000-8000-000000000001'::uuid),
  ('82000000-0000-4000-8000-000000000002'::uuid)
) as fixture(draft_id) where registry_key = 'afterglow';
insert into public.assets (id, invitation_id, owner_id, object_key, media_type, width, height, size_bytes)
values ('83000000-0000-4000-8000-000000000001', '82000000-0000-4000-8000-000000000001',
  '81000000-0000-4000-8000-000000000001',
  'draft-media/82000000-0000-4000-8000-000000000001/83000000-0000-4000-8000-000000000001',
  'image/webp', 120, 120, 1234);
update public.invitations set data = '{"coverImage":{"src":"https://media.yugma.invalid/83000000-0000-4000-8000-000000000001","alt":"Fixture photo"}}'
where id = '82000000-0000-4000-8000-000000000001';

set local role authenticated;
do $$
begin
  if has_function_privilege(current_user, 'public.publish_test_invitation(uuid,uuid,integer,text,text)', 'EXECUTE')
    or has_function_privilege(current_user, 'public.get_test_publication(text)', 'EXECUTE') then
    raise exception 'Authenticated role can call a service-only RPC';
  end if;
end;
$$;
reset role;
set local role anon;
do $$
begin
  if has_function_privilege(current_user, 'public.publish_test_invitation(uuid,uuid,integer,text,text)', 'EXECUTE')
    or has_function_privilege(current_user, 'public.get_test_publication(text)', 'EXECUTE') then
    raise exception 'Anonymous role can call a service-only RPC';
  end if;
end;
$$;
reset role;

set local role service_role;
do $$
declare
  owner constant uuid := '81000000-0000-4000-8000-000000000001';
  stranger constant uuid := '81000000-0000-4000-8000-000000000002';
  draft constant uuid := '82000000-0000-4000-8000-000000000001';
  other_draft constant uuid := '82000000-0000-4000-8000-000000000002';
  slug constant text := 'day-six-fixture';
  quote integer := 89900;
  latest_version integer;
begin
  select version into latest_version from public.invitations where id = draft;
  if public.publish_test_invitation(owner, draft, latest_version, 'Fixture', slug) <> 'unpaid'
    or exists (select 1 from public.get_test_publication(slug)) then
    raise exception 'Unpaid invitation could publish or appear publicly';
  end if;
  if public.publish_test_invitation(stranger, draft, latest_version, 'Fixture', slug) <> 'missing' then
    raise exception 'Another owner can access the invitation';
  end if;

  insert into public.orders (invitation_id, owner_id, template_id, amount_paise, gateway_order_id, status)
    select id, owner_id, template_id, quote, 'order_DaySixSql', 'test_created'
    from public.invitations where id = draft;
  perform public.record_razorpay_test_payment('order_DaySixSql', 'pay_DaySixSql',
    quote, 'INR', 'authorized', owner, null);
  if public.publish_test_invitation(owner, draft, latest_version, 'Fixture', slug) <> 'unpaid' then
    raise exception 'Authorized-only payment could publish';
  end if;
  perform public.record_razorpay_test_payment('order_DaySixSql', 'pay_DaySixSql',
    quote, 'INR', 'captured', owner, null);
  if exists (select 1 from public.get_test_publication(slug)) then
    raise exception 'Verified draft appeared before publication';
  end if;

  perform public.save_private_draft(owner, draft, latest_version,
    '{"coverImage":{"src":"https://media.yugma.invalid/83000000-0000-4000-8000-000000000001","alt":"Edited fixture photo"}}');
  if public.publish_test_invitation(owner, draft, latest_version, 'Fixture', slug) <> 'stale' then
    raise exception 'Stale review published updated data';
  end if;
  if public.publish_test_invitation(owner, draft, latest_version + 1, 'Fixture', slug) <> 'published'
    or public.publish_test_invitation(owner, draft, latest_version + 1, 'Retry', 'different-slug') <> 'published' then
    raise exception 'Verified invitation publication or idempotent retry failed';
  end if;
  if not exists (select 1 from public.get_test_publication(slug) p where
    p.title = 'Fixture' and p.cover ->> 'alt' = 'Edited fixture photo'
    and p.cover_size = 1234 and not p.data ? 'coverImage' and not p.cover ? 'src')
    or exists (select 1 from public.get_test_publication('different-slug')) then
    raise exception 'Public view did not project the confirmed invitation and cover';
  end if;

  if public.publish_test_invitation(owner, other_draft, 1, 'Other', 'other-invitation') <> 'unpaid' then
    raise exception 'A verified payment entitled another invitation';
  end if;
  insert into public.orders (invitation_id, owner_id, template_id, amount_paise, gateway_order_id, status)
    select id, owner_id, template_id, quote, 'order_DaySixOther', 'test_created'
    from public.invitations where id = other_draft;
  perform public.record_razorpay_test_payment('order_DaySixOther', 'pay_DaySixOther',
    quote, 'INR', 'captured', owner, null);
  if public.publish_test_invitation(owner, other_draft, 1, 'Other', slug) <> 'slug_taken'
    or exists (select 1 from public.invitations where id = other_draft and status <> 'draft') then
    raise exception 'Slug collision replaced an existing publication or changed the draft';
  end if;

  update public.invitations set status = 'revoked' where id = draft;
  if exists (select 1 from public.get_test_publication(slug))
    or public.publish_test_invitation(owner, draft, latest_version + 1, 'Fixture', slug) <> 'missing' then
    raise exception 'Revoked publication is still reachable';
  end if;
  delete from public.assets where invitation_id = draft;
  delete from public.orders where invitation_id = draft;
  delete from public.invitations where id = draft;
  if exists (select 1 from public.get_test_publication(slug)) then
    raise exception 'Deleted publication is still reachable';
  end if;
end;
$$;
reset role;

rollback;
