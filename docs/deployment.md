# FixIt — Deployment Guide

> How to build, migrate, configure, and run FixIt in production. This document
> reflects the **actual** build configuration in `package.json` and
> `next.config.ts`, and lists the env vars expected by `src/lib/env.ts`.

## 1. Build pipeline

### 1.1 Install dependencies

```bash
bun install
```

### 1.2 Generate the Prisma client

```bash
bunx prisma generate
```

This must run after every `prisma/schema.prisma` change. The generated client
is checked into `.gitignore` and is rebuilt on every install.

### 1.3 Production build

The `build` script in `package.json` is:

```bash
next build && cp -r .next/static .next/standalone/.next/ && cp -r public .next/standalone/
```

`next.config.ts` sets `output: "standalone"`, which produces a self-contained
`.next/standalone/server.js` plus the static assets. The build script then
copies `.next/static` and `public/` into the standalone directory so the
output is fully self-contained.

```bash
bun run build
```

> ⚠️ `next.config.ts` has `typescript.ignoreBuildErrors: true`. This was set
> during development to avoid blocking the build on TypeScript errors that
> exist in third-party typings. **For a production release, set this back to
> `false`** and resolve any remaining type errors before building.

### 1.4 Run migrations (PostgreSQL only)

```bash
bunx prisma migrate deploy
```

`migrate deploy` only applies existing migrations — it never generates new
ones. This is the only migration command that should run in production.

For SQLite dev, the team uses `prisma db push` instead (see
`docs/database-production.md`).

### 1.5 Start the production server

The `start` script in `package.json` is:

```bash
NODE_ENV=production bun .next/standalone/server.js 2>&1 | tee server.log
```

```bash
bun run start
```

The server listens on port 3000 by default (override with `PORT`).

### 1.6 Start the realtime mini-service

The socket.io mini-service runs as a separate process on port 3003
(`mini-services/realtime/index.ts`):

```bash
cd mini-services/realtime
bun install
bun run index.ts
```

In production, run this as its own systemd unit / container. It must be
reachable from the Next.js API layer at `http://127.0.0.1:3003` (or override
the URL in `src/services/notifications.ts` and `src/services/state-machines.ts`
via env if you run them on different hosts).

## 2. Environment variables

All variables are read by `src/lib/env.ts`. Missing critical variables throw
at startup in production (`NODE_ENV=production`).

### Required (critical)

| Variable            | Example                                            | Notes                                   |
|---------------------|----------------------------------------------------|-----------------------------------------|
| `DATABASE_URL`      | `postgresql://u:p@host:5432/fixit`                 | Production must be PostgreSQL.          |
| `NEXTAUTH_SECRET`   | 32+ random bytes                                   | Used to sign JWTs. Rotate periodically. |
| `NEXTAUTH_URL`      | `https://fixit.example.com`                        | Canonical HTTPS URL.                    |
| `AI_PROVIDER`       | `zai`                                              | Only `zai` is implemented.              |
| `PAYMENT_PROVIDER`  | `stripe` / `chapa` (not `mock` in prod)            | Mock is dev-only.                       |
| `STORAGE_PROVIDER`  | `s3` (not `local` in prod)                         | Local is dev-only.                      |
| `EMAIL_PROVIDER`    | `smtp` / `ses` (not `console` in prod)             | Console is dev-only.                    |

### Provider-specific

| Variable                          | When needed                       |
|-----------------------------------|------------------------------------|
| `AI_API_KEY`                      | Always (z-ai-web-dev-sdk needs it). |
| `AI_MODEL`, `AI_BASE_URL`         | Optional override.                 |
| `PAYMENT_API_KEY`                 | If real payments.                  |
| `PAYMENT_WEBHOOK_SECRET`          | If real payments (webhook verify). |
| `STORAGE_BUCKET`, `STORAGE_REGION`, `STORAGE_ACCESS_KEY`, `STORAGE_SECRET_KEY` | If `s3`. |
| `UPLOAD_DIR`                      | If `local` (default `./uploads`).  |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `EMAIL_FROM` | If `smtp`. |
| `LOCATION_PROVIDER`               | `demo` (dev) / `production`.       |

### Optional

| Variable              | Default     | Notes                                                |
|-----------------------|-------------|------------------------------------------------------|
| `REALTIME_PORT`       | `3003`      | Socket.io mini-service port.                          |
| `LOG_LEVEL`           | `info` (prod) / `debug` (dev) | See `docs/logging.md`. |
| `SENTRY_DSN`          | —           | Read by `env.ts` but not yet wired into the runtime. |
| `AI_FEATURES_ENABLED` | `true`      | Toggle AI features.                                  |

### Example production `.env`

```bash
NODE_ENV=production
DATABASE_URL=postgresql://fixit:strongpassword@db.internal:5432/fixit
NEXTAUTH_SECRET=__generate_with_openssl_rand_hex_32__
NEXTAUTH_URL=https://fixit.example.com

AI_PROVIDER=zai
AI_API_KEY=__zai_key__

PAYMENT_PROVIDER=chapa
PAYMENT_API_KEY=__chapa_key__
PAYMENT_WEBHOOK_SECRET=__webhook_secret__

STORAGE_PROVIDER=s3
STORAGE_BUCKET=fixit-uploads
STORAGE_REGION=eu-central-1
STORAGE_ACCESS_KEY=__key__
STORAGE_SECRET_KEY=__secret__

EMAIL_PROVIDER=smtp
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=fixit@example.com
SMTP_PASSWORD=__smtp_password__
EMAIL_FROM=FixIt <noreply@fixit.example.com>

LOCATION_PROVIDER=demo
LOG_LEVEL=info
REALTIME_PORT=3003
```

> Use a real secret manager (AWS Secrets Manager, Doppler, Vault) in production
> rather than committing `.env` files. The `.env` file is for local dev only
> and is gitignored.

## 3. Health checks

There is **no `/api/health` endpoint today**. `GET /api` returns
`{ "message": "Hello, world!" }` which is not a real health check.

For production, add `src/app/api/health/route.ts`:

```ts
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getEnvConfig, validateProductionReadiness } from "@/lib/env";

export async function GET() {
  const checks: Record<string, any> = {};

  // Database
  try {
    await db.$queryRaw`SELECT 1`;
    checks.database = "ok";
  } catch (e) {
    checks.database = "fail";
    return NextResponse.json({ status: "unhealthy", checks }, { status: 503 });
  }

  // Realtime (best-effort)
  try {
    const r = await fetch("http://127.0.0.1:3003/", { method: "GET" });
    checks.realtime = r.ok || r.status === 404 ? "ok" : "degraded";
  } catch {
    checks.realtime = "unreachable";
  }

  // Config readiness
  checks.readiness = validateProductionReadiness();

  return NextResponse.json({ status: "healthy", checks, env: getEnvConfig().nodeEnv });
}
```

Use `GET /api/health` for:
- Container/liveness probes (return 200 if the process is alive and the DB
  is reachable; 503 otherwise).
- Load balancer health checks.
- Deployment verification (curl right after deploy).

## 4. Graceful shutdown

The Next.js standalone server and the realtime mini-service both need clean
shutdown to avoid cutting off in-flight requests.

### Realtime mini-service

`mini-services/realtime/index.ts` already handles `SIGTERM` and `SIGINT`:

```ts
process.on("SIGTERM", () => httpServer.close(() => process.exit(0)));
process.on("SIGINT", () => httpServer.close(() => process.exit(0)));
```

### Next.js standalone server

Next.js handles `SIGTERM` by stopping to accept new connections and finishing
in-flight requests. For orchestrators (k8s, ECS), use a pre-stop hook that
sends `SIGTERM`, waits 10–30 s, then `SIGKILL`.

### Recommended pattern (systemd unit example)

```ini
[Service]
WorkingDirectory=/opt/fixit
EnvironmentFile=/opt/fixit/.env
ExecStart=/usr/bin/bun /opt/fixit/.next/standalone/server.js
Restart=on-failure
RestartSec=5
KillSignal=SIGTERM
TimeoutStopSec=30
```

## 5. Docker (multi-stage build)

There is **no Dockerfile today**. Below is the recommended production setup.
It uses multi-stage builds to keep the final image small.

```dockerfile
# ─── Stage 1: deps ────────────────────────────────────────────────────────
FROM oven/bun:1.3 AS deps
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

# ─── Stage 2: build ───────────────────────────────────────────────────────
FROM oven/bun:1.3 AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN bunx prisma generate
RUN bun run build

# ─── Stage 3: runner ──────────────────────────────────────────────────────
FROM oven/bun:1.3-slim AS runner
WORKDIR /app
ENV NODE_ENV=production

# Don't run as root.
RUN addgroup --system --gid 1001 nodejs \
 && adduser --system --uid 1001 nextjs
USER nextjs

# Copy standalone build.
COPY --from=build --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=build --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=build --chown=nextjs:nodejs /app/public ./public

# Prisma needs its engine binaries.
COPY --from=build --chown=nextjs:nodejs /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build --chown=nextjs:nodejs /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=build --chown=nextjs:nodejs /app/prisma ./prisma

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Health check (assumes /api/health is implemented).
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD curl -fsS http://localhost:3000/api/health || exit 1

CMD ["bun", "server.js"]
```

### docker-compose.yml (illustrative)

```yaml
version: "3.9"
services:
  app:
    build: .
    env_file: .env
    ports:
      - "3000:3000"
    depends_on:
      - db
      - realtime
    restart: unless-stopped

  realtime:
    build:
      context: .
      dockerfile: mini-services/realtime/Dockerfile
    env_file: .env
    ports:
      - "3003:3003"
    restart: unless-stopped

  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: fixit
      POSTGRES_USER: fixit
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - pgdata:/var/lib/postgresql/data
    restart: unless-stopped

volumes:
  pgdata:
```

> The realtime service does not have its own Dockerfile today — you would
> create a small one (oven/bun + the `mini-services/realtime` directory).

## 6. CI/CD (recommended pattern)

There is **no CI workflow today**. The recommended pattern:

1. **On PR:**
   - `bun install --frozen-lockfile`
   - `bunx prisma generate`
   - `bun run lint`
   - `bunx tsc --noEmit`
   - `bun run build` (verify the build succeeds)
2. **On merge to main:**
   - Build the Docker image, push to registry.
   - Deploy to staging. Run `prisma migrate deploy` as a pre-deploy step.
   - Run smoke tests against staging (curl `/api/health`, run a few API calls).
3. **On release tag:**
   - Promote the staging image to production.
   - Run `prisma migrate deploy` (with a pre-migration `pg_dump`).
   - Run the production release checklist
     (`docs/production-release-checklist.md`).

> ⚠️ `next.config.ts` has `typescript.ignoreBuildErrors: true`. Remove this
> before enabling `tsc --noEmit` as a CI gate, or the gate will not catch
> type errors.

## 7. Reverse proxy (Caddy)

The dev environment uses a Caddyfile that routes by `?XTransformPort=` query
parameter to forward to `:3000` (app) or `:3003` (realtime). For production,
use a proper reverse proxy with TLS termination:

```caddy
fixit.example.com {
    encode gzip zstd

    # Realtime websocket.
    @realtime query XTransformPort=3003
    handle @realtime {
        reverse_proxy localhost:3003
    }

    # Static + API.
    handle {
        reverse_proxy localhost:3000
    }
}
```

For a real production domain, also add:
- TLS via Let's Encrypt (`tls you@email.com`).
- A `Content-Security-Policy` header.
- Strict `X-Frame-Options: DENY` and `X-Content-Type-Options: nosniff`.

## 8. Never run the dev server in production

`bun run dev` (`next dev`) is for development only. It:
- Disables many production optimizations.
- Rebuilds on every file change (slow, leaky).
- Has verbose logging.
- Is not optimized for concurrency.

Production must run the standalone server built by `bun run build`. The
`start-dev.sh` wrapper that auto-restarts the dev server on OOM is a
**development-only** workaround for the constrained sandbox memory and must
not be used in production.

## 9. Process topology in production

```
┌────────────────────────────────────────────────────────────────────┐
│                      Load balancer (TLS, 443)                       │
└──────────────┬─────────────────────────────────────┬───────────────┘
               │                                     │
       ┌───────▼────────┐                   ┌───────▼────────┐
       │  Next.js app    │                   │  Next.js app    │
       │  :3000 (n ×)    │                   │  :3000 (n ×)    │
       └───────┬────────┘                   └───────┬────────┘
               │                                     │
               └──────────────┬──────────────────────┘
                              │
                       ┌──────▼──────┐
                       │ PostgreSQL  │
                       └─────────────┘
                              │
                       ┌──────▼──────┐
                       │  S3 bucket  │  (uploads)
                       └─────────────┘

       Realtime is a separate process (single instance is enough):
       ┌─────────────────┐
       │  socket.io :3003 │
       └─────────────────┘
       (Reached by the app via http://127.0.0.1:3003/emit.)
```

For multi-instance app deployment:
- The in-memory rate limiters will be per-instance. Swap to Redis/Upstash
  (`docs/phase-5-baseline-audit.md` §13).
- The mock payment intent map is per-instance — not a concern once a real
  provider is wired (provider state is external).
- Session strategy is JWT (stateless), so any instance can serve any request.

## 10. Post-deploy verification checklist

Run these immediately after every production deploy:

1. `curl -fsS https://fixit.example.com/api/health` → 200, `status: "healthy"`,
   `checks.database: "ok"`.
2. `curl -fsS https://fixit.example.com/api/equipment-categories` → 200 with
   category list.
3. Log in as the seeded admin (rotate the seeded password immediately in
   production). Verify `/api/admin/analytics` returns 200.
4. Verify `prisma migrate status` reports no pending migrations.
5. Tail `server.log` for 60 s and confirm no error spikes.
6. Trigger a realtime event (e.g.Booking transition) and confirm the customer's
   browser receives it.
