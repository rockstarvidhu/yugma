begin;
insert into auth.users (id) values ('cb000000-0000-4000-8000-000000000001');

set local role authenticated;
do $$ begin
  if not exists (select 1 from pg_class c join pg_namespace ns on ns.oid=c.relnamespace
    where ns.nspname='yugma_private' and c.relname='razorpay_test_attempts'
      and c.relrowsecurity and not has_table_privilege(c.oid, 'SELECT,INSERT,UPDATE'))
    or has_function_privilege('public.reconcile_razorpay_test_attempts(uuid,text,jsonb,timestamptz)', 'EXECUTE')
  then raise exception 'Authenticated caller can read or reconcile private financial attempts'; end if;
end $$;

set local role service_role;
do $$
declare
  buyer constant uuid := 'cb000000-0000-4000-8000-000000000001';
  draft uuid;
  internal_order uuid;
  order_ref text;
  prior text;
  funding text;
  first_payment text;
  paid_at timestamptz;
  outcome text;
  n integer;
begin
  for n in 1..6 loop
    select id into strict draft from public.create_private_draft(buyer,'afterglow','{}');
    order_ref := 'order_AttemptMatrix' || n;
    prior := 'pay_PriorMatrix' || n;
    funding := 'pay_FundingMatrix' || n;
    outcome := case when n in (1,2) then 'revoked' else 'suspended' end;
    insert into public.orders(invitation_id,owner_id,template_id,amount_paise,gateway_order_id,status)
      select id,owner_id,template_id,89900,order_ref,'test_created' from public.invitations where id=draft;

    if public.record_razorpay_test_payment(order_ref,prior,89900,'INR','failed',buyer,null) <> 'failed'
    then raise exception 'Could not register a previous failed attempt'; end if;
    if n % 2 = 0 then
      if public.record_razorpay_test_payment(order_ref,funding,89900,'INR','captured',buyer,null) <> 'verified'
      then raise exception 'Verified capture before the other attempt did not fund order'; end if;
    end if;
    if public.record_razorpay_test_payment(order_ref,prior,89900,'INR','pending_review',null,
      'evt_attempt_matrix_' || n,repeat(n::text,64)) <> 'awaiting_verification'
    then raise exception 'Refund or dispute was not bound to its own attempt'; end if;
    -- Rows 5 and 6 keep unresolved dispute evidence open.
    if n <= 4 and public.record_razorpay_test_payment(order_ref,prior,89900,'INR',outcome,null,
      'evt_attempt_matrix_' || n,repeat(n::text,64)) <> outcome
    then raise exception 'Refund was not recorded on the separate attempt'; end if;
    if public.record_razorpay_test_payment(order_ref,funding,89900,'INR','captured',buyer,null) <> 'verified'
    then raise exception 'Other attempt restricted a clean capture'; end if;
    if n <= 4 and public.record_razorpay_test_payment(order_ref,prior,89900,'INR',outcome,null,
      'evt_attempt_matrix_' || n,repeat(n::text,64)) <> 'duplicate'
    then raise exception 'A duplicate refund did not converge'; end if;
    -- A delayed capture observation for the held attempt cannot replace the funder.
    if public.record_razorpay_test_payment(order_ref,prior,89900,'INR','captured',buyer,null) <> outcome
    then raise exception 'A held attempt was allowed to fund its order'; end if;
    if not exists (select 1 from public.orders where gateway_order_id=order_ref
      and gateway_payment_id=funding and test_entitlement='active' and test_capture_conflict_at is null)
      or not exists (select 1 from public.payment_events where gateway_event_id='evt_attempt_matrix_' || n
        and gateway_payment_id=prior)
    then raise exception 'Funding, entitlement, or financial provenance was not isolated'; end if;
    if public.publish_test_invitation(buyer,draft,1,'Wedding','attempt-matrix-' || n) <> 'published'
    then raise exception 'A properly funded invitation was denied publication'; end if;
  end loop;

  select id into strict draft from public.create_private_draft(buyer,'afterglow','{}');
  order_ref := 'order_AttemptConflict';
  insert into public.orders(invitation_id,owner_id,template_id,amount_paise,gateway_order_id,status)
    select id,owner_id,template_id,89900,order_ref,'test_created' from public.invitations where id=draft
    returning id into internal_order;
  if public.reconcile_razorpay_test_attempts(buyer,order_ref,'[
    {"id":"pay_FundingMatrix1","order_id":"order_AttemptConflict","amount":89900,"currency":"INR","status":"captured"},
    {"id":"pay_WrongOrder","order_id":"order_Different","amount":89900,"currency":"INR","status":"captured"},
    {"id":"pay_WrongAmount","order_id":"order_AttemptConflict","amount":1,"currency":"INR","status":"captured"},
    {"id":"pay_WrongCurrency","order_id":"order_AttemptConflict","amount":89900,"currency":"USD","status":"captured"}
  ]',statement_timestamp())->>'state' <> 'pending'
  then raise exception 'Mismatched attempts granted entitlement'; end if;
  if public.record_razorpay_test_payment(order_ref,'pay_OtherAuth',89900,'INR','authorized',buyer,null) <> 'processing'
    or public.authorize_razorpay_test_checkout(buyer,internal_order,'pay_OtherAuth')
    or public.publish_test_invitation(buyer,draft,1,'Wedding','attempt-conflict') <> 'unpaid'
  then raise exception 'Authorization granted payment or allowed checkout'; end if;
  if public.reconcile_razorpay_test_attempts(buyer,order_ref,'[
    {"id":"pay_ConflictZ","order_id":"order_AttemptConflict","amount":89900,"currency":"INR","status":"captured"},
    {"id":"pay_ConflictA","order_id":"order_AttemptConflict","amount":89900,"currency":"INR","status":"captured"}
  ]',statement_timestamp())->>'state' <> 'suspended'
  then raise exception 'Multiple eligible captures were not suspended atomically'; end if;
  select gateway_payment_id, verified_at into strict first_payment, paid_at from public.orders where id=internal_order;
  if first_payment <> 'pay_ConflictA'
    or (select count(*) from yugma_private.razorpay_test_attempts
      where order_id=internal_order and capture_verified_at is not null) <> 2
    or not exists (select 1 from public.orders where id=internal_order and test_capture_conflict_at is not null)
    or public.publish_test_invitation(buyer,draft,1,'Wedding','attempt-conflict') <> 'unpaid'
  then raise exception 'Capture conflict lost its flag, evidence, or safe entitlement'; end if;
  perform public.record_razorpay_test_payment(order_ref,first_payment,89900,'INR','revoked',buyer,null);
  perform public.record_razorpay_test_payment(order_ref,'pay_ConflictZ',89900,'INR','captured',buyer,null);
  if not exists (select 1 from public.orders where id=internal_order and status='test_verified'
    and gateway_payment_id=first_payment and verified_at=paid_at and test_entitlement='revoked')
  then raise exception 'A second capture implicitly replaced a revoked funding receipt'; end if;
end $$;
rollback;
