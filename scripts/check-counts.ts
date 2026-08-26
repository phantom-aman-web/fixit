import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const bookings = await prisma.booking.findMany({
    include: { repairJob: true }
  });

  console.log("Bookings:");
  for (const b of bookings) {
    console.log(`Booking ID: ${b.id}, Status: ${b.status}, RepairJob Status: ${b.repairJob?.status}`);
  }
}

main().finally(() => prisma.$disconnect());
