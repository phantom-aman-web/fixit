import { db } from "../src/lib/db";

async function verifyTechAdminJourney() {
  console.log("Starting Technician & Admin Journey Verification (P7.3, P7.4)...");

  // Get a pending technician
  let techUser: any = await db.user.findFirst({
    where: { email: "new.tech@fixit.local" }
  });
  if (techUser) {
    await db.user.delete({ where: { id: techUser.id } });
  }

  // 1. Technician applies
  techUser = await db.user.create({
    data: {
      email: "new.tech@fixit.local",
      name: "New Tech",
      role: "TECHNICIAN",
      technicianProfile: {
        create: {
          displayName: "Bob the Fixer",
          phone: "+251922233344",
          status: "PENDING"
        }
      }
    },
    include: { technicianProfile: true }
  }) as any;
  console.log(`[x] Tech Registration complete: ${techUser.id}`);

  // 2. Admin verifies technician
  const techProfile = techUser.technicianProfile!;
  await db.technicianProfile.update({
    where: { id: techProfile.id },
    data: { status: "ACTIVE", verified: true }
  });
  console.log(`[x] Admin verified technician.`);

  // 3. Technician sets availability (creates slot)
  const slot = await db.availabilitySlot.create({
    data: {
      technicianId: techProfile.id,
      dayOfWeek: 1, // Monday
      startMinutes: 480, // 8 AM
      endMinutes: 1020 // 5 PM
    }
  });
  console.log(`[x] Technician availability slot created: ${slot.id}`);

  // 4. Dispute Workflow (Customer vs Tech)
  // Need an existing booking/job
  const job = await db.repairJob.findFirst({
    include: { booking: true }
  });
  if (!job) throw new Error("No job found for dispute testing");

  await db.dispute.deleteMany({ where: { jobId: job.id } });

  const dispute = await db.dispute.create({
    data: {
      jobId: job.id,
      customerId: job.booking.customerId,
      technicianId: job.booking.technicianId,
      reason: "Technician didn't show up",
      description: "The technician did not arrive at the scheduled time.",
      status: "OPEN"
    }
  });
  console.log(`[x] Dispute created: ${dispute.id}`);

  // Technician responds to dispute
  const message = await db.disputeMessage.create({
    data: {
      disputeId: dispute.id,
      authorId: job.booking.technicianId,
      authorRole: "technician",
      message: "I did show up but customer wasn't there."
    }
  });
  console.log(`[x] Technician responded to dispute: ${message.id}`);

  // Admin resolves dispute
  const resolvedDispute = await db.dispute.update({
    where: { id: dispute.id },
    data: {
      status: "RESOLVED",
      resolution: "CUSTOMER_REFUNDED",
      refundAmount: 500
    }
  });
  console.log(`[x] Admin resolved dispute.`);

  // 5. Technician Earnings
  // Test if we can aggregate payments correctly
  const earnings = await db.payment.aggregate({
    where: { 
      status: { in: ["SUCCEEDED"] },
      booking: { technicianId: techProfile.id }
    },
    _sum: { amount: true }
  });
  console.log(`[x] Technician earnings aggregated: ${earnings._sum.amount ?? 0}`);

  console.log("Tech & Admin Journey Verification SUCCESS");
}

verifyTechAdminJourney().catch(e => {
  console.error("Verification FAILED:", e);
  process.exit(1);
});
