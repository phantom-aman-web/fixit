const { execSync } = require('child_process');

// Vercel Postgres provides POSTGRES_URL_NON_POOLING instead of DIRECT_URL.
// If DIRECT_URL is missing, we auto-fill it so Prisma doesn't crash during the build.
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
