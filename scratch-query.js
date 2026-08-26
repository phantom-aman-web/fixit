const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const techs = await prisma.technicianProfile.findMany({
    select: {
      displayName: true,
      verified: true,
      status: true,
      documents: { select: { fileName: true, status: true } },
    }
  });
  console.log(JSON.stringify(techs, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
