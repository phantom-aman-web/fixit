import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const tech = await prisma.technicianProfile.findFirst({
    where: { user: { email: { contains: "aman" } } },
    include: { bookings: true }
  });

  if (!tech) return console.log("Tech not found");

  console.log(`Tech: ${tech.id}`);
  for (const b of tech.bookings) {
    console.log(`Booking ID: ${b.id}, Status: ${b.status}`);
  }
}

main().finally(() => prisma.$disconnect());
