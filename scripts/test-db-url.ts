import { PrismaClient } from '@prisma/client';

async function main() {
  const prisma = new PrismaClient();
  try {
    const start = Date.now();
    const count = await prisma.user.count();
    const duration = Date.now() - start;
    console.log(`[PASS] DATABASE_URL (6543): connected in ${duration}ms, user count=${count}`);
  } catch (e: any) {
    console.error(`[FAIL] DATABASE_URL (6543):`, e.message);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(console.error);
