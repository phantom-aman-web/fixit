import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, apiError, requireCustomerProfile, HttpError } from "@/lib/api";
import { payment } from "@/lib/providers/payment";

// GET returns the current payment + quote for a booking.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { profile } = await requireCustomerProfile();
    const { id } = await params;
    const booking = await db.booking.findUnique({
      where: { id },
      include: { payment: true, quote: true },
    });
    if (!booking || booking.customerId !== profile.id) throw new HttpError(404, "Booking not found");
    return ok({ payment: booking.payment, quote: booking.quote });
  } catch (e) {
    return apiError(e);
  }
}

// POST creates a payment intent. The amount is derived SERVER-SIDE from the
// approved quote — the client may not set an arbitrary amount. Payment requires
// the quote to be APPROVED and the booking to be CONFIRMED.
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { profile } = await requireCustomerProfile();
    const { id } = await params;

    const booking = await db.booking.findUnique({
      where: { id },
      include: { quote: true, payment: true },
    });
    if (!booking || booking.customerId !== profile.id) throw new HttpError(404, "Booking not found");
    if (booking.payment) return ok({ payment: booking.payment }); // idempotent

    // Require an approved quote.
    if (!booking.quote) throw new HttpError(400, "No quote exists for this booking yet");
    if (booking.quote.status !== "APPROVED") {
      throw new HttpError(400, `Quote must be approved before payment (current: ${booking.quote.status})`);
    }
    // Require the booking to be CONFIRMED (technician has confirmed the schedule).
    if (booking.status !== "CONFIRMED") {
      throw new HttpError(400, `Booking must be confirmed before payment (current: ${booking.status})`);
    }

    const amount = booking.quote.totalEstimate; // server-side, trusted
    const intent = await payment.createIntent({
      amount,
      currency: "ETB",
      bookingId: id,
    });
    const pay = await db.payment.create({
      data: {
        bookingId: id,
        customerId: profile.id,
        amount,
        currency: "ETB",
        status: "PENDING",
        provider: "mock",
        providerRef: intent.id,
      },
    });
    return ok({ payment: pay }, 201);
  } catch (e) {
    return apiError(e);
  }
}
