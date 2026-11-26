-- Seed the schema that stored holds at order level, before the forward fix.
insert into public.invitations (id,owner_id,template_id,data)
select ('cc100000-0000-4000-8000-00000000000' || n)::uuid,
  'c6000000-0000-4000-8000-000000000001', t.id, '{}'
from public.templates t cross join generate_series(1,4) n where t.registry_key='afterglow';
insert into public.orders (invitation_id,owner_id,template_id,amount_paise,gateway_order_id,status)
select id,owner_id,template_id,89900,'order_PreAttempt' || right(id::text,1),'test_created'
from public.invitations where left(id::text,8)='cc100000';

select public.record_razorpay_test_payment('order_PreAttempt1','pay_PreAttemptClean',89900,'INR','captured',
  'c6000000-0000-4000-8000-000000000001',null);
select public.publish_test_invitation('c6000000-0000-4000-8000-000000000001',
  'cc100000-0000-4000-8000-000000000001',1,'Clean publication','pre-attempt-clean');

select public.record_razorpay_test_payment('order_PreAttempt2','pay_PreAttemptOld',89900,'INR','revoked',
  null,'evt_pre_attempt_old',repeat('7',64));
select public.record_razorpay_test_payment('order_PreAttempt2','pay_PreAttemptReal',89900,'INR','captured',
  'c6000000-0000-4000-8000-000000000001',null);
select public.record_razorpay_test_payment('order_PreAttempt3','pay_PreAttemptPending',89900,'INR','pending_review',
  null,'evt_pre_attempt_pending',repeat('8',64));
select public.record_razorpay_test_payment('order_PreAttempt4','pay_PreAttemptAuth',89900,'INR','authorized',
  'c6000000-0000-4000-8000-000000000001',null);
