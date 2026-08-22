# FixIt — Multi-stage production Dockerfile.
# Non-root user, minimal runtime image, no secrets baked in.

# ─── Stage 1: Dependencies ───
FROM node:20-slim AS deps
WORKDIR /app
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
COPY package.json bun.lock* ./
COPY .npmrc* ./
RUN npm install --frozen-lockfile || npm install

# ─── Stage 2: Build ───
FROM node:20-slim AS builder
WORKDIR /app
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Generate Prisma client.
RUN npx prisma generate
# Build the Next.js application.
# NEXTAUTH_SECRET is required at build time for the auth config — use a dummy
# build-time value; the real secret is provided at runtime via environment.
ENV NEXTAUTH_SECRET=build-time-dummy-secret-not-used-at-runtime
ENV DATABASE_URL=file:/tmp/build.db
RUN npm run build

# ─── Stage 3: Runtime ───
FROM node:20-slim AS runner
WORKDIR /app

# Install openssl for Prisma + create non-root user.
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
RUN groupadd -r fixit && useradd -r -g fixit -s /bin/bash fixit

# Copy only production files.
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

# Create uploads directory.
RUN mkdir -p /app/uploads && chown fixit:fixit /app/uploads

USER fixit

EXPOSE 3000

ENV PORT=3000
ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0

# Health check.
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://localhost:3000/api/health/live').then(r=>r.ok?process.exit(0):process.exit(1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
