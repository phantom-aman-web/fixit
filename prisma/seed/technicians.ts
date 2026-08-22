import { db } from "../../src/lib/db";
import { ADDIS_ABABA_AREAS } from "../../src/lib/geo";

// Seed service areas + demo technician profiles (linked to the demo technician
// user created in users.ts, plus several synthetic-only technicians).

const AREA_NAMES = Object.keys(ADDIS_ABABA_AREAS);

type TechSeed = {
  displayName: string;
  bio: string;
  yearsExperience: number;
  rating: number;
  ratingCount: number;
  completedJobs: number;
  responseTimeHours: number;
  baseCallOutFee: number; // ETB minor units
  hourlyRate: number;
  verified: boolean;
  availability: "AVAILABLE" | "BUSY" | "OFFLINE";
  skills: { skill: string; equipmentCategory: string; proficiency: number }[];
  areas: string[];
  reviews?: { author: string; rating: number; body: string }[];
};

const TECHS: TechSeed[] = [
  {
    displayName: "Dawit Mechanic",
    bio: "Appliance technician with 12 years on washing machines and refrigerators. Serves Bole and Kazanchis.",
    yearsExperience: 12,
    rating: 4.9,
    ratingCount: 187,
    completedJobs: 214,
    responseTimeHours: 2,
    baseCallOutFee: 50000, // ETB 500
    hourlyRate: 15000, // ETB 150
    verified: true,
    availability: "AVAILABLE",
    skills: [
      { skill: "washing_machine_repair", equipmentCategory: "washing_machine", proficiency: 5 },
      { skill: "refrigerator_repair", equipmentCategory: "refrigerator", proficiency: 5 },
      { skill: "compressor_service", equipmentCategory: "refrigerator", proficiency: 4 },
      { skill: "dishwasher_repair", equipmentCategory: "dishwasher", proficiency: 4 },
    ],
    areas: ["Bole", "Kazanchis", "Kirkos"],
    reviews: [
      { author: "Selam B.", rating: 5, body: "Fixed my washing machine bearing quickly. Professional." },
      { author: "Yonas G.", rating: 5, body: "Honest diagnosis and fair price." },
    ],
  },
  {
    displayName: "Hanan Appliances",
    bio: "Family workshop specializing in LG and Samsung refrigerators across Yeka and Arada.",
    yearsExperience: 9,
    rating: 4.7,
    ratingCount: 132,
    completedJobs: 158,
    responseTimeHours: 4,
    baseCallOutFee: 40000,
    hourlyRate: 12000,
    verified: true,
    availability: "AVAILABLE",
    skills: [
      { skill: "refrigerator_repair", equipmentCategory: "refrigerator", proficiency: 5 },
      { skill: "compressor_service", equipmentCategory: "refrigerator", proficiency: 5 },
      { skill: "sealed_system", equipmentCategory: "refrigerator", proficiency: 4 },
      { skill: "dishwasher_repair", equipmentCategory: "dishwasher", proficiency: 3 },
    ],
    areas: ["Yeka", "Arada", "Piazza"],
    reviews: [
      { author: "Meseret A.", rating: 5, body: "Recharged my fridge; it's like new." },
      { author: "Robel T.", rating: 4, body: "Good work, slightly late arrival." },
    ],
  },
  {
    displayName: "Solomon Repair Co.",
    bio: "General appliance technician covering dishwasher and washer faults in Lideta and Nifas Silk.",
    yearsExperience: 7,
    rating: 4.6,
    ratingCount: 98,
    completedJobs: 121,
    responseTimeHours: 6,
    baseCallOutFee: 35000,
    hourlyRate: 10000,
    verified: false,
    availability: "BUSY",
    skills: [
      { skill: "dishwasher_repair", equipmentCategory: "dishwasher", proficiency: 5 },
      { skill: "washing_machine_repair", equipmentCategory: "washing_machine", proficiency: 4 },
      { skill: "drain_pump_service", equipmentCategory: "dishwasher", proficiency: 5 },
    ],
    areas: ["Lideta", "Nifas Silk-Lafto", "Kolfe Keranio"],
    reviews: [
      { author: "Bethel K.", rating: 5, body: "Dishwasher drains perfectly now." },
    ],
  },
  {
    displayName: "Yohannes Tech",
    bio: "Bosch specialist; handles front-load washer bearing and drum repairs. Serves Gulele and Kolfe.",
    yearsExperience: 15,
    rating: 4.8,
    ratingCount: 156,
    completedJobs: 180,
    responseTimeHours: 3,
    baseCallOutFee: 60000,
    hourlyRate: 18000,
    verified: true,
    availability: "AVAILABLE",
    skills: [
      { skill: "washing_machine_repair", equipmentCategory: "washing_machine", proficiency: 5 },
      { skill: "drum_bearing_service", equipmentCategory: "washing_machine", proficiency: 5 },
      { skill: "dishwasher_repair", equipmentCategory: "dishwasher", proficiency: 4 },
    ],
    areas: ["Gulele", "Kolfe Keranio", "Lideta"],
    reviews: [
      { author: "Desta M.", rating: 5, body: "Replaced the drum bearing; washer is silent again." },
      { author: "Almaz W.", rating: 4, body: "Skilled but a bit pricey." },
    ],
  },
  {
    displayName: "Mahlet Home Services",
    bio: "Budget-friendly general repairs for washers and fridges. Quick response in Arada and Piazza.",
    yearsExperience: 5,
    rating: 4.3,
    ratingCount: 64,
    completedJobs: 78,
    responseTimeHours: 8,
    baseCallOutFee: 25000,
    hourlyRate: 8000,
    verified: false,
    availability: "AVAILABLE",
    skills: [
      { skill: "washing_machine_repair", equipmentCategory: "washing_machine", proficiency: 3 },
      { skill: "refrigerator_repair", equipmentCategory: "refrigerator", proficiency: 3 },
    ],
    areas: ["Arada", "Piazza", "Kirkos"],
    reviews: [
      { author: "Kebede H.", rating: 4, body: "Affordable and friendly." },
    ],
  },
];

export async function seedTechniciansAndAreas() {
  // Service areas
  for (const name of AREA_NAMES) {
    const a = ADDIS_ABABA_AREAS[name];
    await db.serviceArea.create({
      data: {
        name,
        city: "Addis Ababa",
        latitude: a.latitude,
        longitude: a.longitude,
        radiusKm: a.radiusKm,
      },
    });
  }

  const demoTechUserId = (globalThis as any).__FIXIT_TECH_USER_ID as string | undefined;

  for (let i = 0; i < TECHS.length; i++) {
    const t = TECHS[i];
    const isDemo = i === 0; // first technician is linked to the demo tech user
    const userId = isDemo && demoTechUserId ? demoTechUserId : undefined;

    // For non-demo technicians, create a synthetic USER record with role TECHNICIAN
    // so reviews can be associated. These users cannot sign in (no passwordHash).
    let ownerId = userId;
    if (!ownerId) {
      const synthUser = await db.user.create({
        data: {
          email: `tech-${i + 1}@fixit.demo`,
          name: t.displayName,
          role: "TECHNICIAN",
          // no passwordHash → cannot sign in
        },
      });
      ownerId = synthUser.id;
    }

    const profile = await db.technicianProfile.create({
      data: {
        userId: ownerId,
        displayName: t.displayName,
        bio: t.bio,
        yearsExperience: t.yearsExperience,
        rating: t.rating,
        ratingCount: t.ratingCount,
        completedJobs: t.completedJobs,
        responseTimeHours: t.responseTimeHours,
        baseCallOutFee: t.baseCallOutFee,
        hourlyRate: t.hourlyRate,
        verified: t.verified,
        status: "ACTIVE",
        availability: t.availability,
        skills: {
          create: t.skills,
        },
      },
      include: { skills: true },
    });

    // Service area assignments.
    for (const areaName of t.areas) {
      const sa = await db.serviceArea.findUnique({ where: { name: areaName } });
      if (sa) {
        await db.serviceAreaAssignment.create({
          data: { technicianId: profile.id, serviceAreaId: sa.id },
        });
      }
    }

    // Synthetic reviews (clearly demo). We build the full chain
    // ProblemReport → RepairRequest → Booking → RepairJob → Review so the
    // relational integrity matches the production model.
    for (const rv of t.reviews ?? []) {
      const custProfileId = (globalThis as any).__FIXIT_CUSTOMER_PROFILE_ID as
        | string
        | undefined;
      if (!custProfileId) continue;

      const washerCat = await db.equipmentCategory.findUnique({
        where: { slug: "washing_machine" },
      });
      if (!washerCat) continue;

      const problem = await db.problemReport.create({
        data: {
          customerId: custProfileId,
          categoryId: washerCat.id,
          description: "Demo: washer was noisy during spin (seeded history).",
          urgency: "NORMAL",
          status: "RESOLVED",
        },
      });

      const repairRequest = await db.repairRequest.create({
        data: {
          customerId: custProfileId,
          problemId: problem.id,
          technicianId: profile.id,
          status: "COMPLETED",
        },
      });

      const booking = await db.booking.create({
        data: {
          repairRequestId: repairRequest.id,
          customerId: custProfileId,
          technicianId: profile.id,
          status: "COMPLETED",
          scheduledAt: new Date(Date.now() - 86400000 * (i + 1)),
          location: t.areas[0] ?? "Addis Ababa",
        },
      });

      const job = await db.repairJob.create({
        data: {
          bookingId: booking.id,
          status: "COMPLETED",
          diagnosis: "Demo completed job (seeded).",
          workPerformed: "Demo work performed (seeded).",
          startedAt: new Date(Date.now() - 86400000 * (i + 1)),
          completedAt: new Date(Date.now() - 86400000 * (i + 1) + 3600000),
        },
      });

      await db.review.create({
        data: {
          jobId: job.id,
          customerId: custProfileId,
          technicianId: profile.id,
          rating: rv.rating,
          body: rv.body,
          qualityRating: rv.rating,
          professionalismRating: Math.min(5, rv.rating),
          communicationRating: Math.min(5, rv.rating),
          valueRating: Math.max(3, rv.rating - 1),
        },
      });

      await db.warranty.create({
        data: {
          jobId: job.id,
          endDate: new Date(Date.now() + 86400000 * 90),
          durationMonths: 3,
          coveredWork: "Demo: parts and labor covered for 3 months (seeded).",
          status: "ACTIVE",
        },
      });
    }
  }

  console.log(`  technicians: ${TECHS.length} seeded (${AREA_NAMES.length} service areas)`);
}
