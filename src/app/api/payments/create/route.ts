import { NextRequest, NextResponse } from "next/server";
import { requireAuth, HttpError } from "@/lib/api";
import { PaymentService } from "@/services/payments/payment-service";
import { checkGeneralRateLimit } from "@/lib/rate-limit";
import { logError } from "@/lib/logger";

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth();
    
    // Strict rate limiting for payment creation
    const rl = checkGeneralRateLimit(user.id, "payment_create");
    if (!rl.allowed) {
      return NextResponse.json({ error: "Rate limit exceeded", retryAfterMs: rl.retryAfterMs }, { status: 429 });
    }

    const body = await req.json();
    const { bookingId, successUrl, cancelUrl } = body;

    if (!bookingId || !successUrl || !cancelUrl) {
      throw new HttpError(400, "Missing required fields: bookingId, successUrl, cancelUrl");
    }

    const result = await PaymentService.createPaymentForBooking(
      bookingId,
      user.id,
      successUrl,
      cancelUrl
    );

    return NextResponse.json(result);
  } catch (e: any) {
    logError("Payment creation failed", e);
    const status = e instanceof HttpError ? e.status : (e.code === "PAYMENT_NOT_FOUND" ? 404 : 500);
    return NextResponse.json({ error: e.message }, { status });
  }
}
