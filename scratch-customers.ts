import { db } from './src/lib/db';
async function main() {
  const users = await db.user.findMany({
    include: { customerProfile: true }
  });
  for (const u of users) {
    if (u.role === 'CUSTOMER' && !u.customerProfile) {
      console.log('CUSTOMER NO PROFILE:', u.email);
    }
  }
  console.log('Done.');
}
main().catch(console.error);
