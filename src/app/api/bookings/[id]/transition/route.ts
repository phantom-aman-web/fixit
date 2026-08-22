import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { ok, apiError, requireAuth, HttpError } from "@/lib/api";
import { transitionBooking, canTransition } from "@/services/state-machines";

const schema = z.object({ status: z.string(), note: z.string().optional() });

// Per-transition authorization. The customer and technician have different
// allowed transitions; this prevents a customer from self-advancing the
// workflow (e.g. self-accepting or self-completing a booking).
const TECHNICIAN_TRANSITIONS = new Set(["ACCEPTED", "SCHEDULED", "CONFIRMED", "COMPLETED"]);
const CUSTOMER_TRANSITIONS = new Set(["CANCELLED"]);

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAuth();
    const { id } = await params;
    const body = await req.json();
    const parsed = schema.parse(body);

    const booking = await db.booking.findUnique({
      where: { id },
      include: { technician: true, customer: true },
    });
    if (!booking) throw new HttpError(404, "Booking not found");

    const isTech = booking.technician?.userId === user.id;
    const isCust = booking.customer?.userId === user.id;
    if (user.role !== "ADMIN" && !isTech && !isCust) throw new HttpError(403, "Not authorized");

    // Per-transition authorization.
    if (user.role !== "ADMIN") {
      if (isTech && !TECHNICIAN_TRANSITIONS.has(parsed.status)) {
        throw new HttpError(403, `Technicians cannot set booking status to ${parsed.status}`);
      }
      if (isCust && !CUSTOMER_TRANSITIONS.has(parsed.status)) {
        throw new HttpError(403, `Customers cannot set booking status to ${parsed.status}`);
      }
    }

    if (!canTransition("BOOKING", booking.status, parsed.status)) {
      throw new HttpError(400, `Cannot transition booking ${booking.status} → ${parsed.status}`);
    }

    await transitionBooking(id, parsed.status, parsed.note);

    // If technician accepts, notify customer.
    if (parsed.status === "ACCEPTED" && (isTech || user.role === "ADMIN")) {
      await db.notification.create({
        data: {
          userId: booking.customer.userId,
          type: "booking_accepted",
          title: "Technician accepted your booking",
          body: `${booking.technician?.displayName} accepted your booking.`,
          dataJson: JSON.stringify({ bookingId: id }),
        },
      });
    }

    const updated = await db.booking.findUnique({
      where: { id },
      include: { technician: true, repairRequest: { include: { problem: { include: { category: true } } } }, repairJob: true },
    });
    return ok({ booking: updated });
  } catch (e) {
    return apiError(e);
  }
}
