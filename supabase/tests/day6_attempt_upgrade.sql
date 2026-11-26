begin;
set local role service_role;
do $$
declare
  buyer constant uuid := 'c6000000-0000-4000-8000-000000000001';
begin
  if not exists (select 1 from public.get_test_publication('pre-attempt-clean'))
    or not exists (select 1 from yugma_private.razorpay_test_attempts
      where gateway_payment_id='pay_PreAttemptClean' and capture_verified_at is not null)
    or not exists (select 1 from yugma_private.razorpay_test_attempts
      where gateway_payment_id='pay_PreAttemptAuth' and provider_state='authorized')
  then raise exception 'An established publication, capture, or authorization was lost'; end if;
  if (select count(*) from public.orders where gateway_order_id in ('order_PreAttempt2','order_PreAttempt3')
      and test_legacy_entitlement_hold) <> 2
    or exists (select 1 from public.payment_events where gateway_event_id in ('evt_pre_attempt_old','evt_pre_attempt_pending')
      and gateway_payment_id is not null)
    or exists (select 1 from yugma_private.razorpay_test_attempts
      where gateway_payment_id='pay_PreAttemptReal' and financial_hold is not null)
  then raise exception 'A historical hold was lost or incorrectly assigned to a known payment'; end if;

  if public.record_razorpay_test_payment('order_PreAttempt2','pay_PreAttemptReal',89900,'INR','captured',buyer,null)
    <> 'revoked'
    or public.record_razorpay_test_payment('order_PreAttempt3','pay_PreAttemptPending',89900,'INR','suspended',
      null,'evt_pre_attempt_pending',repeat('8',64)) <> 'suspended'
    or public.record_razorpay_test_payment('order_PreAttempt3','pay_PreAttemptVerified',89900,'INR','captured',buyer,null)
      <> 'suspended'
  then raise exception 'A retry removed an unattributed hold without operator reconciliation'; end if;
  if public.publish_test_invitation(buyer,'cc100000-0000-4000-8000-000000000002',1,'Wedding','historic-held-2') <> 'unpaid'
    or public.publish_test_invitation(buyer,'cc100000-0000-4000-8000-000000000003',1,'Wedding','historic-held-3') <> 'unpaid'
  then raise exception 'A legacy hold did not protect the guest boundary'; end if;
end $$;
rollback;
