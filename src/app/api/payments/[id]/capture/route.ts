import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, apiError, requireAuth, HttpError } from "@/lib/api";
import { payment } from "@/lib/providers/payment";
import { checkGeneralRateLimit } from "@/lib/rate-limit";
import { notifyJobStatus } from "@/services/notifications";
import { logInfo, logError } from "@/lib/logger";
import { checkIdempotency, storeIdempotencyResponse } from "@/services/idempotency-service";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAuth();
    const { id } = await params;
    const rl = checkGeneralRateLimit(user.id, "payment");
    if (!rl.allowed) return ok({ error: "Rate limit exceeded", retryAfterMs: rl.retryAfterMs }, 429);

    // Idempotency: if the client sends an Idempotency-Key header, check for
    // duplicate requests. This prevents double-capture from retried requests.
    const idempotencyKey = req.headers.get("x-idempotency-key");
    if (idempotencyKey) {
      const body = await req.json().catch(() => ({}));
      const idemResult = await checkIdempotency(idempotencyKey, user.id, "payment_capture", { paymentId: id, ...body });
      if (idemResult.replayed) {
        return ok({ payment: idemResult.data, idempotentReplay: true }, idemResult.status);
      }
    }

    const pay = await db.payment.findUnique({
      where: { id },
      include: { booking: { include: { customer: true, repairJob: true } } },
    });
    if (!pay) throw new HttpError(404, "Payment not found");
    if (user.role !== "ADMIN" && pay.booking.customer?.userId !== user.id) {
      throw new HttpError(403, "Not your payment");
    }
    // Prevent duplicate capture — payment must be PENDING.
    if (pay.status !== "PENDING") {
      throw new HttpError(400, `Payment is already ${pay.status}`);
    }
    if (!pay.providerRef) {
      throw new HttpError(500, "Payment has no provider reference");
    }

    // Call the payment provider to capture.
    const intent = await payment.capture(pay.providerRef);

    // Atomically update payment + booking + repair job in a transaction.
    const updated = await db.$transaction(async (tx) => {
      const updatedPayment = await tx.payment.update({
        where: { id },
        data: { status: intent.status, paidAt: new Date() },
      });

      if (intent.status === "SUCCEEDED") {
        const booking = pay.booking;
        if (booking.status === "CONFIRMED") {
          await tx.booking.update({ where: { id: booking.id }, data: { status: "COMPLETED" } });
        }
        if (booking.repairJob && booking.repairJob.status !== "COMPLETED") {
          await tx.repairJob.update({
            where: { id: booking.repairJob.id },
            data: { status: "COMPLETED", completedAt: new Date() },
          });
          await tx.repairStatusHistory.create({
            data: { jobId: booking.repairJob.id, status: "COMPLETED", note: "Payment captured" },
          });
        }
      }

      return updatedPayment;
    });

    // Notify after the transaction commits (not inside it).
    if (intent.status === "SUCCEEDED" && pay.booking.repairJob) {
      try {
        await notifyJobStatus(pay.booking.repairJob.id, "COMPLETED");
      } catch {
        // Notification failure should not rollback the payment.
      }
    }

    // Store idempotency response for replay.
    if (idempotencyKey) {
      await storeIdempotencyResponse(idempotencyKey, 200, { payment: updated });
    }

    logInfo("Payment captured", { paymentId: id, status: intent.status, userId: user.id });

    return ok({ payment: updated });
  } catch (e) {
    logError("Payment capture failed", e, { paymentId: params });
    return apiError(e);
  }
}
