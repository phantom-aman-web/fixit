const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const docs = await prisma.technicianDocument.findMany({
    where: { status: "APPROVED" },
    include: { technician: true }
  });

  for (const doc of docs) {
    if (!doc.technician.verified) {
      await prisma.technicianProfile.update({
        where: { id: doc.technicianId },
        data: { verified: true, status: "ACTIVE" }
      });
      console.log(`Verified technician ${doc.technician.displayName} because they have an approved document.`);
    }
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
