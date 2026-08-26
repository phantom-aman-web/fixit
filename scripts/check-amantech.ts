import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const tech = await prisma.technicianProfile.findFirst({
    where: { user: { email: { contains: "amantech" } } },
    include: { bookings: { include: { repairJob: true } } }
  });

  if (!tech) return console.log("Tech not found");

  console.log(`Tech: ${tech.id}`);
  for (const b of tech.bookings) {
    console.log(`Booking ID: ${b.id}, Booking Status: ${b.status}, RepairJob Status: ${b.repairJob?.status}`);
  }
}

main().finally(() => prisma.$disconnect());
