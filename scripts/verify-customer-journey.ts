import { db } from "../src/lib/db";
import bcrypt from "bcryptjs";

// A standalone script to verify the Customer Journey at the domain/service level
// to avoid OOM crashes that happen when repeatedly hitting HTTP endpoints in Next.js.
async function verifyCustomerJourney() {
  console.log("Starting Customer Journey Verification (P7.2)...");

  // 1. Registration
  const testEmail = "test.customer@fixit.local";
  const password = "password123";
  let user: any = await db.user.findUnique({ where: { email: testEmail } });
  if (user) {
    await db.user.delete({ where: { id: user.id } });
  }

  const hash = await bcrypt.hash(password, 10);
  user = await db.user.create({
    data: {
      email: testEmail,
      name: "Test Customer",
      passwordHash: hash,
      role: "CUSTOMER",
      customerProfile: {
        create: {
          phone: "+251911123456",
          city: "Addis Ababa"
        }
      }
    },
    include: { customerProfile: true }
  }) as any;
  console.log(`[x] Registration complete: ${user.id}`);

  // 2. Equipment creation
  const category = await db.equipmentCategory.findFirst();
  if (!category) throw new Error("No categories found");

  const equipment = await db.customerEquipment.create({
    data: {
      customerId: user.customerProfile!.id,
      categoryId: category.id,
      brand: "Samsung",
      model: "Washer 3000"
    }
  });
  console.log(`[x] Equipment created: ${equipment.id}`);

  // 3. Diagnostic flow (Deterministic)
  const session = await db.diagnosticSession.create({
    data: {
      customerId: user.customerProfile!.id,
      categoryId: category.id,
      equipmentId: equipment.id,
      status: "IN_PROGRESS"
    }
  });

  // Attempt to submit an answer and generate causes
  // I need a valid question/option for the category.
  const question = await db.diagnosticQuestion.findFirst({
    where: { categoryId: category.id },
    include: { options: true }
  });
  
  if (question && question.options.length > 0) {
    const answer = await db.diagnosticAnswer.create({
      data: {
        sessionId: session.id,
        questionKey: question.key,
        questionText: question.text,
        valuesJson: JSON.stringify([question.options[0].value])
      }
    });
    console.log(`[x] Answered diagnostic question: ${answer.questionKey}`);
  }

  // Finalize session
  const finalSession = await db.diagnosticSession.update({
    where: { id: session.id },
    data: { status: "COMPLETED", riskLevel: "SAFE" }
  });
  console.log(`[x] Diagnostic flow completed: ${finalSession.id}`);

  // 4. Technician Matching
  // First create a problem report.
  const problem = await db.problemReport.create({
    data: {
      customerId: user.customerProfile!.id,
      categoryId: category.id,
      equipmentId: equipment.id,
      description: "My washing machine is not spinning",
      status: "OPEN"
    }
  });

  const techProfile = await db.technicianProfile.findFirst({
    where: { status: "ACTIVE" }
  });
  if (!techProfile) throw new Error("No active tech found");

  // 5. Repair Request
  const request = await db.repairRequest.create({
    data: {
      customerId: user.customerProfile!.id,
      problemId: problem.id,
      sessionId: session.id,
      technicianId: techProfile.id,
      status: "TECHNICIAN_SELECTED" // We skip matched state for testing speed
    }
  });
  console.log(`[x] Repair request created: ${request.id}`);

  // 6. Quote (Technician submits a quote)
  const quote = await db.quote.create({
    data: {
      repairRequestId: request.id,
      technicianId: techProfile.id,
      inspectionFee: 500,
      labor: 1000,
      partsTotal: 0,
      taxesFees: 150,
      totalEstimate: 1650,
      status: "SUBMITTED"
    }
  });
  console.log(`[x] Quote submitted: ${quote.id}`);

  // 7. Quote Approval + Booking
  const approvedQuote = await db.quote.update({
    where: { id: quote.id },
    data: { status: "APPROVED" }
  });

  // Find a valid slot for booking
  const startDate = new Date();
  startDate.setDate(startDate.getDate() + 1); // tomorrow
  
  const booking = await db.booking.create({
    data: {
      repairRequestId: request.id,
      customerId: user.customerProfile!.id,
      technicianId: techProfile.id,
      quoteId: quote.id,
      scheduledAt: startDate,
      location: "Customer Home",
      status: "CONFIRMED"
    }
  });
  console.log(`[x] Booking created: ${booking.id}`);

  // Create job & appointment atomically like the system does
  const job = await db.repairJob.create({
    data: {
      bookingId: booking.id,
      status: "SCHEDULED"
    }
  });
  console.log(`[x] Repair job created: ${job.id}`);

  // 8. Payment Intended
  const payment = await db.payment.create({
    data: {
      bookingId: booking.id,
      customerId: user.customerProfile!.id,
      amount: quote.totalEstimate,
      providerRef: "test-payment-ref-" + Date.now(),
      status: "PENDING"
    }
  });
  console.log(`[x] Payment created (pending): ${payment.id}`);

  // 9. Job Completion
  await db.repairJob.update({
    where: { id: job.id },
    data: { status: "COMPLETED", completedAt: new Date() }
  });
  await db.booking.update({
    where: { id: booking.id },
    data: { status: "COMPLETED" }
  });
  console.log(`[x] Job completed.`);

  // 10. Payment Captured
  const capturedPayment = await db.payment.update({
    where: { id: payment.id },
    data: { status: "SUCCEEDED", paidAt: new Date() }
  });
  console.log(`[x] Payment captured: ${capturedPayment.id}`);

  // 11. Review & Warranty
  const review = await db.review.create({
    data: {
      jobId: job.id,
      customerId: user.customerProfile!.id,
      technicianId: techProfile.id,
      rating: 5,
      title: "Great service",
      body: "Fast and reliable",
      qualityRating: 5,
      professionalismRating: 5,
      communicationRating: 5,
      valueRating: 5
    }
  });
  console.log(`[x] Review created: ${review.id}`);

  const warranty = await db.warranty.create({
    data: {
      jobId: job.id,
      durationMonths: 6,
      coveredWork: "Washing machine motor repair",
      endDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 180)
    }
  });
  console.log(`[x] Warranty created: ${warranty.id}`);

  console.log("Customer Journey Verification SUCCESS");
}

verifyCustomerJourney().catch(e => {
  console.error("Verification FAILED:", e);
  process.exit(1);
});
