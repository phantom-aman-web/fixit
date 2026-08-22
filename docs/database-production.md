# FixIt — Database Production Strategy

> FixIt was developed on SQLite via Prisma. The schema is intentionally
> relational and contains **no SQLite-specific types**, so the move to
> PostgreSQL is mechanical. This document describes the migration, backup, and
> rollback strategy.

## 1. Current state

- `prisma/schema.prisma` declares `provider = "sqlite"`.
- All enum-like columns are stored as `String` (SQLite has no native enums).
  Validity is enforced by Zod schemas in the service layer.
- The team has been using `prisma db push --accept-data-loss` (schema push),
  not `prisma migrate dev`. **There is no `prisma/migrations/` directory yet.**
- The dev DB file lives at `prisma/dev.db` (configurable via `DATABASE_URL`).

## 2. Why the schema is PostgreSQL-compatible

The schema uses only the following column types, all of which Prisma maps
identically to PostgreSQL:

| Prisma type      | SQLite            | PostgreSQL       |
|------------------|-------------------|------------------|
| `String`         | TEXT              | TEXT             |
| `Int`            | INTEGER           | INTEGER          |
| `BigInt`         | INTEGER           | BIGINT           |
| `Boolean`        | INTEGER (0/1)     | BOOLEAN          |
| `DateTime`       | TEXT (ISO 8601)   | TIMESTAMP(3)     |
| `Float`          | REAL              | DOUBLE PRECISION |
| `Json`           | TEXT (JSON str)   | JSONB            |
| `Bytes`          | BLOB              | BYTEA            |

No SQLite-only pragmas, no `WITHOUT ROWID`, no virtual tables, no
`INTEGER PRIMARY KEY` aliases. The only thing that changes between providers is
the `datasource` block in `schema.prisma`:

```prisma
datasource db {
  provider = "postgresql"     // ← was "sqlite"
  url      = env("DATABASE_URL")
}
```

## 3. Environment matrix

| Environment | Engine            | `DATABASE_URL` shape                                   | Purpose                                    |
|-------------|-------------------|--------------------------------------------------------|--------------------------------------------|
| Local dev   | SQLite            | `file:./prisma/dev.db`                                 | Default. Zero-config. Ephemeral, resettable. |
| Test        | SQLite (`:memory:`) or `file:./prisma/test.db` | `file::memory:?cache=shared` | Fast, isolated test runs.                  |
| Staging     | PostgreSQL        | `postgresql://user:pass@host:5432/fixit_staging`       | Mirror of production data shape.           |
| Production  | PostgreSQL        | `postgresql://user:pass@host:5432/fixit`               | Authoritative.                             |

**SQLite is for development only.** The README and `docs/phase-5-baseline-audit.md`
make this explicit. Staging and production must use PostgreSQL.

## 4. Initial migration (the one-time step)

This is the only destructive step in the migration. It must be done by a
developer with the schema in its final shape, against a clean PostgreSQL DB.

```bash
# 1. Switch the datasource provider.
# Edit prisma/schema.prisma:
#   datasource db { provider = "postgresql", url = env("DATABASE_URL") }

# 2. Point DATABASE_URL at the empty PostgreSQL database.
export DATABASE_URL="postgresql://user:pass@host:5432/fixit"

# 3. Generate the client for the new provider.
bunx prisma generate

# 4. Create the initial migration from the current schema.
bunx prisma migrate dev --name init

# 5. Verify the migration applies cleanly.
bunx prisma migrate status

# 6. Seed if needed.
bun run db:seed
```

After this, `prisma/migrations/` will exist and be committed. Subsequent schema
changes use `prisma migrate dev --name <change>` (dev) or `prisma migrate
diff` + `prisma migrate deploy` (CI/CD).

> ⚠️ **Data migration from the SQLite dev DB is out of scope.** The dev DB
> contains synthetic seed data only (see `prisma/seed/`). No production data
> has ever existed in SQLite.

## 5. Routine schema changes (after the initial migration)

### In development

```bash
# Edit prisma/schema.prisma, then:
bunx prisma migrate dev --name <descriptive_name>
```

This:
- Generates a new timestamped migration in `prisma/migrations/`.
- Applies it to the dev DB.
- Regenerates the Prisma client.

### In CI / staging / production

```bash
# Apply pending migrations only. Never generates new ones.
bunx prisma migrate deploy
```

`migrate deploy` is the **only** command that should run in CI/CD and on
production hosts. It is idempotent and fails loudly on drift.

## 6. Connection management

- `src/lib/db.ts` exports a single `PrismaClient` instance (cached on
  `globalThis` outside production to survive Next.js hot reloads).
- In production, the client logs only `error`-level events to keep noise low.
- Connection pool size is controlled by the `?connection_limit=` query
  parameter on `DATABASE_URL` (Prisma uses one pool per client). For a typical
  Next.js standalone server, `connection_limit=5–10` is a sensible default for
  a small Postgres instance.

```bash
# Example production DATABASE_URL with pool size and timeout.
DATABASE_URL="postgresql://user:pass@host:5432/fixit?connection_limit=10&pool_timeout=10"
```

## 7. Backup strategy

### PostgreSQL (staging + production)

- **Logical backup:** `pg_dump` daily, compressed, retained 30 days.
  ```bash
  pg_dump --format=custom --no-owner --no-privileges \
    --file="fixit_$(date -u +%Y%m%dT%H%M%SZ).dump" \
    "$DATABASE_URL"
  ```
- **Physical backup / snapshots:** enabled on the managed Postgres provider
  (e.g. AWS RDS automated backups, Supabase daily snapshots). Retention per the
  provider's policy.
- **Point-in-time recovery (PITR):** enable on the managed provider where
  available. Targets an RPO of ≤ 1 hour (see `docs/disaster-recovery.md`).

### SQLite (local dev only)

- The dev DB is disposable. If you want a snapshot:
  ```bash
  cp prisma/dev.db "prisma/dev_$(date -u +%Y%m%dT%H%M%SZ).db.bak"
  ```
- No automated backup is configured for the dev DB. Seed data can always be
  recreated with `bun run db:seed`.

## 8. Restore procedure

### PostgreSQL (from `pg_dump --format=custom`)

```bash
# 1. Stop the application to avoid writes during restore.
systemctl stop fixit   # or: docker stop fixit

# 2. Drop and recreate the target database (or restore to a fresh DB).
dropdb --if-exists fixit_restored
createdb fixit_restored

# 3. Restore the dump.
pg_restore --dbname=fixit_restored --no-owner --no-privileges \
  --jobs=4 fixit_YYYYMMDDTHHMMSSZ.dump

# 4. Point the application at the restored DB and start.
export DATABASE_URL="postgresql://.../fixit_restored"
systemctl start fixit
```

### Rollback a specific migration (development only)

```bash
# Mark a migration as rolled-back in the _prisma_migrations table.
# This does NOT undo schema changes — you must write a forward migration
# that reverts the changes.
bunx prisma migrate resolve --rolled-back <migration_name>
```

> `prisma migrate resolve --rolled-back` only updates Prisma's bookkeeping. It
> does not reverse schema changes. To actually undo a migration in production,
> author a new forward migration that performs the inverse DDL.

## 9. Rollback safety rules

1. **Never roll back a migration that drops columns without confirming the data
   is truly disposable.** Prefer additive changes (add column → backfill →
   deploy → drop old column in a follow-up release).
2. **Always test migrations against a staging database** that mirrors
   production data shape before applying to production.
3. **Always back up before `migrate deploy` in production.** `pg_dump` first,
   migrate second.
4. **Migrations run as part of the deploy pipeline**, not as part of the
   application runtime. The application should assume the schema is already at
   the expected version when it starts.

## 10. Indexes

The schema already includes the indexes needed for common queries
(`User.email @unique`, `CustomerProfile.userId @unique`,
`TechnicianProfile.userId @unique`, `Booking.customerId`,
`Booking.technicianId`, `RepairRequest.customerId`, `RepairRequest.technicianId`,
`Notification.userId`, etc.). After migrating to PostgreSQL, run:

```sql
-- Identify slow queries (PostgreSQL).
SELECT query, mean_exec_time, calls
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 20;
```

Add `@@index([...])` declarations to `schema.prisma` for any hot path that
shows up here, then `prisma migrate dev --name add_index_<table>`.

## 11. Data retention

| Data class                 | Retention              | Notes                                                  |
|----------------------------|------------------------|--------------------------------------------------------|
| User accounts              | Until user deletion    | Soft-delete is not implemented; deletion is hard.      |
| Audit logs                 | 12 months rolling      | Aggregate into monthly summaries if size becomes an issue. |
| AI usage records           | 90 days rolling        | Used for analytics + cost tracking.                    |
| Notifications              | 90 days rolling        | Old read notifications are prunable.                   |
| Repair job history         | Lifetime of warranty + 1 year | Warranties typically 3–12 months.                |
| Uploaded media (problem)   | Lifetime of related booking + 30 days | Then move to cold storage or delete.     |
| Verification documents     | Until technician account deletion | Sensitive PII — encrypt at rest in production. |

## 12. What is NOT configured in the demo environment

This is a strategy document. None of the following are wired up today:

- No PostgreSQL instance is configured. The running app uses SQLite.
- No `pg_dump` cron job exists.
- No PITR is configured.
- No `prisma/migrations/` directory exists yet (the initial migration must be
  generated per §4).
- No automated restore-test runs.

These are the production rollout tasks listed in
`docs/production-release-checklist.md`.
