import { NextRequest } from "next/server";
import { z } from "zod";
import { ok, apiError, requireCustomerProfile, HttpError } from "@/lib/api";
import { explainMatch } from "@/services/ai-service";
import { db } from "@/lib/db";

const schema = z.object({ matchId: z.string() });

export async function POST(req: NextRequest) {
  try {
    const { profile } = await requireCustomerProfile();
    const body = await req.json();
    const parsed = schema.parse(body);

    const match = await db.technicianMatch.findUnique({
      where: { id: parsed.matchId },
      include: {
        repairRequest: true,
        technician: { include: { skills: true, serviceAreas: { include: { serviceArea: true } } } },
      },
    });
    if (!match) throw new HttpError(404, "Match not found");
    if (match.repairRequest.customerId !== profile.id) throw new HttpError(403, "Not your request");

    const explanation = JSON.parse(match.explanationJson);
    const matchData = JSON.stringify({
      technician: {
        name: match.technician.displayName,
        rating: match.technician.rating,
        ratingCount: match.technician.ratingCount,
        completedJobs: match.technician.completedJobs,
        yearsExperience: match.technician.yearsExperience,
        verified: match.technician.verified,
        availability: match.technician.availability,
        baseCallOutFee: match.technician.baseCallOutFee,
        skills: match.technician.skills.map((s) => ({ skill: s.skill, proficiency: s.proficiency, category: s.equipmentCategory })),
        serviceAreas: match.technician.serviceAreas.map((a) => a.serviceArea.name),
      },
      scores: explanation,
      rank: match.rank,
      totalScore: match.score,
    }, null, 2);

    const result = await explainMatch(profile.userId, matchData);

    return ok({
      explanation: result.explanation,
      analysisId: result.analysisId,
      fellBack: result.fellBack,
    });
  } catch (e) {
    return apiError(e);
  }
}
