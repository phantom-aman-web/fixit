import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const techs = await prisma.technicianProfile.findMany({
    include: { user: true, bookings: true }
  });

  for (const tech of techs) {
    console.log(`Tech: ${tech.user.name} (${tech.user.email}) - Completed Bookings: ${tech.bookings.filter(b => b.status === "COMPLETED").length}`);
  }
}

main().finally(() => prisma.$disconnect());
