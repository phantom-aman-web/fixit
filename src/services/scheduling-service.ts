// Scheduling service — real availability, conflict detection, double-booking prevention.
// All time comparisons use UTC Date objects (timezone-safe).

import { db } from "@/lib/db";

// Convert a Date to minutes-from-midnight in the user's local interpretation.
// We store all times as UTC Date objects; the day-of-week is computed in UTC
// for consistency. In production this would use the user's timezone, but for
// Phase 3 (Addis Ababa, UTC+3) we use the Date object directly.
export function getDayOfWeek(date: Date): number {
  return date.getUTCDay();
}

export function getMinutesFromMidnight(date: Date): number {
  return date.getUTCHours() * 60 + date.getUTCMinutes();
}

// Check if a technician is available at the requested time.
// Returns { available: boolean, reason?: string }.
export async function checkAvailability(
  technicianId: string,
  requestedAt: Date,
  durationMinutes = 60,
  excludeBookingId?: string,
): Promise<{ available: boolean; reason?: string }> {
  const dayOfWeek = getDayOfWeek(requestedAt);
  const requestedMinutes = getMinutesFromMidnight(requestedAt);
  const requestedEnd = requestedMinutes + durationMinutes;

  // 1. Check if there's an availability slot for this day of week.
  const slots = await db.availabilitySlot.findMany({
    where: {
      technicianId,
      OR: [
        { dayOfWeek },
        {
          specificDate: {
            gte: new Date(Date.UTC(requestedAt.getUTCFullYear(), requestedAt.getUTCMonth(), requestedAt.getUTCDate())),
            lt: new Date(Date.UTC(requestedAt.getUTCFullYear(), requestedAt.getUTCMonth(), requestedAt.getUTCDate() + 1)),
          },
        },
      ],
    },
  });

  // Separate availability slots from blocks.
  const availSlots = slots.filter((s) => !s.isBlock);
  const blocks = slots.filter((s) => s.isBlock);

  // Check if the requested time falls within any block.
  for (const block of blocks) {
    if (requestedMinutes >= block.startMinutes && requestedMinutes < block.endMinutes) {
      return { available: false, reason: "Technician is blocked during this time." };
    }
  }

  // Check if the requested time falls within at least one availability slot.
  let inSlot = false;
  for (const slot of availSlots) {
    if (requestedMinutes >= slot.startMinutes && requestedEnd <= slot.endMinutes) {
      inSlot = true;
      break;
    }
  }

  // If no slots defined, default to available (technicians who haven't configured
  // availability are treated as flexible). But if slots ARE defined, the request
  // must fall within one.
  if (availSlots.length > 0 && !inSlot) {
    return { available: false, reason: "Requested time is outside the technician's working hours." };
  }

  // 2. Check for booking conflicts (double-booking prevention).
  // A conflict is another booking/appointment that overlaps the requested window.
  const conflictWindowStart = new Date(requestedAt.getTime() - durationMinutes * 60 * 1000);
  const conflictWindowEnd = new Date(requestedAt.getTime() + durationMinutes * 60 * 1000);

  const conflictingBookings = await db.booking.findMany({
    where: {
      technicianId,
      status: { in: ["REQUESTED", "ACCEPTED", "SCHEDULED", "CONFIRMED"] },
      scheduledAt: {
        gte: conflictWindowStart,
        lt: conflictWindowEnd,
      },
      ...(excludeBookingId ? { id: { not: excludeBookingId } } : {}),
    },
  });

  if (conflictingBookings.length > 0) {
    return { available: false, reason: "Technician already has a booking that overlaps this time." };
  }

  return { available: true };
}

// Get available time slots for a technician on a given date.
// Returns an array of { start: Date, end: Date, available: boolean }.
export async function getAvailableSlots(
  technicianId: string,
  date: Date,
  durationMinutes = 60,
): Promise<{ start: Date; end: Date; available: boolean }[]> {
  const dayOfWeek = getDayOfWeek(date);
  const dateStart = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));

  // Get all slots + blocks for this day.
  const slots = await db.availabilitySlot.findMany({
    where: {
      technicianId,
      OR: [
        { dayOfWeek },
        {
          specificDate: {
            gte: dateStart,
            lt: new Date(dateStart.getTime() + 24 * 60 * 60 * 1000),
          },
        },
      ],
    },
  });

  const availSlots = slots.filter((s) => !s.isBlock);
  const blocks = slots.filter((s) => s.isBlock);

  // If no availability slots defined, generate default 9-5 slots.
  const effectiveSlots = availSlots.length > 0 ? availSlots : [
    { startMinutes: 540, endMinutes: 1020 }, // 9:00 AM - 5:00 PM
  ];

  // Generate 1-hour slots within each availability window.
  const result: { start: Date; end: Date; available: boolean }[] = [];
  for (const slot of effectiveSlots) {
    for (let m = slot.startMinutes; m + durationMinutes <= slot.endMinutes; m += durationMinutes) {
      const start = new Date(dateStart.getTime() + m * 60 * 1000);
      const end = new Date(start.getTime() + durationMinutes * 60 * 1000);

      // Check if this slot is blocked.
      const isBlocked = blocks.some((b) => m >= b.startMinutes && m < b.endMinutes);
      if (isBlocked) {
        result.push({ start, end, available: false });
        continue;
      }

      // Check for booking conflicts.
      const check = await checkAvailability(technicianId, start, durationMinutes);
      result.push({ start, end, available: check.available });
    }
  }

  return result;
}

// Create or update availability slots for a technician.
export async function setAvailabilitySlot(
  technicianId: string,
  params: { dayOfWeek?: number; specificDate?: Date; startMinutes: number; endMinutes: number; isBlock?: boolean },
) {
  return db.availabilitySlot.create({
    data: {
      technicianId,
      dayOfWeek: params.dayOfWeek,
      specificDate: params.specificDate,
      startMinutes: params.startMinutes,
      endMinutes: params.endMinutes,
      isBlock: params.isBlock ?? false,
    },
  });
}

// Delete an availability slot.
export async function deleteAvailabilitySlot(technicianId: string, slotId: string) {
  const slot = await db.availabilitySlot.findUnique({ where: { id: slotId } });
  if (!slot || slot.technicianId !== technicianId) {
    throw new Error("Slot not found or not owned by technician");
  }
  return db.availabilitySlot.delete({ where: { id: slotId } });
}
