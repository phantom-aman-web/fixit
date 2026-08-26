import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { ok, apiError, requireAuth, HttpError } from "@/lib/api";
import { notifyQuoteDecision } from "@/services/notifications";

const schema = z.object({ decision: z.enum(["APPROVED", "REJECTED"]) });

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAuth();
    const { id } = await params;
    const body = await req.json();
    const parsed = schema.parse(body);

    const quote = await db.quote.findUnique({
      where: { id },
      include: { repairRequest: true },
    });
    if (!quote) throw new HttpError(404, "Quote not found");

    // Authorization: customer who owns the repair request, or admin.
    const rr = quote.repairRequest;
    const custProfile = await db.customerProfile.findUnique({ where: { userId: user.id } });
    if (user.role !== "ADMIN" && (!custProfile || rr.customerId !== custProfile.id)) {
      throw new HttpError(403, "Not authorized");
    }

    await db.quote.update({ where: { id }, data: { status: parsed.decision } });

    if (parsed.decision === "APPROVED") {
      await db.repairRequest.update({
        where: { id: rr.id },
        data: { status: "BOOKED" },
      });

      // Update Booking to AWAITING_PAYMENT
      const booking = await db.booking.findFirst({
        where: { repairRequestId: rr.id, status: "QUOTE_SUBMITTED" },
      });
      if (booking) {
        await db.booking.update({
          where: { id: booking.id },
          data: { status: "AWAITING_PAYMENT" },
        });
      }
    }

    await notifyQuoteDecision(id, parsed.decision === "APPROVED");

    return ok({ ok: true });
  } catch (e) {
    return apiError(e);
  }
}
