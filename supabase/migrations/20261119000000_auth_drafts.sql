create schema if not exists yugma_private;
revoke all on schema yugma_private from public, anon, authenticated;

create table public.templates (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  registry_key text not null unique check (registry_key <> ''),
  status text not null default 'demo' check (status in ('demo', 'active')),
  price_in_paise integer check (price_in_paise > 0),
  currency text not null default 'INR' check (currency = 'INR'),
  created_at timestamptz not null default now(),
  check (status <> 'active' or price_in_paise is not null)
);

create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id),
  template_id uuid not null references public.templates (id),
  status text not null default 'draft'
    check (status in ('draft', 'payment_pending', 'paid', 'published', 'revoked')),
  data jsonb not null check (jsonb_typeof(data) = 'object'),
  schema_version integer not null default 1 check (schema_version > 0),
  version integer not null default 1 check (version > 0),
  share_slug text unique check (share_slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, owner_id),
  unique (id, owner_id, template_id),
  check ((share_slug is null) = (published_at is null)),
  check (
    (status = 'published' and share_slug is not null and published_at is not null)
    or (status = 'revoked')
    or (status in ('draft', 'payment_pending', 'paid') and share_slug is null and published_at is null)
  )
);

create index invitations_owner_idx on public.invitations (owner_id);

create table public.assets (
  id uuid primary key default gen_random_uuid(),
  invitation_id uuid not null,
  owner_id uuid not null,
  object_key text not null unique check (object_key <> ''),
  media_type text not null check (media_type <> ''),
  width integer not null check (width > 0),
  height integer not null check (height > 0),
  size_bytes integer not null check (size_bytes > 0),
  created_at timestamptz not null default now(),
  foreign key (invitation_id, owner_id) references public.invitations (id, owner_id)
);

create index assets_invitation_owner_idx on public.assets (invitation_id, owner_id);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  invitation_id uuid not null,
  owner_id uuid not null,
  template_id uuid not null,
  amount_paise integer not null check (amount_paise > 0),
  currency text not null default 'INR' check (currency = 'INR'),
  gateway_order_id text not null unique check (gateway_order_id <> ''),
  gateway_payment_id text unique check (gateway_payment_id <> ''),
  status text not null default 'created'
    check (status in ('created', 'captured', 'failed', 'cancelled', 'refunded')),
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  foreign key (invitation_id, owner_id, template_id)
    references public.invitations (id, owner_id, template_id),
  check (
    status not in ('captured', 'refunded')
    or (gateway_payment_id is not null and verified_at is not null)
  )
);

create index orders_invitation_idx on public.orders (invitation_id);
create unique index orders_one_capture_idx on public.orders (invitation_id)
  where status = 'captured';

create table public.payment_events (
  gateway_event_id text primary key check (gateway_event_id <> ''),
  order_id uuid references public.orders (id),
  verified_source text not null check (verified_source in ('checkout', 'webhook')),
  verified_at timestamptz not null default now(),
  processed_at timestamptz,
  check (processed_at >= verified_at)
);

create function yugma_private.maintain_invitation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if new.status <> 'draft' then
      raise exception 'Invitations must start as drafts' using errcode = '23514';
    end if;
    return new;
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
      select 1 from public.orders
      where invitation_id = new.id and status = 'captured'
    ) then
      raise exception 'Captured order required' using errcode = '23514';
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

revoke all on function yugma_private.maintain_invitation() from public, anon, authenticated;
create trigger invitations_before_write
before insert or update on public.invitations
for each row execute function yugma_private.maintain_invitation();

alter table public.templates enable row level security;
alter table public.invitations enable row level security;
alter table public.assets enable row level security;
alter table public.orders enable row level security;
alter table public.payment_events enable row level security;

-- Supabase projects can apply broad default grants to new public objects.
revoke all on public.templates, public.invitations, public.assets, public.orders,
  public.payment_events from public, anon, authenticated, service_role;
grant select, insert, update, delete on public.templates, public.invitations,
  public.assets, public.orders, public.payment_events to service_role;
grant select on public.templates to anon, authenticated;
grant select on public.invitations, public.assets to authenticated;
grant insert (template_id, data), update (data) on public.invitations to authenticated;

create policy templates_catalogue_read on public.templates
  for select to anon, authenticated using (true);

create policy invitations_owner_read on public.invitations
  for select to authenticated using (
    owner_id = (select auth.uid())
    and (select auth.jwt()->>'is_anonymous') is distinct from 'true'
  );

create policy invitations_owner_create_draft on public.invitations
  for insert to authenticated with check (
    owner_id = (select auth.uid())
    and (select auth.jwt()->>'is_anonymous') is distinct from 'true'
    and status = 'draft'
    and exists (
      select 1 from public.templates
      where id = invitations.template_id and status = 'active'
    )
  );

create policy invitations_owner_update_draft on public.invitations
  for update to authenticated
  using (
    owner_id = (select auth.uid())
    and (select auth.jwt()->>'is_anonymous') is distinct from 'true'
    and status = 'draft'
  )
  with check (
    owner_id = (select auth.uid())
    and (select auth.jwt()->>'is_anonymous') is distinct from 'true'
    and status = 'draft'
  );

create policy assets_owner_read on public.assets
  for select to authenticated using (
    owner_id = (select auth.uid())
    and (select auth.jwt()->>'is_anonymous') is distinct from 'true'
  );

-- Shared reads project only renderer inputs. Base invitation and media rows stay private.
create function public.get_published_invitation(p_slug text)
returns table (
  share_slug text, registry_key text, data jsonb, schema_version integer, published_at timestamptz
)
language sql stable security definer
set search_path = ''
as $$
  select i.share_slug, t.registry_key, i.data, i.schema_version, i.published_at
  from public.invitations as i
  join public.templates as t on t.id = i.template_id
  where i.share_slug = p_slug and i.status = 'published'
    and exists (
      select 1 from public.orders as o
      where o.invitation_id = i.id and o.status = 'captured'
    );
$$;

revoke all on function public.get_published_invitation(text)
  from public, anon, authenticated, service_role;
grant execute on function public.get_published_invitation(text) to anon, authenticated;

-- Afterglow is the registered design. Heirloom is its cover and sample alias.
insert into public.templates (slug, registry_key) values ('afterglow', 'afterglow');
