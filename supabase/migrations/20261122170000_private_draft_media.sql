create table public.draft_media_uploads (
  id uuid primary key,
  invitation_id uuid not null,
  owner_id uuid not null,
  input_type text not null check (input_type in ('image/jpeg', 'image/png', 'image/webp')),
  input_size integer not null check (input_size between 1 and 5242880),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '10 minutes'),
  foreign key (invitation_id, owner_id) references public.invitations (id, owner_id) on delete cascade
);
create index draft_media_uploads_draft_created_idx on public.draft_media_uploads (invitation_id, created_at);
alter table public.draft_media_uploads enable row level security;
revoke all on public.draft_media_uploads from public, anon, authenticated, service_role;
grant select, insert, delete on public.draft_media_uploads to service_role;

create function public.reserve_draft_media(
  p_owner uuid, p_draft uuid, p_id uuid, p_type text, p_size integer
) returns text language plpgsql set search_path = '' as $$
declare
  pending_count integer;
  ready_count integer;
begin
  -- Serialize quota reservations with one another and final registration.
  perform 1 from public.invitations i
    join public.templates t on i.template_id = t.id
    where i.id = p_draft and i.owner_id = p_owner and i.status = 'draft'
      and t.draft_eligible
    for update of i;
  if not found then return 'missing'; end if;

  select count(*) into ready_count from public.assets a where a.invitation_id = p_draft;
  select count(*) into pending_count from public.draft_media_uploads u
    where u.invitation_id = p_draft and u.expires_at > clock_timestamp()
      and not exists (select 1 from public.assets a where a.id = u.id);
  if ready_count + pending_count >= 5 or pending_count >= 3 or
    (select count(*) from public.draft_media_uploads u
      where u.invitation_id = p_draft and u.created_at > clock_timestamp() - interval '1 hour') >= 20
  then return 'quota'; end if;

  insert into public.draft_media_uploads (id, invitation_id, owner_id, input_type, input_size)
    values (p_id, p_draft, p_owner, p_type, p_size);
  return 'reserved';
end
$$;

create function public.register_draft_media(
  p_owner uuid, p_draft uuid, p_id uuid, p_width integer, p_height integer, p_size integer
) returns boolean language plpgsql set search_path = '' as $$
begin
  perform 1 from public.invitations i
    join public.templates t on i.template_id = t.id
    where i.id = p_draft and i.owner_id = p_owner and i.status = 'draft'
      and t.draft_eligible
    for update of i;
  if not found then return false; end if;
  if exists (select 1 from public.assets a where a.id = p_id and a.invitation_id = p_draft and a.owner_id = p_owner)
    then return true; end if;
  if p_width not between 1 and 2400 or p_height not between 1 and 2400 or p_size not between 1 and 5242880
    then return false; end if;
  if not exists (select 1 from public.draft_media_uploads u
    where u.invitation_id = p_draft and u.owner_id = p_owner and u.id = p_id
      and u.expires_at > clock_timestamp())
    then return false; end if;

  insert into public.assets (id, invitation_id, owner_id, object_key, media_type, width, height, size_bytes)
    values (p_id, p_draft, p_owner, 'draft-media/' || p_draft::text || '/' || p_id::text,
      'image/webp', p_width, p_height, p_size);
  return true;
end
$$;

create function public.expired_draft_media(p_owner uuid, p_draft uuid)
returns table (id uuid) language sql stable set search_path = '' as $$
  select u.id from public.draft_media_uploads u
    where u.owner_id = p_owner and u.invitation_id = p_draft
      and u.expires_at < now() - interval '1 hour'
      and not exists (select 1 from public.assets a where a.id = u.id)
    order by u.expires_at limit 5;
$$;

revoke all on function public.reserve_draft_media(uuid, uuid, uuid, text, integer),
  public.register_draft_media(uuid, uuid, uuid, integer, integer, integer),
  public.expired_draft_media(uuid, uuid) from public, anon, authenticated, service_role;
grant execute on function public.reserve_draft_media(uuid, uuid, uuid, text, integer),
  public.register_draft_media(uuid, uuid, uuid, integer, integer, integer),
  public.expired_draft_media(uuid, uuid) to service_role;

-- The URL is an opaque canonical image reference. Enforce attachment in the same
-- transaction as versioned draft writes, regardless of the API that made the write.
create function yugma_private.check_draft_media_reference()
returns trigger language plpgsql set search_path = '' as $$
declare
  cover text := new.data #>> '{coverImage,src}';
  media_prefix constant text := 'https://media.yugma.invalid/';
begin
  if cover like media_prefix || '%' then
    if cover !~ '^https://media[.]yugma[.]invalid/[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$' then
      raise exception 'Invalid private cover reference' using errcode = '23514';
    end if;
    if not exists (select 1 from public.assets a
      where a.id = substring(cover from length(media_prefix) + 1)::uuid
        and a.invitation_id = new.id and a.owner_id = new.owner_id and a.media_type = 'image/webp'
        and a.object_key = 'draft-media/' || new.id::text || '/' || a.id::text)
      then raise exception 'Invalid private cover reference' using errcode = '23514';
    end if;
  end if;
  if jsonb_typeof(new.data -> 'gallery') = 'array' and exists (
    select 1 from jsonb_array_elements(new.data -> 'gallery') item
      where item ->> 'src' like media_prefix || '%'
  ) then raise exception 'Invalid private cover reference' using errcode = '23514'; end if;
  return new;
end
$$;

revoke all on function yugma_private.check_draft_media_reference() from public, anon, authenticated;
create trigger invitations_check_draft_media
  before insert or update of data, owner_id on public.invitations
  for each row execute function yugma_private.check_draft_media_reference();
