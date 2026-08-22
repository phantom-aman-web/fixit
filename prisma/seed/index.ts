// Seed data for FixIt. Clearly synthetic demo content.
// Run with: bunx tsx prisma/seed/index.ts

import { db } from "../../src/lib/db";
import bcrypt from "bcryptjs";
import { seedEquipmentAndDiagnostics } from "./diagnostics";
import { seedTechniciansAndAreas } from "./technicians";
import { seedUsersAndProfiles } from "./users";

async function main() {
  console.log("🌱 Seeding FixIt…");

  // Wipe in dependency-safe order.
  await db.notification.deleteMany();
  await db.warranty.deleteMany();
  await db.review.deleteMany();
  await db.repairPart.deleteMany();
  await db.repairStatusHistory.deleteMany();
  await db.repairJob.deleteMany();
  await db.payment.deleteMany();
  await db.booking.deleteMany();
  await db.quoteItem.deleteMany();
  await db.quote.deleteMany();
  await db.technicianMatch.deleteMany();
  await db.repairRequest.deleteMany();
  await db.diagnosticStepResult.deleteMany();
  await db.diagnosis.deleteMany();
  await db.diagnosticAnswer.deleteMany();
  await db.diagnosticSession.deleteMany();
  await db.troubleshootingStep.deleteMany();
  await db.possibleCause.deleteMany();
  await db.diagnosticRule.deleteMany();
  await db.diagnosticOption.deleteMany();
  await db.diagnosticQuestion.deleteMany();
  await db.symptom.deleteMany();
  await db.problemMedia.deleteMany();
  await db.problemReport.deleteMany();
  await db.maintenanceRecord.deleteMany();
  await db.customerEquipment.deleteMany();
  await db.equipmentModel.deleteMany();
  await db.equipmentErrorCode.deleteMany();
  await db.serviceAreaAssignment.deleteMany();
  await db.serviceArea.deleteMany();
  await db.technicianSkill.deleteMany();
  await db.technicianProfile.deleteMany();
  await db.customerProfile.deleteMany();
  await db.session.deleteMany();
  await db.account.deleteMany();
  await db.verificationToken.deleteMany();
  await db.user.deleteMany();
  await db.equipmentCategory.deleteMany();

  await seedUsersAndProfiles();
  await seedEquipmentAndDiagnostics();
  await seedTechniciansAndAreas();

  console.log("✅ Seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });

// Re-export bcrypt for sub-modules.
export { bcrypt };
