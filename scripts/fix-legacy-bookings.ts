import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const jobs = await prisma.repairJob.findMany({
    where: { status: "COMPLETED", booking: { status: { not: "COMPLETED" } } }
  });

  console.log(`Found ${jobs.length} jobs to fix.`);
  for (const job of jobs) {
    await prisma.booking.update({
      where: { id: job.bookingId },
      data: { status: "COMPLETED" }
    });
    console.log(`Updated booking ${job.bookingId} to COMPLETED`);
  }
}

main().finally(() => prisma.$disconnect());
