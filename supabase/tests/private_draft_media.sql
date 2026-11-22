\set ON_ERROR_STOP on
begin;
insert into auth.users (id) values
  ('a1100000-0000-4000-8000-000000000001'),
  ('a1100000-0000-4000-8000-000000000002');

set local role service_role;
do $$
declare
  alice constant uuid := 'a1100000-0000-4000-8000-000000000001';
  bob constant uuid := 'a1100000-0000-4000-8000-000000000002';
  asset constant uuid := 'a1100000-0000-4000-8000-000000000003';
  ref constant jsonb := '{"coverImage":{"src":"https://media.yugma.invalid/a1100000-0000-4000-8000-000000000003","alt":"Fictional wedding photo"}}';
  draft uuid;
  other_draft uuid;
  same_owner_draft uuid;
  version_after integer;
  reserved uuid;
  abandoned constant uuid := 'a1100000-0000-4000-8000-000000000004';
begin
  select id into strict draft from public.create_private_draft(alice, 'afterglow', '{}');
  select id into strict other_draft from public.create_private_draft(bob, 'afterglow', '{}');
  select id into strict same_owner_draft from public.create_private_draft(alice, 'afterglow', '{}');
  if public.reserve_draft_media(bob, draft, asset, 'image/png', 31) <> 'missing'
    then raise exception 'Cross-owner reservation'; end if;
  if public.reserve_draft_media(alice, draft, asset, 'image/png', 31) <> 'reserved'
    then raise exception 'Reservation failed'; end if;

  begin
    perform public.save_private_draft(alice, draft, 1, ref);
    raise exception 'Unregistered cover reference was attached';
  exception when check_violation then
    if sqlerrm <> 'Invalid private cover reference' then raise; end if;
  end;

  if public.register_draft_media(bob, draft, asset, 10, 20, 25)
    then raise exception 'Cross-owner registration'; end if;
  if public.register_draft_media(alice, same_owner_draft, asset, 10, 20, 25)
    then raise exception 'Cross-draft registration'; end if;
  if not public.register_draft_media(alice, draft, asset, 10, 20, 25)
    then raise exception 'Owner could not register'; end if;
  if not public.register_draft_media(alice, draft, asset, 15, 50, 40)
    then raise exception 'Duplicate completion did not succeed idempotently'; end if;
  if (select count(*) from public.assets where id = asset and width = 10 and size_bytes = 25) <> 1
    then raise exception 'Duplicate completion changed the asset'; end if;

  select version into strict version_after from public.save_private_draft(alice, draft, 1, ref);
  if version_after <> 2 or exists (select 1 from public.save_private_draft(alice, draft, 1, '{}'))
    then raise exception 'Saving a cover bypassed version checking'; end if;
  if (select data from public.invitations where id = draft) <> ref
    then raise exception 'Saved reference not retained'; end if;

  begin
    perform public.save_private_draft(bob, other_draft, 1, ref);
    raise exception 'Cross-owner cover was attached';
  exception when check_violation then
    if sqlerrm <> 'Invalid private cover reference' then raise; end if;
  end;
  begin
    perform public.save_private_draft(alice, same_owner_draft, 1, ref);
    raise exception 'Cross-draft cover was attached';
  exception when check_violation then
    if sqlerrm <> 'Invalid private cover reference' then raise; end if;
  end;
  begin
    perform public.save_private_draft(alice, draft, 2, jsonb_build_object('gallery', jsonb_build_array(ref -> 'coverImage')));
    raise exception 'Private gallery reference was attached';
  exception when check_violation then
    if sqlerrm <> 'Invalid private cover reference' then raise; end if;
  end;

  for n in 1..3 loop
    reserved := gen_random_uuid();
    if public.reserve_draft_media(alice, draft, reserved, 'image/png', 31) <> 'reserved'
      then raise exception 'Premature pending quota'; end if;
  end loop;
  if public.reserve_draft_media(alice, draft, gen_random_uuid(), 'image/png', 31) <> 'quota'
    then raise exception 'Pending quota failed'; end if;
  if not public.register_draft_media(alice, draft, reserved, 10, 20, 25)
    then raise exception 'Reserved photo could not complete'; end if;
  if public.reserve_draft_media(alice, draft, gen_random_uuid(), 'image/png', 31) <> 'reserved'
    or public.reserve_draft_media(alice, draft, gen_random_uuid(), 'image/png', 31) <> 'quota'
    then raise exception 'Combined ready and pending quota failed'; end if;
  -- Seed an expired reservation via the same restricted table.
  insert into public.draft_media_uploads (id, invitation_id, owner_id, input_type, input_size, created_at, expires_at)
    values (abandoned, draft, alice, 'image/png', 31, now()-interval '2 hours', now()-interval '110 minutes');
  if public.register_draft_media(alice, draft, abandoned, 10, 20, 25)
    or (select count(*) from public.expired_draft_media(alice,draft) where id = abandoned) <> 1
    or exists (select 1 from public.expired_draft_media(bob,draft))
    then raise exception 'Expired registration or cleanup authorization failed'; end if;
end $$;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a1100000-0000-4000-8000-000000000001","role":"authenticated"}', true);
do $$
begin
  if (select count(*) from public.assets) <> 2 then raise exception 'Owner read failed'; end if;
  if has_table_privilege('public.assets','INSERT') or has_table_privilege('public.assets','UPDATE')
     or has_table_privilege('public.draft_media_uploads','SELECT')
     or has_function_privilege('public.reserve_draft_media(uuid,uuid,uuid,text,integer)','EXECUTE')
     or has_function_privilege('public.register_draft_media(uuid,uuid,uuid,integer,integer,integer)','EXECUTE')
     or has_function_privilege('public.expired_draft_media(uuid,uuid)','EXECUTE')
    then raise exception 'Authenticated caller has direct write or reservation access'; end if;
end $$;
select set_config('request.jwt.claims', '{"sub":"a1100000-0000-4000-8000-000000000002","role":"authenticated"}', true);
do $$ begin
  if exists (select 1 from public.assets) then raise exception 'Other owner can read assets'; end if;
end $$;
set local role anon;
do $$ begin
  if has_table_privilege('public.assets','SELECT')
    or has_function_privilege('public.register_draft_media(uuid,uuid,uuid,integer,integer,integer)','EXECUTE')
    then raise exception 'Anonymous caller has private media privileges'; end if;
end $$;
rollback;
