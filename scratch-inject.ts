import { db } from './src/lib/db';
async function main() {
  const admin = await db.user.findUnique({ where: { email: 'admin@fixit.demo' } });
  if (admin) {
    const cp = await db.customerProfile.upsert({
      where: { userId: admin.id },
      create: { userId: admin.id, phone: "+0000000000", city: "Admin City" },
      update: {}
    });
    const tp = await db.technicianProfile.upsert({
      where: { userId: admin.id },
      create: { userId: admin.id, displayName: "Admin Tech", status: "ACTIVE", verified: true },
      update: {}
    });
    console.log("Injected mock profiles for admin:", cp.id, tp.id);
  }
}
main().catch(console.error).finally(() => db.$disconnect());
