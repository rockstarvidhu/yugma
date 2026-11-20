alter table public.templates
  add column draft_eligible boolean not null default false;

update public.templates
set draft_eligible = true
where slug = 'afterglow' and registry_key = 'afterglow';

revoke insert (template_id, data), update (data)
  on public.invitations from authenticated;
drop policy invitations_owner_create_draft on public.invitations;
drop policy invitations_owner_update_draft on public.invitations;

-- Invoker functions for the trusted application server. The application obtains
-- the owner from the verified session and validates data with canonical Zod.
create function public.create_private_draft(
  p_owner_id uuid, p_registry_key text, p_data jsonb
)
returns table (
  id uuid, template_id uuid, registry_key text, data jsonb,
  schema_version integer, version integer, updated_at timestamptz
)
language sql set search_path = ''
as $$
  with eligible as materialized (
    select t.id, t.registry_key
    from public.templates as t
    where t.registry_key = p_registry_key and t.draft_eligible
    for share
  ), created as (
    insert into public.invitations as i (owner_id, template_id, data)
    select p_owner_id, eligible.id, p_data from eligible
    returning i.id, i.template_id, i.data, i.schema_version, i.version, i.updated_at
  )
  select c.id, c.template_id, e.registry_key, c.data,
    c.schema_version, c.version, c.updated_at
  from created as c join eligible as e on e.id = c.template_id;
$$;

create function public.save_private_draft(
  p_owner_id uuid, p_draft_id uuid, p_expected_version integer, p_data jsonb
)
returns table (
  id uuid, template_id uuid, registry_key text, data jsonb,
  schema_version integer, version integer, updated_at timestamptz
)
language sql set search_path = ''
as $$
  with saved as (
    update public.invitations as i
    set data = p_data
    where i.id = p_draft_id
      and i.owner_id = p_owner_id
      and i.status = 'draft'
      and i.schema_version = 1
      and i.version = p_expected_version
    returning i.id, i.template_id, i.data, i.schema_version, i.version, i.updated_at
  )
  select s.id, s.template_id, t.registry_key, s.data,
    s.schema_version, s.version, s.updated_at
  from saved as s join public.templates as t on t.id = s.template_id;
$$;

revoke execute on function public.create_private_draft(uuid, text, jsonb),
  public.save_private_draft(uuid, uuid, integer, jsonb)
  from public, anon, authenticated;
grant execute on function public.create_private_draft(uuid, text, jsonb),
  public.save_private_draft(uuid, uuid, integer, jsonb) to service_role;
