import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { ok, apiError, requireCustomerProfile, HttpError } from "@/lib/api";
import { computeMatches } from "@/services/matching-engine";

const schema = z.object({
  problemId: z.string(),
  sessionId: z.string().optional(),
  preferredDate: z.string().optional(),
  notes: z.string().optional(),
});

export async function GET() {
  try {
    const { profile } = await requireCustomerProfile();
    const items = await db.repairRequest.findMany({
      where: { customerId: profile.id },
      include: {
        problem: { include: { category: true } },
        session: true,
        technician: true,
        matches: { 
          select: { 
            id: true, 
            rank: true, 
            score: true, 
            technician: { 
              select: { 
                id: true, 
                displayName: true, 
                avatarUrl: true,
                rating: true,
                ratingCount: true,
                user: { select: { lastSeenAt: true } }
              } 
            } 
          }, 
          orderBy: { rank: "asc" } 
        },
        quote: true,
        booking: { include: { repairJob: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    return ok({ requests: items });
  } catch (e) {
    return apiError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const { profile } = await requireCustomerProfile();
    const body = await req.json();
    const parsed = schema.parse(body);

    const problem = await db.problemReport.findUnique({ where: { id: parsed.problemId } });
    if (!problem || problem.customerId !== profile.id) throw new HttpError(403, "Not your problem");

    const existing = await db.repairRequest.findUnique({ where: { problemId: parsed.problemId } });
    if (existing) throw new HttpError(409, "A repair request already exists for this problem");

    const rr = await db.repairRequest.create({
      data: {
        customerId: profile.id,
        problemId: parsed.problemId,
        sessionId: parsed.sessionId,
        preferredDate: parsed.preferredDate ? new Date(parsed.preferredDate) : undefined,
        notes: parsed.notes,
      },
      include: { problem: { include: { category: true } } },
    });

    // Compute matches immediately.
    const matches = await computeMatches(rr.id);

    return ok({ request: rr, matches }, 201);
  } catch (e) {
    return apiError(e);
  }
}
