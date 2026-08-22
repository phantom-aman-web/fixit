import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { ok, apiError, requireCustomerProfile, HttpError } from "@/lib/api";
import { checkAvailability } from "@/services/scheduling-service";
import { checkGeneralRateLimit } from "@/lib/rate-limit";
import { auditLog } from "@/services/audit-service";

const schema = z.object({
  repairRequestId: z.string(),
  quoteId: z.string().optional(),
  scheduledAt: z.string(),
  location: z.string(),
  notes: z.string().optional(),
});

export async function GET() {
  try {
    const { profile } = await requireCustomerProfile();
    const items = await db.booking.findMany({
      where: { customerId: profile.id },
      include: {
        technician: true,
        repairRequest: { include: { problem: { include: { category: true } } } },
        quote: { include: { items: true } },
        repairJob: true,
        payment: true,
        appointment: true,
      },
      orderBy: { createdAt: "desc" },
    });
    return ok({ bookings: items });
  } catch (e) {
    return apiError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const { profile } = await requireCustomerProfile();
    const body = await req.json();
    const parsed = schema.parse(body);

    const rr = await db.repairRequest.findUnique({
      where: { id: parsed.repairRequestId },
      include: { technician: true },
    });
    if (!rr || rr.customerId !== profile.id) throw new HttpError(403, "Not your repair request");
    if (!rr.technicianId) throw new HttpError(400, "No technician selected");

    // Verify the technician is ACTIVE (not PENDING/SUSPENDED).
    if (rr.technician && rr.technician.status !== "ACTIVE") {
      throw new HttpError(400, "This technician is not currently available for bookings.");
    }

    const existing = await db.booking.findUnique({ where: { repairRequestId: parsed.repairRequestId } });
    if (existing) throw new HttpError(409, "Booking already exists for this request");

    const scheduledAt = new Date(parsed.scheduledAt);
    if (isNaN(scheduledAt.getTime())) throw new HttpError(400, "Invalid scheduledAt time");
    if (scheduledAt < new Date()) throw new HttpError(400, "Cannot book in the past");

    // CRITICAL: Check availability + conflict detection (double-booking prevention).
    const rl = checkGeneralRateLimit(profile.userId, "booking");
    if (!rl.allowed) return ok({ error: "Rate limit exceeded", retryAfterMs: rl.retryAfterMs }, 429);

    const availability = await checkAvailability(rr.technicianId, scheduledAt);
    if (!availability.available) {
      throw new HttpError(409, availability.reason ?? "The technician is not available at this time.");
    }

    // CRITICAL: Create booking + repair job + appointment atomically in a
    // Prisma transaction. If any step fails, all are rolled back — no
    // orphan bookings without appointments.
    const booking = await db.$transaction(async (tx) => {
      const b = await tx.booking.create({
        data: {
          repairRequestId: parsed.repairRequestId,
          customerId: profile.id,
          technicianId: rr.technicianId!,
          quoteId: parsed.quoteId as any,
          scheduledAt,
          location: parsed.location,
          notes: parsed.notes,
          status: "REQUESTED",
        },
        include: { technician: true, repairRequest: { include: { problem: { include: { category: true } } } } },
      });

      // Create the repair job immediately (SCHEDULED).
      await tx.repairJob.create({
        data: { bookingId: b.id, status: "SCHEDULED" },
      });

      // Create the appointment record (Phase 3).
      await tx.appointment.create({
        data: {
          bookingId: b.id,
          scheduledAt,
          status: "REQUESTED",
          proposedBy: profile.userId,
        },
      });

      return b;
    });

    await auditLog({
      actorId: profile.userId,
      actorRole: "CUSTOMER",
      action: "booking_created",
      entityType: "booking",
      entityId: booking.id,
      metadata: { technicianId: rr.technicianId, scheduledAt: scheduledAt.toISOString() },
    });

    // Notify technician.
    const tech = await db.technicianProfile.findUnique({
      where: { id: rr.technicianId },
      include: { user: true },
    });
    if (tech) {
      await db.notification.create({
        data: {
          userId: tech.userId,
          type: "booking_requested",
          title: "New booking request",
          body: `A customer requested a booking for ${scheduledAt.toLocaleString()}.`,
          dataJson: JSON.stringify({ bookingId: booking.id }),
        },
      });
    }

    return ok({ booking }, 201);
  } catch (e) {
    return apiError(e);
  }
}
