import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const p = await prisma.payment.findFirst({
    where: { bookingId: "cmt7n4912004pwhso66x2o538" }
  });
  console.log("Payment:", p);

  // Let's also get the true count of completed bookings
  const techId = "cmt71j6sr0007whgsb8lyls1s"; // amantech
  const count = await prisma.booking.count({
    where: { technicianId: techId, status: "COMPLETED" }
  });
  console.log("True completed bookings:", count);
}

main().finally(() => prisma.$disconnect());
