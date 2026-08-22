import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, apiError, requireCustomerProfile, HttpError } from "@/lib/api";
import { getSessionState, completeDiagnosis } from "@/services/diagnostic-engine";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { profile } = await requireCustomerProfile();
    const { id } = await params;
    const session = await db.diagnosticSession.findUnique({ where: { id } });
    if (!session || session.customerId !== profile.id) throw new HttpError(404, "Session not found");
    const state = await getSessionState(id);

    // Additive: when the session is in a terminal state, also expose the
    // troubleshooting steps for the top cause (so the UI can render the
    // guided fix flow) and any step results the customer already recorded.
    let troubleshootingSteps: any[] = [];
    let stepResults: any[] = [];
    const status = state.session?.status;
    if (status === "COMPLETED" || status === "ESCALATED") {
      stepResults = await db.diagnosticStepResult.findMany({
        where: { sessionId: id },
        orderBy: { attemptedAt: "asc" },
      });
      if (!state.escalation.escalate) {
        const topCause = state.possibleCauses[0];
        if (topCause) {
          troubleshootingSteps = await db.troubleshootingStep.findMany({
            where: { causeId: topCause.causeId },
            orderBy: { order: "asc" },
          });
        }
      }
    }

    return ok({ state, troubleshootingSteps, stepResults });
  } catch (e) {
    return apiError(e);
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { profile } = await requireCustomerProfile();
    const { id } = await params;
    const session = await db.diagnosticSession.findUnique({ where: { id } });
    if (!session || session.customerId !== profile.id) throw new HttpError(404, "Session not found");
    await db.diagnosticSession.update({
      where: { id },
      data: { status: "ABANDONED" },
    });
    return ok({ ok: true });
  } catch (e) {
    return apiError(e);
  }
}
