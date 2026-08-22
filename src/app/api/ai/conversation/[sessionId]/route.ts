import { NextRequest } from "next/server";
import { ok, apiError, requireCustomerProfile, HttpError } from "@/lib/api";
import { db } from "@/lib/db";

// GET /api/ai/conversation/[sessionId] — fetch conversation history.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ sessionId: string }> }) {
  try {
    const { profile } = await requireCustomerProfile();
    const { sessionId } = await params;
    const session = await db.diagnosticSession.findUnique({ where: { id: sessionId } });
    if (!session || session.customerId !== profile.id) throw new HttpError(403, "Not your session");

    const messages = await db.aIInteraction.findMany({
      where: { sessionId },
      orderBy: { createdAt: "asc" },
      take: 100,
    });
    return ok({ messages });
  } catch (e) {
    return apiError(e);
  }
}
