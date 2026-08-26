import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, apiError, requireCustomerProfile, HttpError } from "@/lib/api";

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

// POST has been removed. Payments are now created via /api/payments/create.
