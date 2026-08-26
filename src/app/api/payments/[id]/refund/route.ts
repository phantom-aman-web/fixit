import { NextRequest, NextResponse } from "next/server";
import { requireAuth, HttpError } from "@/lib/api";
import { PaymentService } from "@/services/payments/payment-service";
import { logError } from "@/lib/logger";
import { checkIdempotency, storeIdempotencyResponse } from "@/services/idempotency-service";

export async function POST(req: NextRequest, { params }: { params: any }) {
  try {
    const user = await requireAuth();
    const { id } = await params;
    
    const idempotencyKey = req.headers.get("x-idempotency-key");
    if (idempotencyKey) {
      const body = await req.json().catch(() => ({}));
      const idemResult = await checkIdempotency(idempotencyKey, user.id, "payment_refund", { paymentId: id, ...body });
      if (idemResult.replayed) {
        return NextResponse.json(idemResult.data, { status: idemResult.status });
      }
    }

    const body = await req.json().catch(() => ({}));
    const amount = body.amount ? Number(body.amount) : undefined;

    const result = await PaymentService.refundPayment(id, user.id, amount);

    if (idempotencyKey) {
      await storeIdempotencyResponse(idempotencyKey, 200, result);
    }

    return NextResponse.json(result);
  } catch (e: any) {
    logError("Payment refund failed", e);
    const status = e instanceof HttpError ? e.status : (e.code === "PAYMENT_NOT_FOUND" ? 404 : (e.code === "UNAUTHORIZED" ? 403 : 500));
    return NextResponse.json({ error: e.message }, { status });
  }
}
