-- Run only on disposable rehearsal databases. Set seed_backup_fixture to 1
-- before a dump and to 0 to verify the restored copy without writing to it.
\if :seed_backup_fixture
insert into auth.users (id) values ('e4000000-0000-4000-8000-000000000001');

select id as backup_draft_id
from public.create_private_draft(
  'e4000000-0000-4000-8000-000000000001',
  'afterglow',
  '{
    "couple":{"partnerOne":"Sample Tara","partnerTwo":"Sample Neel"},
    "timeZone":"Europe/London",
    "events":[
      {"id":"ceremony","title":"Ceremony","startsAt":"2026-10-25T01:15:00+01:00",
       "venue":{"name":"Sample Hall","address":"1 Fictional Lane"}},
      {"id":"reception","title":"Reception","startsAt":"2026-10-25T01:15:00Z",
       "venue":{"name":"Sample Garden","address":"2 Fictional Lane"}}
    ]
  }'::jsonb
) \gset

select saved.version as backup_saved_version
from public.invitations as i
cross join lateral public.save_private_draft(
  i.owner_id, i.id, i.version, i.data || '{"welcomeNote":"Fictional restored draft"}'
) as saved
where i.id = :'backup_draft_id'::uuid \gset
\endif

set time zone 'UTC';

do $$
begin
  if not exists (
    select 1
    from public.invitations as i
    join auth.users as u on u.id = i.owner_id
    join public.templates as t on t.id = i.template_id
    where u.id = 'e4000000-0000-4000-8000-000000000001'
      and t.registry_key = 'afterglow'
      and i.status = 'draft'
      and i.version = 2 and i.schema_version = 1
      and i.updated_at >= i.created_at
      and i.share_slug is null and i.published_at is null
      and i.data #>> '{couple,partnerOne}' = 'Sample Tara'
      and i.data ->> 'timeZone' = 'Europe/London'
      and i.data ->> 'welcomeNote' = 'Fictional restored draft'
      and jsonb_array_length(i.data -> 'events') = 2
      and i.data #>> '{events,0,startsAt}' = '2026-10-25T01:15:00+01:00'
      and i.data #>> '{events,1,startsAt}' = '2026-10-25T01:15:00Z'
      and i.data #>> '{events,0,venue,address}' = '1 Fictional Lane'
      and i.data #>> '{events,1,venue,address}' = '2 Fictional Lane'
  ) then
    raise exception 'Backup draft content or metadata is missing or invalid';
  end if;
end;
$$;

select md5(to_jsonb(i)::text)
from public.invitations as i
where i.owner_id = 'e4000000-0000-4000-8000-000000000001';
