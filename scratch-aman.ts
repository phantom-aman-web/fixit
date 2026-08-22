import { db } from './src/lib/db';
async function main() {
  const users = await db.user.findMany({
    include: { customerProfile: true }
  });
  console.log("Total users:", users.length);
  for (const u of users) {
    if (u.name?.toLowerCase().includes('aman') || u.email.toLowerCase().includes('aman')) {
      console.log('Found:', u.id, u.email, u.name, u.role, 'Has Profile:', !!u.customerProfile);
    }
  }
}
main().catch(console.error).finally(() => db.$disconnect());
