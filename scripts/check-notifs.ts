import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const notifs = await prisma.notification.findMany({
    orderBy: { createdAt: "desc" },
    take: 10
  });

  for (const n of notifs) {
    console.log(`ID: ${n.id}, Type: ${n.type}, dataJson: ${n.dataJson}`);
  }
}

main().finally(() => prisma.$disconnect());
