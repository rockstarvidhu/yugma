alter table public.invitations add column test_publication_title text,
  add constraint invitations_test_publication_check check (
    test_publication_title is null or (
      status in ('published', 'revoked') and share_slug is not null
      and char_length(btrim(test_publication_title)) between 1 and 170
    )
  );

create or replace function yugma_private.maintain_invitation()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    if new.status <> 'draft' then
      raise exception 'Invitations must start as drafts' using errcode = '23514';
    end if;
    return new;
  end if;

  if old.status = 'draft' and new.status = 'published' and new.test_publication_title is not null then
    if not exists (select 1 from public.orders o where o.invitation_id = new.id
      and o.owner_id = new.owner_id and o.template_id = new.template_id
      and o.status = 'test_verified') then
      raise exception 'Verified test order required' using errcode = '23514';
    end if;
  else
    if old.test_publication_title is distinct from new.test_publication_title then
      raise exception 'Test publication title is immutable' using errcode = '23514';
    end if;
    if old.test_publication_title is not null and
      row(old.share_slug, old.published_at) is distinct from row(new.share_slug, new.published_at)
    then
      raise exception 'Test publication link is immutable' using errcode = '23514';
    end if;
    if old.status is distinct from new.status then
      if not (
        (old.status = 'draft' and new.status = 'payment_pending')
        or (old.status = 'payment_pending' and new.status in ('draft', 'paid'))
        or (old.status = 'paid' and new.status in ('published', 'revoked'))
        or (old.status = 'published' and new.status = 'revoked')
      ) then
        raise exception 'Invalid invitation status transition' using errcode = '23514';
      end if;
      if new.status in ('paid', 'published') and not exists (
        select 1 from public.orders where invitation_id = new.id and status = 'captured'
      ) then
        raise exception 'Captured order required' using errcode = '23514';
      end if;
    end if;
  end if;

  if old.status <> 'draft' and (
    old.data is distinct from new.data or old.schema_version is distinct from new.schema_version
  ) then
    raise exception 'Only draft invitation data can be updated' using errcode = '23514';
  end if;
  new.version := old.version + 1;
  new.updated_at := statement_timestamp();
  return new;
end;
$$;

create or replace function public.get_published_invitation(p_slug text)
returns table (
  share_slug text, registry_key text, data jsonb, schema_version integer, published_at timestamptz
)
language sql stable security definer set search_path = '' as $$
  select i.share_slug, t.registry_key, i.data, i.schema_version, i.published_at
  from public.invitations i
  join public.templates t on t.id = i.template_id
  where i.share_slug = p_slug and i.status = 'published' and i.test_publication_title is null
    and exists (select 1 from public.orders o where o.invitation_id = i.id and o.status = 'captured');
$$;

create function public.publish_test_invitation(
  p_owner uuid, p_id uuid, p_version integer, p_title text, p_slug text
) returns text language plpgsql set search_path = '' as $$
declare
  invitation public.invitations%rowtype;
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
  if not exists (select 1 from public.orders o where o.invitation_id = invitation.id
    and o.owner_id = invitation.owner_id and o.template_id = invitation.template_id
    and o.status = 'test_verified') then return 'unpaid'; end if;
  if invitation.version <> p_version then return 'stale'; end if;

  update public.invitations set status = 'published', test_publication_title = btrim(p_title),
    share_slug = p_slug, published_at = statement_timestamp() where id = invitation.id;
  return 'published';
exception when unique_violation then
  return 'slug_taken';
end;
$$;

-- The captured-payment projection stays independent. The app can enable this
-- service-only projection on staging, including its internal cover lookup.
create function public.get_test_publication(p_slug text)
returns table (registry_key text, title text, data jsonb, schema_version integer,
  cover_draft_id uuid, cover_asset_id uuid, cover_size integer, cover jsonb)
language sql stable set search_path = '' as $$
  select t.registry_key, i.test_publication_title,
    case when i.data #>> '{coverImage,src}' like 'https://media.yugma.invalid/%'
      then i.data - 'coverImage' else i.data end,
    i.schema_version, a.invitation_id, a.id, a.size_bytes,
    case when a.id is not null then (i.data -> 'coverImage') - 'src' end
  from public.invitations i
  join public.templates t on t.id = i.template_id
  left join public.assets a on a.invitation_id = i.id and a.owner_id = i.owner_id
    and a.media_type = 'image/webp' and a.size_bytes between 1 and 5242880
    and a.object_key = 'draft-media/' || i.id::text || '/' || a.id::text
    and i.data #>> '{coverImage,src}' = 'https://media.yugma.invalid/' || a.id::text
  where i.share_slug = p_slug and i.status = 'published' and i.test_publication_title is not null
    and exists (select 1 from public.orders o where o.invitation_id = i.id
      and o.owner_id = i.owner_id and o.template_id = i.template_id and o.status = 'test_verified');
$$;

revoke all on function public.publish_test_invitation(uuid, uuid, integer, text, text),
  public.get_test_publication(text) from public, anon, authenticated, service_role;
grant execute on function public.publish_test_invitation(uuid, uuid, integer, text, text),
  public.get_test_publication(text) to service_role;
