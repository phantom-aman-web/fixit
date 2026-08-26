import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { ok, apiError, requireRole, HttpError } from "@/lib/api";
import { auditLog } from "@/services/audit-service";
import { notify } from "@/services/notifications";
import { getPaymentProvider } from "@/lib/providers/payment";

const schema = z.object({
  status: z.enum(["RESOLVED", "REJECTED"]),
  resolution: z.string().max(2000).optional(),
  refundAmount: z.number().int().min(0).optional(),
});

// POST /api/disputes/[id]/resolve — ADMIN only.
// Refund amount is validated against the actual paid amount (server-derived).
// Duplicate refunds are prevented by checking payment status.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireRole("ADMIN");
    const { id } = await params;
    const body = await req.json();
    const parsed = schema.parse(body);

    const dispute = await db.dispute.findUnique({
      where: { id },
      include: { job: { include: { booking: { include: { payment: true } } } } },
    });
    if (!dispute) throw new HttpError(404, "Dispute not found");

    // Prevent resolving an already-resolved dispute (idempotency).
    if (dispute.status === "RESOLVED" || dispute.status === "REJECTED") {
      throw new HttpError(400, `Dispute is already ${dispute.status.toLowerCase()}`);
    }

    // If a refund is requested, validate it server-side.
    let refundIssued = false;
    if (parsed.refundAmount && parsed.refundAmount > 0) {
      const pay = dispute.job.booking.payment;
      if (!pay) {
        throw new HttpError(400, "No payment exists for this job — cannot issue refund.");
      }
      // Refund amount must not exceed the paid amount (server-derived).
      if (parsed.refundAmount > pay.amount) {
        throw new HttpError(400, `Refund amount exceeds paid amount (${pay.amount} minor units).`);
      }
      // Prevent duplicate refund — payment must be SUCCEEDED (not already REFUNDED).
      if (pay.status !== "SUCCEEDED") {
        throw new HttpError(400, `Payment is ${pay.status} — cannot refund.`);
      }
      if (!pay.providerPaymentId) {
        throw new HttpError(500, "Payment has no provider reference — cannot refund.");
      }

      try {
        const paymentProvider = getPaymentProvider();
        await paymentProvider.refundPayment(pay.providerPaymentId);
        // Atomically update payment + dispute in a transaction.
        refundIssued = true;
      } catch {
        // Refund provider failure — do NOT mark dispute as resolved.
        throw new HttpError(502, "Refund failed at the payment provider. Dispute not resolved.");
      }
    }

    // Atomically update dispute + payment (if refund) in a transaction.
    const updated = await db.$transaction(async (tx) => {
      if (refundIssued && dispute.job.booking.payment) {
        await tx.payment.update({
          where: { id: dispute.job.booking.payment.id },
          data: { status: "REFUNDED" },
        });
      }

      return tx.dispute.update({
        where: { id },
        data: {
          status: parsed.status,
          resolution: parsed.resolution,
          refundAmount: refundIssued ? parsed.refundAmount : null,
          resolvedBy: admin.id,
        },
      });
    });

    await auditLog({
      actorId: admin.id,
      actorRole: "ADMIN",
      action: "dispute_resolved",
      entityType: "dispute",
      entityId: id,
      metadata: { status: parsed.status, refundIssued, refundAmount: refundIssued ? parsed.refundAmount : 0 },
    });

    // Notify both parties via the central notification service.
    const cust = await db.customerProfile.findUnique({ where: { id: dispute.customerId } });
    const tech = await db.technicianProfile.findUnique({ where: { id: dispute.technicianId } });
    const notifyTitle = `Dispute ${parsed.status === "RESOLVED" ? "resolved" : "rejected"}`;
    const notifyBody = parsed.resolution || `Your dispute has been ${parsed.status.toLowerCase()}.`;
    for (const userId of [cust?.userId, tech?.userId].filter(Boolean) as string[]) {
      void notify({ userId, type: "dispute_updated", title: notifyTitle, body: notifyBody, data: { disputeId: id } });
    }

    return ok({ dispute: updated, refundIssued });
  } catch (e) {
    return apiError(e);
  }
}
