# Day 3 draft verification and recovery

The draft API uses verified sign-in, owner-scoped reads, and the existing service-only conditional write. The database updates `version` and `updated_at` on each accepted write. PUT and PATCH both reject invalid or privileged fields with HTTP 400. See the [Studio API contract](private-draft-api.md) for how the editor should merge fields and recover from conflicts.

## Migration and restore drill

On November 22, 2026, a clean disposable PostgreSQL 16.16 instance applied the fixture roles and then ran the three migrations below.

1. `20261119000000_auth_drafts.sql` created the draft, access, payment, and publication foundation.
2. `20261120000000_secure_private_drafts.sql` moved writes behind the service-only create and save functions.
3. `20261120235900_razorpay_test_checkout.sql` gave test payments their own statuses, separate from captured payments required for publication.

The source passed `supabase/tests/auth_drafts.sql`. The drill saved a fictional Afterglow draft at version 2 with two ceremonies at the two different occurrences of 01:15 during the Europe/London fall transition. It exported a 21,247-byte schema and a 28,932-byte custom backup, then restored into a second empty database. The full draft row fingerprint matched, including content, owner and template references, timestamps, versions, and private status. The authorization suite passed again on the restored database, including owner-only access, anonymous denial, cross-account denial, direct-write denial, publication projection checks, and withdrawal of public access after a refund.

Two live database connections also loaded a fresh draft at version 1. The first connection saved version 2 and held its transaction open while the second attempted to save version 1. The second update affected zero rows and the first connection's content remained intact. The HTTP route test checks that the second client receives 409, can reload version 2, and can retry with a new save.

A loopback smoke test of the production build returned 401 with private, non-cacheable responses for anonymous draft reads and updates. Anonymous Studio access redirected to sign-in, the unpublished invitation URL returned 404, and the Afterglow demo retained its watermark. The authenticated route tests use a test double for Supabase Auth and the store. The PostgreSQL rehearsal verifies the real permissions and writes separately.

The [database CI job](../../.github/workflows/ci.yml) repeats this drill. To reproduce it locally, use a disposable PostgreSQL 16 cluster with scratch-only connection settings. Bootstrap the fixture roles once per cluster. Keep the dump files outside the repository.

```bash
set -e
createdb --template=template0 yugma_source
psql -X -v ON_ERROR_STOP=1 -d yugma_source -1 -f supabase/fixtures/test-auth.sql
for migration in supabase/migrations/*.sql; do
  psql -X -v ON_ERROR_STOP=1 -d yugma_source -1 -f "$migration"
done
psql -X -v ON_ERROR_STOP=1 -d yugma_source -f supabase/tests/auth_drafts.sql
backup_dir=$(mktemp -d)
psql -XqAt -v ON_ERROR_STOP=1 -d yugma_source -v seed_backup_fixture=1 -f supabase/tests/draft_backup.sql > "$backup_dir/source.fingerprint"
pg_dump --schema-only -f "$backup_dir/schema.sql" yugma_source
pg_dump --format=custom -f "$backup_dir/drafts.backup" yugma_source
createdb --template=template0 yugma_restore
pg_restore --exit-on-error --single-transaction --dbname=yugma_restore "$backup_dir/drafts.backup"
psql -XqAt -v ON_ERROR_STOP=1 -d yugma_restore -v seed_backup_fixture=0 -f supabase/tests/draft_backup.sql > "$backup_dir/restored.fingerprint"
diff -u "$backup_dir/source.fingerprint" "$backup_dir/restored.fingerprint"
psql -X -v ON_ERROR_STOP=1 -d yugma_restore -f supabase/tests/auth_drafts.sql
```

## Production constraints and rollback

- Day 3 adds no database migration. An application rollback restores the previous PATCH snapshot contract. Coordinate with any editor already sending partial PATCHes before reverting, or retain the API fix and roll forward. Verify draft reads and saves after deploying either revision.
- Confirm the hosted migration history against all three repository versions before applying pending migrations. The previous staging work recorded SQL Editor application for the first two. For recovery from an existing migration issue, restore into a separate test project first and verify RLS, draft versions, foreign keys, and checkout state before moving traffic or data.
- The production Supabase plan, restore point, and recovery objectives were unverified. Supabase's Free plan requires separately scheduled logical exports for off-site recovery. Its daily backup retention is 7 days for Pro, 14 for Team, and up to 30 for Enterprise. Point-in-time recovery is an add-on for eligible paid projects. Database backups include Storage metadata. Stored file bytes and custom role passwords need separate recovery arrangements. [Supabase backup documentation](https://supabase.com/docs/guides/platform/backups)
- This drill used fixture Auth roles and local PostgreSQL. A hosted disaster recovery exercise must also verify Auth settings and roles, migration history, storage objects, and application secrets using that environment's approved recovery process.

## Frontend integration review

The review covered the merged catalogue and Afterglow personalization preview from PR #16. The preview uses the shared invitation schema, carries multiple events through the renderer, and displays times in the invitation's IANA timezone. Existing tests cover skipped and repeated DST times, watermark persistence in the client-only preview, and safe directions links. The preview clears a saved maps link when fictional venue details change. A persisted editor using PATCH must explicitly update or remove a stale link using the contract above.

The Studio detail route serves test checkout today. No pushed Day 3 editor branch was available for review. Once the editor is available, verify the authenticated two-event edit, save, and reload flow, the private watermarked preview, the conflict recovery UI, and that a late response cannot overwrite the active draft. The public invitation web route is scheduled for a later slice. The database exposes a read-only published projection with a captured-payment gate.
