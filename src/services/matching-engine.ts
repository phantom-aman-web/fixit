import { db } from "@/lib/db";
import { haversineKm } from "@/lib/geo";

// Explainable technician matching. Configurable weights.
//   skill match          40%
//   equipment expertise  20%
//   distance             15%
//   availability         10%
//   rating               10%
//   price                5%

export const MATCH_WEIGHTS = {
  skill: 0.4,
  equipment: 0.2,
  distance: 0.15,
  availability: 0.1,
  rating: 0.1,
  price: 0.05,
};

export interface MatchExplanation {
  skillScore: number;
  equipmentScore: number;
  distanceScore: number;
  availabilityScore: number;
  ratingScore: number;
  priceScore: number;
  total: number;
  distanceKm: number | null;
  reasons: string[];
}

export async function computeMatches(repairRequestId: string) {
  const req = await db.repairRequest.findUnique({
    where: { id: repairRequestId },
    include: {
      problem: true,
      session: true,
      customer: true,
    },
  });
  if (!req) throw new Error("Repair request not found");

  const categorySlug = req.problem.categoryId
    ? (await db.equipmentCategory.findUnique({ where: { id: req.problem.categoryId } }))?.slug
    : undefined;

  // Pull all active technicians with their skills + service areas.
  const technicians = await db.technicianProfile.findMany({
    where: { status: "ACTIVE" },
    include: { skills: true, serviceAreas: { include: { serviceArea: true } } },
  });

  const customerLoc =
    req.customer && req.customer.latitude != null && req.customer.longitude != null
      ? { latitude: req.customer.latitude, longitude: req.customer.longitude }
      : null;

  const scored = technicians.map((t) => {
    const expl = score(t, categorySlug, customerLoc);
    return { technician: t, explanation: expl };
  });

  scored.sort((a, b) => b.explanation.total - a.explanation.total);

  // Persist matches (replace previous).
  await db.technicianMatch.deleteMany({ where: { repairRequestId } });
  const matches: { match: any; technician: any; explanation: MatchExplanation }[] = [];
  for (let i = 0; i < scored.length; i++) {
    const { technician, explanation } = scored[i];
    const m = await db.technicianMatch.create({
      data: {
        repairRequestId,
        technicianId: technician.id,
        score: explanation.total,
        rank: i + 1,
        explanationJson: JSON.stringify(explanation),
      },
    });
    matches.push({ match: m, technician, explanation });
  }

  await db.repairRequest.update({
    where: { id: repairRequestId },
    data: { status: "MATCHED" },
  });

  return matches;
}

function score(
  tech: any,
  categorySlug: string | undefined,
  customerLoc: { latitude: number; longitude: number } | null
): MatchExplanation {
  const reasons: string[] = [];

  // Skill: max proficiency in a skill linked to this equipment category.
  const relevantSkills = categorySlug
    ? tech.skills.filter((s: any) => s.equipmentCategory === categorySlug)
    : tech.skills;
  const skillScore = relevantSkills.length
    ? Math.max(...relevantSkills.map((s: any) => s.proficiency)) / 5
    : 0;
  if (skillScore >= 0.8) reasons.push(`Expert in ${categorySlug?.replaceAll("_", " ") ?? "appliances"}`);

  // Equipment expertise: number of relevant skills / 5.
  const equipmentScore = Math.min(1, relevantSkills.length / 3);

  // Distance: nearest service area to customer.
  let distanceKm: number | null = null;
  let distanceScore = 0.5; // neutral when no customer location
  if (customerLoc && tech.serviceAreas.length) {
    const dists = tech.serviceAreas.map((a: any) =>
      haversineKm(customerLoc, {
        latitude: a.serviceArea.latitude,
        longitude: a.serviceArea.longitude,
      })
    );
    distanceKm = Math.min(...dists);
    // Within 3km → 1.0; up to 10km → 0.5; beyond 20km → 0.
    distanceScore = distanceKm <= 3 ? 1 : distanceKm <= 10 ? 0.6 : distanceKm <= 20 ? 0.3 : 0.05;
    if (distanceKm <= 5) reasons.push(`Serves your area (~${Math.round(distanceKm)} km away)`);
  }

  // Availability.
  const availabilityScore = tech.availability === "AVAILABLE" ? 1 : tech.availability === "BUSY" ? 0.4 : 0.1;
  if (tech.availability === "AVAILABLE") reasons.push("Available now");

  // Rating.
  const ratingScore = tech.rating / 5;
  if (tech.rating >= 4.5) reasons.push(`${tech.rating.toFixed(1)}★ rating (${tech.ratingCount} reviews)`);

  // Price: lower call-out fee → higher score. Normalize against a benchmark.
  const benchmark = 60000; // ETB 600
  const priceScore = tech.baseCallOutFee
    ? Math.max(0, 1 - (tech.baseCallOutFee - 25000) / benchmark)
    : 0.5;

  const total =
    skillScore * MATCH_WEIGHTS.skill +
    equipmentScore * MATCH_WEIGHTS.equipment +
    distanceScore * MATCH_WEIGHTS.distance +
    availabilityScore * MATCH_WEIGHTS.availability +
    ratingScore * MATCH_WEIGHTS.rating +
    priceScore * MATCH_WEIGHTS.price;

  if (tech.completedJobs >= 100) reasons.push(`${tech.completedJobs}+ completed jobs`);
  if (tech.verified) reasons.push("Verified technician");

  return {
    skillScore,
    equipmentScore,
    distanceScore,
    availabilityScore,
    ratingScore,
    priceScore,
    total,
    distanceKm,
    reasons: reasons.slice(0, 5),
  };
}
