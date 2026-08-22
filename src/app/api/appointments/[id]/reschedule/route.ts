import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { ok, apiError, requireAuth, HttpError } from "@/lib/api";
import { checkAvailability } from "@/services/scheduling-service";
import { auditLog } from "@/services/audit-service";

const schema = z.object({
  newTime: z.string(),
  reason: z.string().max(500).optional(),
});

// POST /api/appointments/[id]/reschedule — either party can propose a new time.
// The other party must confirm. Conflict detection prevents double-booking.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAuth();
    const { id } = await params;
    const body = await req.json();
    const parsed = schema.parse(body);

    const appointment = await db.appointment.findUnique({
      where: { id },
      include: { booking: { include: { customer: true, technician: true } } },
    });
    if (!appointment) throw new HttpError(404, "Appointment not found");
    if (appointment.status === "CANCELLED" || appointment.status === "COMPLETED") {
      throw new HttpError(400, "Cannot reschedule a cancelled/completed appointment");
    }

    const isCust = appointment.booking.customer.userId === user.id;
    const isTech = appointment.booking.technician?.userId === user.id;
    if (user.role !== "ADMIN" && !isCust && !isTech) throw new HttpError(403, "Not authorized");

    const newTime = new Date(parsed.newTime);
    if (isNaN(newTime.getTime())) throw new HttpError(400, "Invalid time");

    // Conflict detection — prevent double-booking.
    const availability = await checkAvailability(
      appointment.booking.technicianId,
      newTime,
      60,
      appointment.bookingId,
    );
    if (!availability.available) {
      throw new HttpError(409, availability.reason ?? "Time slot not available");
    }

    // Record the reschedule history.
    await db.appointmentReschedule.create({
      data: {
        appointmentId: id,
        previousTime: appointment.scheduledAt,
        newTime,
        proposedBy: user.id,
        reason: parsed.reason,
      },
    });

    const updated = await db.appointment.update({
      where: { id },
      data: {
        scheduledAt: newTime,
        status: "RESCHEDULED",
        proposedBy: user.id,
        notes: parsed.reason,
      },
    });

    // Update the booking's scheduledAt too.
    await db.booking.update({
      where: { id: appointment.bookingId },
      data: { scheduledAt: newTime },
    });

    await auditLog({
      actorId: user.id,
      actorRole: user.role as any,
      action: "appointment_rescheduled",
      entityType: "appointment",
      entityId: id,
      metadata: { previousTime: appointment.scheduledAt, newTime },
    });

    // Notify the other party.
    const otherUserId = isCust ? appointment.booking.technician?.userId : appointment.booking.customer.userId;
    if (otherUserId) {
      await db.notification.create({
        data: {
          userId: otherUserId,
          type: "appointment_changed",
          title: "Appointment rescheduled",
          body: `The appointment has been rescheduled to ${newTime.toLocaleString()}.`,
          dataJson: JSON.stringify({ appointmentId: id, bookingId: appointment.bookingId }),
        },
      });
    }

    return ok({ appointment: updated });
  } catch (e) {
    return apiError(e);
  }
}
