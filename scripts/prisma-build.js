const { execSync } = require('child_process');

// Vercel Postgres provides POSTGRES_PRISMA_URL and POSTGRES_URL_NON_POOLING.
// If DATABASE_URL or DIRECT_URL are missing, we auto-fill them so Prisma doesn't crash.
if (!process.env.DATABASE_URL && process.env.POSTGRES_PRISMA_URL) {
  process.env.DATABASE_URL = process.env.POSTGRES_PRISMA_URL;
  console.log("Auto-configured DATABASE_URL using Vercel Postgres URL.");
}

if (!process.env.DIRECT_URL) {
  if (process.env.POSTGRES_URL_NON_POOLING) {
    process.env.DIRECT_URL = process.env.POSTGRES_URL_NON_POOLING;
    console.log("Auto-configured DIRECT_URL using Vercel Postgres non-pooling URL.");
  } else if (process.env.DATABASE_URL) {
    process.env.DIRECT_URL = process.env.DATABASE_URL;
    console.log("Auto-configured DIRECT_URL using DATABASE_URL (assuming no pooler).");
  }
}

try {
  console.log("Running prisma generate...");
  execSync("npx prisma generate", { stdio: 'inherit' });
  
  console.log("Running prisma db push...");
  execSync("npx prisma db push --accept-data-loss", { stdio: 'inherit' });
} catch (error) {
  console.error("Prisma database sync failed");
  process.exit(1);
}
