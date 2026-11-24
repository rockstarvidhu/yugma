-- All public reads, including a direct legacy RPC call, receive only guest fields.
create function yugma_private.public_text(value jsonb)
returns jsonb language sql immutable set search_path = '' as $$
  select case when jsonb_typeof(value) = 'string' then value end;
$$;
revoke all on function yugma_private.public_text(jsonb) from public, anon, authenticated;
grant usage on schema yugma_private to service_role;
grant execute on function yugma_private.public_text(jsonb) to service_role;
create function yugma_private.project_guest_invitation(p_data jsonb)
returns jsonb language sql immutable set search_path = '' as $$
  select jsonb_strip_nulls(jsonb_build_object(
    'couple', jsonb_build_object(
      'partnerOne', yugma_private.public_text(p_data #> '{couple,partnerOne}'),
      'partnerTwo', yugma_private.public_text(p_data #> '{couple,partnerTwo}')
    ),
    'timeZone', yugma_private.public_text(p_data -> 'timeZone'),
    'welcomeNote', yugma_private.public_text(p_data -> 'welcomeNote'),
    'closingNote', yugma_private.public_text(p_data -> 'closingNote'),
    'hosts', (
      select jsonb_agg(host.item order by host.ordinal)
      from jsonb_array_elements(
        case when jsonb_typeof(p_data -> 'hosts') = 'array' then p_data -> 'hosts' else '[]'::jsonb end
      ) with ordinality as host(item, ordinal)
      where jsonb_typeof(host.item) = 'string'
    ),
    'events', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', yugma_private.public_text(e.item -> 'id'), 'title', yugma_private.public_text(e.item -> 'title'), 'startsAt', yugma_private.public_text(e.item -> 'startsAt'),
        'location', yugma_private.public_text(e.item -> 'location'), 'description', yugma_private.public_text(e.item -> 'description'), 'dressCode', yugma_private.public_text(e.item -> 'dressCode'),
        'venue', jsonb_build_object(
          'name', yugma_private.public_text(e.item #> '{venue,name}'), 'address', yugma_private.public_text(e.item #> '{venue,address}'),
          'mapsUrl', case when e.item #>> '{venue,mapsUrl}' ~*
            $url$^https?://[^/?#[:space:]\\@]+([/?#]|$)$url$
            then yugma_private.public_text(e.item #> '{venue,mapsUrl}') end
        )
      ) order by e.ordinal), '[]'::jsonb)
      from jsonb_array_elements(
        case when jsonb_typeof(p_data -> 'events') = 'array' then p_data -> 'events' else '[]'::jsonb end
      ) with ordinality as e(item, ordinal)
    )
  ));
$$;

revoke all on function yugma_private.project_guest_invitation(jsonb) from public, anon, authenticated;
grant execute on function yugma_private.project_guest_invitation(jsonb) to service_role;

create or replace function public.get_published_invitation(p_slug text)
returns table (
  share_slug text, registry_key text, data jsonb, schema_version integer, published_at timestamptz
)
language sql stable security definer set search_path = '' as $$
  select i.share_slug, t.registry_key, yugma_private.project_guest_invitation(i.data), i.schema_version, i.published_at
  from public.invitations i
  join public.templates t on t.id = i.template_id
  where i.share_slug = p_slug and i.status = 'published' and i.test_publication_title is null
    and exists (select 1 from public.orders o where (o.invitation_id, o.owner_id, o.template_id) =
      (i.id, i.owner_id, i.template_id) and o.status = 'captured');
$$;

create function yugma_private.staged_public_cover(p_id uuid, p_owner uuid, p_src text)
returns table (asset_id uuid, size_bytes integer) language sql stable set search_path = '' as $$
  select a.id, a.size_bytes from public.assets a
  where a.invitation_id = p_id and a.owner_id = p_owner
    and a.media_type = 'image/webp' and a.size_bytes between 1 and 5242880
    and a.object_key = 'draft-media/' || p_id::text || '/' || a.id::text
    and p_src = 'https://media.yugma.invalid/' || a.id::text;
$$;
revoke all on function yugma_private.staged_public_cover(uuid, uuid, text) from public, anon, authenticated;
grant execute on function yugma_private.staged_public_cover(uuid, uuid, text) to service_role;

create or replace function public.publish_test_invitation(
  p_owner uuid, p_id uuid, p_version integer, p_title text, p_slug text
) returns text language plpgsql set search_path = '' as $$
declare
  invitation public.invitations%rowtype;
  cover_src text;
begin
  if p_title is null or char_length(btrim(p_title)) not between 1 and 170
    or p_slug is null or char_length(p_slug) not between 3 and 80
    or p_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' or p_version is null then
    return 'invalid';
  end if;

  select * into invitation from public.invitations where id = p_id and owner_id = p_owner for update;
  if not found then return 'missing'; end if;
  if invitation.status = 'published' and invitation.test_publication_title is not null then
    return 'published';
  end if;
  if invitation.status <> 'draft' or invitation.schema_version <> 1 then return 'missing'; end if;
  if not exists (select 1 from public.orders o join public.templates t on t.id = o.template_id
    where (o.invitation_id, o.owner_id, o.template_id) = (invitation.id, invitation.owner_id, invitation.template_id)
      and t.registry_key = 'afterglow' and o.status = 'test_verified') then return 'unpaid'; end if;
  if invitation.version <> p_version then return 'stale'; end if;

  cover_src := invitation.data #>> '{coverImage,src}';
  if cover_src is not null and not exists (
    select 1 from yugma_private.staged_public_cover(invitation.id, invitation.owner_id, cover_src)
  ) then return 'invalid_media'; end if;

  update public.invitations set status = 'published', test_publication_title = btrim(p_title),
    share_slug = p_slug, published_at = statement_timestamp() where id = invitation.id;
  return 'published';
exception when unique_violation then
  return 'slug_taken';
end;
$$;

create or replace function public.get_test_publication(p_slug text)
returns table (registry_key text, title text, data jsonb, schema_version integer,
  cover_draft_id uuid, cover_asset_id uuid, cover_size integer, cover jsonb)
language sql stable set search_path = '' as $$
  select t.registry_key, i.test_publication_title, yugma_private.project_guest_invitation(i.data),
    i.schema_version, case when a.asset_id is not null then i.id end, a.asset_id, a.size_bytes,
    case when a.asset_id is not null then jsonb_strip_nulls(jsonb_build_object(
      'alt', yugma_private.public_text(i.data #> '{coverImage,alt}'),
      'focalPosition', case when jsonb_typeof(i.data #> '{coverImage,focalPosition}') = 'object'
        then jsonb_build_object('x', i.data #> '{coverImage,focalPosition,x}',
          'y', i.data #> '{coverImage,focalPosition,y}') end
      )) end
  from public.invitations i
  join public.templates t on t.id = i.template_id
  left join lateral yugma_private.staged_public_cover(i.id, i.owner_id, i.data #>> '{coverImage,src}') a on true
  where i.share_slug = p_slug and i.status = 'published' and i.test_publication_title is not null
    and exists (select 1 from public.orders o where o.invitation_id = i.id
      and o.owner_id = i.owner_id and o.template_id = i.template_id and o.status = 'test_verified');
$$;
