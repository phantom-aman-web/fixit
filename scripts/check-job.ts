import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const job = await prisma.repairJob.findUnique({
    where: { id: "cmt7n4arg004rwhsoo5zvh11u" },
    include: { booking: { include: { customer: { include: { user: true } } } } }
  });

  console.log(`Job: ${job?.id}`);
  console.log(`Booking ID: ${job?.bookingId}, Customer: ${job?.booking?.customer?.user?.email}`);
}

main().finally(() => prisma.$disconnect());
