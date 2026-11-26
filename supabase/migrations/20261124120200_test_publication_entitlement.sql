-- Historic captures remain immutable. Current Test Mode publication access is separate.
alter table public.orders add column test_entitlement text
  check (test_entitlement in ('unconfirmed', 'active', 'suspended', 'revoked')),
  add column test_checkout_started_at timestamptz,
  add column test_attempt_checked_at timestamptz;

-- Historical captures predate refund reconciliation. Confirm them with Razorpay
-- before restoring guest access; their receipts and invitation links are kept.
update public.orders set test_entitlement = 'unconfirmed' where status = 'test_verified';
alter table public.orders add constraint orders_test_entitlement_status_check check (
  (test_entitlement is null or status in ('test_created', 'test_failed', 'test_processing', 'test_verified'))
  and (status <> 'test_verified' or test_entitlement is not null)
  and (status = 'test_verified' or coalesce(test_entitlement, '') not in ('unconfirmed', 'active'))
);

alter table public.payment_events drop constraint payment_events_outcome_check;
alter table public.payment_events add constraint payment_events_outcome_check
  check (outcome in (
    'verified', 'processing', 'failed', 'ignored', 'suspended', 'revoked',
    'legacy_unbound', 'awaiting_verification'
  ));
update public.payment_events set outcome = 'legacy_unbound'
  where order_id is null and processed_at is not null and outcome is null
    and verified_source = 'webhook';

create or replace function public.claim_razorpay_test_reconciliation(p_owner_id uuid, p_id uuid)
returns boolean language sql set search_path = '' as $$
  with claimed as (
    update public.orders o
    set test_reconciled_at = statement_timestamp()
    where o.id = p_id and o.owner_id = p_owner_id
      and o.status in ('test_created', 'test_failed', 'test_processing', 'test_verified')
      and (o.test_reconciled_at is null or o.test_reconciled_at <= statement_timestamp() - interval '15 seconds')
    returning 1
  )
  select exists (select 1 from claimed);
$$;

revoke all on function public.claim_razorpay_test_reconciliation(uuid, uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.claim_razorpay_test_reconciliation(uuid, uuid) to service_role;

drop function public.record_razorpay_test_payment(text, text, integer, text, text, uuid, text, text);
create function public.record_razorpay_test_payment(
  p_order_id text, p_payment_id text, p_amount integer, p_currency text,
  p_status text, p_owner_id uuid, p_event_id text, p_request_sha256 text default null,
  p_checked_at timestamptz default null
) returns text language plpgsql set search_path = '' as $$
declare
  test_order public.orders%rowtype;
  target_invitation uuid;
  result_state text := 'ignored';
begin
  if (p_owner_id is null) = (p_event_id is null)
    or p_status is null or p_status not in (
      'authorized', 'captured', 'failed', 'ignored', 'suspended', 'revoked', 'pending_review'
    )
    or p_payment_id is null or char_length(p_payment_id) not between 1 and 80
    or p_amount is null or p_currency is null
    or (p_event_id is not null and p_event_id !~ '^[A-Za-z0-9_-]{1,128}$')
    or (p_request_sha256 is not null and (p_event_id is null or p_request_sha256 !~ '^[0-9a-f]{64}$'))
  then
    raise exception 'Invalid verified payment source or evidence' using errcode = '22023';
  end if;

  select o.invitation_id into target_invitation from public.orders o
  where o.gateway_order_id = p_order_id
    and (p_owner_id is null or o.owner_id = p_owner_id)
    and o.status in ('test_created', 'test_failed', 'test_processing', 'test_verified');

  -- Lock invitations before orders. Publication and versioned saves use the same invitation lock.
  perform 1 from public.invitations i
  where i.id = target_invitation and i.status in ('draft', 'published', 'revoked')
  for update;
  if found then
    select o.* into test_order from public.orders o
    join public.invitations i on (i.id, i.owner_id, i.template_id) = (o.invitation_id, o.owner_id, o.template_id)
    join public.templates t on t.id = o.template_id
    where o.invitation_id = target_invitation and o.gateway_order_id = p_order_id
      and (p_owner_id is null or o.owner_id = p_owner_id)
      and t.registry_key = 'afterglow'
      and o.status in ('test_created', 'test_failed', 'test_processing', 'test_verified')
      and (i.status = 'draft' or o.status = 'test_verified')
    for update of o;
  end if;

  if test_order.id is null and p_event_id is not null and p_order_id is not null and p_status <> 'ignored' then
    return 'retry';
  end if;

  -- Event identity and the order transition commit in the same transaction.
  -- Only classified legacy rows and explicitly deferred verification are resumable.
  if p_event_id is not null then
    insert into public.payment_events (gateway_event_id, order_id, verified_source, request_sha256)
    values (p_event_id, test_order.id, 'webhook', p_request_sha256)
    on conflict do nothing;
    if not found then
      update public.payment_events set order_id = test_order.id, request_sha256 = p_request_sha256
      where gateway_event_id = p_event_id and test_order.id is not null and (
        (outcome = 'legacy_unbound' and order_id is null and request_sha256 is null)
        or (outcome = 'awaiting_verification' and order_id = test_order.id
          and request_sha256 = p_request_sha256)
      );
      if not found then return 'duplicate'; end if;
    end if;
  end if;

  begin
    if p_status <> 'ignored' and test_order.id is not null
      and test_order.amount_paise = p_amount and test_order.currency = p_currency
    then
      if p_status in ('pending_review', 'suspended', 'revoked') then
        if test_order.status <> 'test_verified' or test_order.gateway_payment_id = p_payment_id then
          update public.orders set test_entitlement = case
            when test_entitlement = 'revoked' or p_status = 'revoked' then 'revoked'
            else 'suspended'
          end where id = test_order.id returning test_entitlement into result_state;
          if p_status = 'pending_review' then result_state := 'awaiting_verification'; end if;
        end if;
      elsif test_order.status = 'test_verified' then
        if test_order.gateway_payment_id = p_payment_id then
          if p_status = 'captured' and test_order.test_entitlement in ('unconfirmed') then
            update public.orders set test_entitlement = 'active' where id = test_order.id;
            result_state := 'verified';
          else
            result_state := case test_order.test_entitlement
              when 'active' then 'verified' when 'revoked' then 'revoked' else 'suspended' end;
          end if;
        end if;
      elsif p_status = 'captured' then
        update public.orders set status = 'test_verified', gateway_payment_id = p_payment_id,
          verified_at = statement_timestamp(),
          test_verification_source = case when p_event_id is null then 'owner_check' else 'webhook' end,
          test_entitlement = coalesce(test_entitlement, 'active')
        where id = test_order.id
        returning case test_entitlement when 'active' then 'verified' else test_entitlement end
        into result_state;
      elsif test_order.test_entitlement in ('suspended', 'revoked') then
        result_state := test_order.test_entitlement;
      elsif p_status in ('failed', 'authorized') and (
        p_checked_at < test_order.test_attempt_checked_at
        or (p_checked_at = test_order.test_attempt_checked_at
          and p_status = 'failed' and test_order.status = 'test_processing')
      ) then
        result_state := case test_order.status
          when 'test_processing' then 'processing' when 'test_failed' then 'failed' else 'ignored' end;
      elsif p_status = 'failed' and (
        test_order.status = 'test_created'
        or (test_order.status = 'test_failed' and test_order.gateway_payment_id <> p_payment_id)
        or (test_order.status = 'test_processing' and test_order.gateway_payment_id = p_payment_id)
      ) then
        update public.orders set status = 'test_failed', gateway_payment_id = p_payment_id,
          last_failed_at = statement_timestamp(),
          test_attempt_checked_at = coalesce(p_checked_at, statement_timestamp())
        where id = test_order.id;
        result_state := 'failed';
      elsif p_status = 'authorized' and test_order.status in ('test_created', 'test_failed') then
        update public.orders set status = 'test_processing', gateway_payment_id = p_payment_id,
          processing_at = statement_timestamp(),
          test_attempt_checked_at = coalesce(p_checked_at, statement_timestamp())
        where id = test_order.id;
        result_state := 'processing';
      elsif p_status = 'authorized' and test_order.status = 'test_processing'
        and test_order.gateway_payment_id = p_payment_id then
        update public.orders set test_attempt_checked_at = coalesce(p_checked_at, statement_timestamp())
          where id = test_order.id;
        result_state := 'processing';
      elsif test_order.status in ('test_failed', 'test_processing') then
        result_state := case test_order.status when 'test_failed' then 'failed' else 'processing' end;
      end if;
    end if;
  exception when unique_violation then
    -- The provider payment ID is already bound to another order.
    result_state := 'ignored';
  end;

  if p_event_id is not null then
    update public.payment_events set
      processed_at = case when result_state <> 'awaiting_verification' then clock_timestamp() end,
      outcome = result_state
    where gateway_event_id = p_event_id;
  end if;
  return result_state;
end;
$$;

revoke all on function public.record_razorpay_test_payment(text, text, integer, text, text, uuid, text, text, timestamptz)
  from public, anon, authenticated, service_role;
grant execute on function public.record_razorpay_test_payment(text, text, integer, text, text, uuid, text, text, timestamptz)
  to service_role;

-- Serialize the final retry decision with payment recording and publication.
create function public.authorize_razorpay_test_checkout(
  p_owner_id uuid, p_id uuid, p_expected_payment_id text
) returns boolean language plpgsql set search_path = '' as $$
declare
  target_invitation uuid;
begin
  select o.invitation_id into target_invitation from public.orders o
  where o.id = p_id and o.owner_id = p_owner_id;
  perform 1 from public.invitations i
  where i.id = target_invitation and i.owner_id = p_owner_id and i.status = 'draft'
  for update;
  if not found then return false; end if;
  update public.orders o set test_checkout_started_at = statement_timestamp()
  where o.id = p_id and o.owner_id = p_owner_id and o.invitation_id = target_invitation
    and o.test_entitlement is null and o.gateway_order_id is not null
    and o.gateway_payment_id is not distinct from p_expected_payment_id
    and o.status = case when p_expected_payment_id is null then 'test_created' else 'test_failed' end
    and (o.test_checkout_started_at is null
      or o.last_failed_at > o.test_checkout_started_at
      or o.test_checkout_started_at <= statement_timestamp() - interval '15 seconds');
  return found;
end;
$$;
revoke all on function public.authorize_razorpay_test_checkout(uuid, uuid, text)
  from public, anon, authenticated, service_role;
grant execute on function public.authorize_razorpay_test_checkout(uuid, uuid, text)
  to service_role;

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
      and o.status = 'test_verified' and o.test_entitlement = 'active') then
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
  select i.share_slug, t.registry_key, yugma_private.project_guest_invitation(i.data) ||
      case when t.registry_key = 'afterglow'
        and i.data #>> '{coverImage,src}' =
          'https://images.unsplash.com/photo-1754782540893-2122877f2975?auto=format&fit=crop&w=2400&q=80'
        and char_length(btrim(yugma_private.public_text(i.data #> '{coverImage,alt}') #>> '{}')) between 1 and 240
      then jsonb_build_object('coverImage', jsonb_strip_nulls(jsonb_build_object(
        'src', i.data #>> '{coverImage,src}',
        'alt', i.data #>> '{coverImage,alt}',
        'focalPosition', case
          when jsonb_typeof(i.data #> '{coverImage,focalPosition,x}') = 'number'
            and jsonb_typeof(i.data #> '{coverImage,focalPosition,y}') = 'number'
          then case
            when (i.data #>> '{coverImage,focalPosition,x}')::numeric between 0 and 1
              and (i.data #> '{coverImage,focalPosition,y}')::numeric between 0 and 1
            then jsonb_build_object(
              'x', i.data #> '{coverImage,focalPosition,x}',
              'y', i.data #> '{coverImage,focalPosition,y}')
          end
        end
      ))) else '{}'::jsonb end, i.schema_version, i.published_at
  from public.invitations i
  join public.templates t on t.id = i.template_id
  where i.share_slug = p_slug and i.status = 'published' and i.test_publication_title is null
    and exists (select 1 from public.orders o where (o.invitation_id, o.owner_id, o.template_id) =
      (i.id, i.owner_id, i.template_id) and o.status = 'captured');
$$;

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
  if invitation.schema_version <> 1 or (
    invitation.status <> 'draft' and
    (invitation.status <> 'published' or invitation.test_publication_title is null)
  ) then return 'missing'; end if;
  if not exists (select 1 from public.orders o join public.templates t on t.id = o.template_id
    where (o.invitation_id, o.owner_id, o.template_id) = (invitation.id, invitation.owner_id, invitation.template_id)
      and t.registry_key = 'afterglow' and o.status = 'test_verified'
      and o.test_entitlement = 'active') then return 'unpaid'; end if;
  if invitation.status = 'published' then return 'published'; end if;
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
      and o.owner_id = i.owner_id and o.template_id = i.template_id
      and o.status = 'test_verified' and o.test_entitlement = 'active');
$$;
