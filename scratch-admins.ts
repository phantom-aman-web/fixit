import { db } from './src/lib/db';
async function main() {
  const users = await db.user.findMany({
    where: { role: 'ADMIN' },
    include: { customerProfile: true }
  });
  console.log('ADMINS:', users);
}
main().catch(console.error).finally(() => db.$disconnect());
