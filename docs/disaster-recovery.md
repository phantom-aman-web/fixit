# FixIt — Disaster Recovery Strategy

> **Strategy document.** No automated backups, restores, or DR drills are
> configured in the demo environment today. This document defines the policy
> the operations team must implement before public launch.

## 1. Scope

This document covers recovery from:

- Database failure or data loss (PostgreSQL in staging/production).
- File storage failure or data loss (S3 or local uploads).
- Application server failure (process crash, host loss).
- Realtime service failure (socket.io mini-service on `:3003`).
- Region-wide outage (mitigation only; multi-region active-active is out of
  scope for v1).

It does **not** cover:

- Bug-induced data corruption (handled by code review + rollbacks + targeted
  data-fix scripts).
- Account compromise (handled by credential rotation + audit log review).
- Compliance / legal data requests.

## 2. Recovery objectives

| Objective | Target      | Notes                                                        |
|-----------|-------------|--------------------------------------------------------------|
| **RTO**   | 4 hours     | From incident declaration to full service restoration.       |
| **RPO**   | 1 hour      | Maximum acceptable data loss. Requires PITR or hourly snapshots. |
| **RTO** for realtime | 1 hour | Realtime is UX-only; DB is source of truth.       |

These targets assume a managed PostgreSQL provider with PITR capability
(AWS RDS, Supabase, Neon, Cloud SQL).

## 3. Backup strategy

### 3.1 Database (PostgreSQL)

| Backup type              | Frequency        | Retention    | Storage                          |
|--------------------------|------------------|--------------|----------------------------------|
| Logical (`pg_dump`)      | Daily at 02:00 UTC | 30 days    | Object storage (S3) + offsite copy. |
| Automated snapshot (managed) | Every 24 h (provider default) | 7–35 days (provider) | Provider-managed. |
| Point-in-time recovery (PITR) | Continuous (WAL archive) | 7 days | Provider-managed. |
| Pre-deployment snapshot  | Before every `prisma migrate deploy` | 30 days | Object storage. |

**Example daily logical backup script** (cron):

```bash
#!/usr/bin/env bash
set -euo pipefail

TS=$(date -u +%Y%m%dT%H%M%SZ)
BUCKET="s3://fixit-backups/postgres"
DUMP_FILE="/tmp/fixit_${TS}.dump"

pg_dump --format=custom --no-owner --no-privileges \
  --file="$DUMP_FILE" \
  "$DATABASE_URL"

# Upload with server-side encryption.
aws s3 cp "$DUMP_FILE" "${BUCKET}/fixit_${TS}.dump" \
  --sse aws:kms --sse-kms-key-id "$KMS_KEY_ID"

# Cleanup local.
rm "$DUMP_FILE"

# Prune local copies older than 30 days.
aws s3 ls "${BUCKET}/" | awk '{print $4}' | \
  while read -r f; do
    file_ts=$(echo "$f" | sed -n 's/fixit_\([0-9T]*Z\)\.dump/\1/p')
    if [[ -n "$file_ts" ]]; then
      cutoff=$(date -u -d '30 days ago' +%Y%m%dT%H%M%SZ)
      if [[ "$file_ts" < "$cutoff" ]]; then
        aws s3 rm "${BUCKET}/${f}"
      fi
    fi
  done
```

### 3.2 File storage (uploads)

| Storage type             | Strategy                                                |
|--------------------------|---------------------------------------------------------|
| S3 (production)          | Versioning enabled; cross-region replication (CRR) to a backup bucket; lifecycle policy: transition to Glacier after 90 days, delete after 1 year (configurable). |
| Local (dev only)         | `rsync` to a backup directory nightly. Disposable.      |

### 3.3 Configuration

- `.env` files are stored in a secret manager (AWS Secrets Manager, Doppler,
  Vault) — **not** in version control. The secret manager has its own backup.
- `prisma/migrations/` is in version control (git). The git repository is the
  source of truth for migrations; no separate backup is needed beyond the
  standard git remote + offsite mirror.

### 3.4 Audit logs

- `AuditLog` rows live in the application database. They are covered by the
  database backup strategy above.
- For compliance, consider exporting audit logs to a write-once object store
  (S3 with object lock) on a daily basis. Not implemented today.

## 4. Restore procedure

### 4.1 Restore the database from a `pg_dump` (custom format)

```bash
# 1. Declare an incident and stop the app to prevent writes during restore.
systemctl stop fixit

# 2. (Optional) Restore to a fresh DB to verify before switching.
dropdb --if-exists fixit_restored
createdb fixit_restored

# 3. Download the dump.
aws s3 cp "s3://fixit-backups/postgres/fixit_${TS}.dump" /tmp/

# 4. Restore.
pg_restore --dbname=fixit_restored --no-owner --no-privileges \
  --jobs=4 --clean --if-exists \
  /tmp/fixit_${TS}.dump

# 5. Verify row counts on critical tables.
psql fixit_restored -c "SELECT count(*) FROM \"User\";"
psql fixit_restored -c "SELECT count(*) FROM \"Booking\";"
psql fixit_restored -c "SELECT count(*) FROM \"Payment\" WHERE status='SUCCEEDED';"

# 6. Point the app at the restored DB and start.
export DATABASE_URL="postgresql://.../fixit_restored"
systemctl start fixit

# 7. Verify with the post-deploy checklist (docs/deployment.md §10).
```

### 4.2 Restore from a managed provider snapshot

Steps vary by provider. AWS RDS example:

1. AWS Console → RDS → Snapshots.
2. Select the snapshot → "Restore snapshot".
3. Choose a new instance identifier, instance class, and VPC.
4. Wait for the restore to complete (typically 5–30 min depending on size).
5. Update the application's `DATABASE_URL` to point at the new instance.
6. Restart the app.
7. Verify with the post-deploy checklist.

### 4.3 Point-in-time recovery (PITR)

Used when you need to recover to a specific moment (e.g. just before a
destructive migration was applied).

```bash
# AWS RDS example: restore to 5 minutes before the incident.
aws rds restore-db-instance-to-point-in-time \
  --source-db-instance-identifier fixit-prod \
  --target-db-instance-identifier fixit-restored \
  --restore-time 2025-01-15T13:55:00Z \
  --db-instance-class db.t3.medium
```

Then point the app at the restored instance.

### 4.4 Restore file storage

- **S3 with versioning:** enable on the bucket. To restore an deleted file,
  list object versions and copy the desired version back as the current
  version.
- **S3 with CRR:** if the primary bucket is lost, switch the app to the
  replica bucket by updating `STORAGE_BUCKET` (and region/key if needed).
- **Local (dev):** `rsync` from the backup directory.

### 4.5 Restore configuration

Secrets are restored from the secret manager's own backup procedure (per the
provider's docs). Git history is the backup for code + migrations.

## 5. Recovery scenarios

### 5.1 Application server crash

- The process supervisor (systemd / Docker / k8s) restarts the app.
- In-flight requests fail; clients see `NETWORK_ERROR` and the React Query
  retry logic handles re-fetching.
- No data loss — the database is the source of truth.
- **RTO: seconds to minutes.**

### 5.2 Database unreachable

- The app returns 503 / 500 on database-dependent routes.
- `/api/health` returns 503 (once implemented).
- The load balancer drains the instance.
- Operations team resolves the DB issue (provider incident, network, etc.).
- Once the DB is reachable, the app self-recovers.
- **RTO: depends on the DB provider.**
- **RPO: depends on the last successful commit (PITR target: 0–1 h).**

### 5.3 Database data loss (e.g. accidental `DROP TABLE`)

1. Declare an incident.
2. Stop the app (prevents new writes from conflicting with the restore).
3. Take a forensic snapshot of the current state (in case the drop was
   partial).
4. Restore from the most recent `pg_dump` or from PITR to a moment before the
   destructive action.
5. Verify row counts.
6. Restart the app.
7. Communicate to users if any data was lost beyond the RPO.
- **RTO: ≤ 4 hours.**
- **RPO: ≤ 1 hour (with PITR).**

### 5.4 Realtime service failure

- The socket.io mini-service on `:3003` becomes unavailable.
- The app continues to function — realtime is UX-only.
- `notifications.ts` and `state-machines.ts` swallow the `fetch` failure
  silently (realtime is best-effort).
- Users will not see live updates but will see fresh state on the next page
  load / React Query refetch (database is source of truth).
- On realtime service restart, the client reconnects automatically and
  invalidates all React Query caches (`src/hooks/use-realtime.ts`).
- **RTO: 1 hour (non-critical).**

### 5.5 Region outage

- v1 is single-region. A region outage is a major incident.
- Mitigation: maintain a warm standby in a second region with the database
  promoted from a cross-region read replica. **Not implemented today.**
- For v1, communicate the outage and restore when the region recovers.

## 6. Backup verification (restore tests)

Backups are useless if they cannot be restored. Run a restore test monthly:

1. Pick a recent backup at random.
2. Restore it to a fresh, isolated database instance.
3. Run a smoke test: count rows on critical tables, run a few read-only API
   calls.
4. Document the result (time to restore, any errors).
5. If restore fails, treat as a P1 incident and fix the backup process.

**Cadence:** monthly. **Owner:** operations team.

## 7. Retention policy

| Data type                | Retention    | Reason                                          |
|--------------------------|--------------|--------------------------------------------------|
| Daily database dumps     | 30 days      | Covers most "we noticed too late" scenarios.    |
| Managed DB snapshots     | 7–35 days (provider default) | Provider-managed.                |
| PITR (WAL)               | 7 days       | Most restore-to-point needs are within 7 days.  |
| Pre-deployment snapshots | 30 days      | Covers post-deploy incident rollback.           |
| File storage (S3)        | Lifetime of related record + 90 days in Glacier | See `docs/database-production.md` §11. |
| Audit logs               | 12 months    | Compliance + incident investigation.            |
| Server logs              | 30 days      | Operational debugging.                          |

## 8. Incident response roles

| Role                | Responsibility                                                 |
|---------------------|----------------------------------------------------------------|
| On-call engineer    | First responder. Declares incident, starts mitigation.         |
| Operations lead     | Owns the recovery. Coordinates restores + comms.               |
| Communications      | Owns user-facing comms (status page, in-app banner, email).    |
| Engineering manager | Owns post-incident review + action items.                      |

Post-incident review is mandatory for any incident with RTO > 1 hour or any
data loss. The review produces a written document + tracked action items.

## 9. What is NOT configured in the demo environment

This is a strategy document. None of the following exist today:

- No `pg_dump` cron job.
- No S3 lifecycle policy or CRR.
- No PITR configuration.
- No restore-test automation.
- No status page.
- No on-call rotation.
- No incident-response runbook beyond this document.

These are the operational tasks listed in
`docs/production-release-checklist.md`.
