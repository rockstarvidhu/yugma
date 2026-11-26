#!/usr/bin/env bash
# Run only against the workflow's disposable PostgreSQL fixture container.
set -euo pipefail
: "$DB_CONTAINER"

sql() {
  docker exec -i "$DB_CONTAINER" psql -XqAt -U postgres -v ON_ERROR_STOP=1 "$@"
}

owner=d1000000-0000-4000-8000-000000000001
draft=d2000000-0000-4000-8000-000000000001
order=order_ConcurrentFixture
payment=pay_ConcurrentFixture
event=evt_ConcurrentFixture
tmp_dir=$(mktemp -d)
trap 'rmdir "$tmp_dir" 2>/dev/null || true' EXIT

sql <<SQL
insert into auth.users (id) values ('$owner');
insert into public.invitations (id,owner_id,template_id,data)
  select '$draft','$owner',id,'{}' from public.templates where registry_key='afterglow';
insert into public.orders (invitation_id,owner_id,template_id,amount_paise,gateway_order_id,status)
  select id,owner_id,template_id,89900,'$order','test_created' from public.invitations where id='$draft';
SQL

pids=()
for index in 1 2 3 4 5 6; do
  sql -c "set role service_role; select public.record_razorpay_test_payment('$order','$payment',89900,'INR','captured','$owner',null)" > "$tmp_dir/callback-$index" &
  pids+=("$!")
  sql -c "set role service_role; select public.record_razorpay_test_payment('$order','$payment',89900,'INR','captured',null,'$event',repeat('a',64))" > "$tmp_dir/webhook-$index" &
  pids+=("$!")
done
for pid in "${pids[@]}"; do wait "$pid"; done
test "$(grep -hlx verified "$tmp_dir"/callback-* | wc -l | tr -d ' ')" = 6
test "$(grep -hlx verified "$tmp_dir"/webhook-* | wc -l | tr -d ' ')" = 1
test "$(grep -hlx duplicate "$tmp_dir"/webhook-* | wc -l | tr -d ' ')" = 5
test "$(sql -c "select count(*) from public.orders where invitation_id='$draft' and status='test_verified' and gateway_payment_id='$payment'")" = 1
test "$(sql -c "select count(*) from public.payment_events where gateway_event_id='$event' and outcome='verified' and processed_at is not null")" = 1

pids=()
for index in 1 2 3 4 5 6 7 8; do
  sql -c "set role service_role; select public.publish_test_invitation('$owner','$draft',1,'Fictional wedding','concurrent-fixture-$index')" > "$tmp_dir/publish-$index" &
  pids+=("$!")
done
for pid in "${pids[@]}"; do wait "$pid"; done
test "$(grep -hlx published "$tmp_dir"/publish-* | wc -l | tr -d ' ')" = 8
test "$(sql -c "select count(*) from public.invitations where id='$draft' and version=2 and status='published' and share_slug ~ '^concurrent-fixture-[1-8]$'")" = 1

slug=$(sql -c "select share_slug from public.invitations where id='$draft'")
# Readers begun during the uncommitted refund can see the previously committed
# snapshot. A repeat publication queues behind it, and new readers are denied.
sql -c "set application_name='yugma-refund-race'; begin; set local role service_role;
  select public.record_razorpay_test_payment('$order','$payment',89900,'INR','suspended','$owner',null);
  select pg_sleep(3); commit" > "$tmp_dir/refund" &
refund_pid=$!
for attempt in {1..60}; do
  if [[ $(sql -c "select count(*) from pg_stat_activity where application_name='yugma-refund-race' and wait_event='PgSleep'") == 1 ]]; then break; fi
  sleep 0.05
done
test "$attempt" -lt 60
test "$(sql -c "set role service_role; select count(*) from public.get_test_publication('$slug')")" = 1
test "$(sql -c "set role service_role; select public.publish_test_invitation('$owner','$draft',2,'Fictional wedding','$slug')")" = unpaid
wait "$refund_pid"
test "$(sql -c "set role service_role; select count(*) from public.get_test_publication('$slug')")" = 0
test "$(sql -c "select share_slug from public.invitations where id='$draft'")" = "$slug"

attempt_draft=d2000000-0000-4000-8000-000000000002
sql <<SQL
insert into public.invitations (id,owner_id,template_id,data)
  select '$attempt_draft','$owner',id,'{}' from public.templates where registry_key='afterglow';
insert into public.orders (invitation_id,owner_id,template_id,amount_paise,gateway_order_id,status)
  select id,owner_id,template_id,89900,'order_RaceAttempts','test_created' from public.invitations where id='$attempt_draft';
SQL

sql -c "set role service_role;
  select public.record_razorpay_test_payment('order_RaceAttempts','pay_RacePrior',89900,'INR','pending_review',null,'evt_attempt_race_refund',repeat('d',64));
  select public.record_razorpay_test_payment('order_RaceAttempts','pay_RacePrior',89900,'INR','revoked',null,'evt_attempt_race_refund',repeat('d',64))" > "$tmp_dir/attempt-refund" &
attempt_refund_pid=$!
sql -c "set role service_role;
  select public.record_razorpay_test_payment('order_RaceAttempts','pay_RaceFunding',89900,'INR','captured','$owner',null)" > "$tmp_dir/attempt-funding" &
attempt_funding_pid=$!
wait "$attempt_refund_pid"
wait "$attempt_funding_pid"
grep -Fxq revoked "$tmp_dir/attempt-refund"
grep -Fxq verified "$tmp_dir/attempt-funding"
test "$(sql -c "select count(*) from public.orders where invitation_id='$attempt_draft' and test_entitlement='active' and gateway_payment_id='pay_RaceFunding'")" = 1
test "$(sql -c "select count(*) from yugma_private.razorpay_test_attempts where gateway_payment_id='pay_RacePrior' and financial_hold='revoked'")" = 1

sql <<SQL
delete from public.payment_events where gateway_event_id in ('$event','evt_attempt_race_refund');
delete from public.orders where gateway_order_id in ('$order','order_RaceAttempts');
delete from public.invitations where id in ('$draft','$attempt_draft');
delete from auth.users where id='$owner';
SQL
find "$tmp_dir" -type f -delete
echo "Twelve fulfilment calls, eight publication calls and concurrent same- and cross-attempt refund checks passed"
