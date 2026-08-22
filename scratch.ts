import { db } from './src/lib/db';
async function main() {
  const users = await db.user.findMany({
    include: {
      customerProfile: true,
      technicianProfile: true
    }
  });
  console.log(JSON.stringify(users, null, 2));
}
main().catch(console.error).finally(() => db.$disconnect());
