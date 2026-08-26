import { db } from "@/lib/db";
import { notifyJobStatus } from "@/services/notifications";

// Push realtime event to the customer's channel.
async function realtimeJobStatus(jobId: string, status: string, customerId?: string) {
  try {
    let uid = customerId;
    if (!uid) {
      const j = await db.repairJob.findUnique({
        where: { id: jobId },
        include: { booking: { include: { customer: true } } },
      });
      uid = j?.booking.customer.userId;
    }
    if (!uid) return;
    await fetch("http://127.0.0.1:3003/emit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ channel: uid, event: "job:status", payload: { jobId, status } }),
    });
  } catch {
    /* realtime is best-effort */
  }
}

// Enforced state transitions for Booking and RepairJob.

const BOOKING_TRANSITIONS: Record<string, string[]> = {
  REQUESTED: ["ACCEPTED", "CANCELLED"],
  ACCEPTED: ["QUOTE_SUBMITTED", "CANCELLED"],
  QUOTE_SUBMITTED: ["AWAITING_PAYMENT", "CANCELLED"],
  AWAITING_PAYMENT: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["COMPLETED", "CANCELLED"],
  COMPLETED: [],
  CANCELLED: [],
};

const REPAIR_JOB_TRANSITIONS: Record<string, string[]> = {
  SCHEDULED: ["EN_ROUTE", "CANCELLED"],
  EN_ROUTE: ["ARRIVED", "CANCELLED"],
  ARRIVED: ["INSPECTING", "CANCELLED"],
  INSPECTING: ["DIAGNOSING", "CANCELLED"],
  DIAGNOSING: ["REPAIRING", "CANCELLED"],
  REPAIRING: ["COMPLETED", "CANCELLED"],
  COMPLETED: [],
  CANCELLED: [],
};

export function canTransition(machine: "BOOKING" | "REPAIR_JOB", from: string, to: string): boolean {
  const map = machine === "BOOKING" ? BOOKING_TRANSITIONS : REPAIR_JOB_TRANSITIONS;
  return (map[from] ?? []).includes(to);
}

export function assertTransition(machine: "BOOKING" | "REPAIR_JOB", from: string, to: string) {
  if (!canTransition(machine, from, to)) {
    throw new Error(`Invalid ${machine} transition: ${from} → ${to}`);
  }
}

export async function transitionBooking(bookingId: string, to: string, note?: string) {
  const booking = await db.booking.findUnique({ where: { id: bookingId } });
  if (!booking) throw new Error("Booking not found");
  assertTransition("BOOKING", booking.status, to);
  const updated = await db.booking.update({
    where: { id: bookingId },
    data: { status: to },
  });
  // If booking is confirmed, create the repair job.
  if (to === "CONFIRMED") {
    const existingJob = await db.repairJob.findUnique({ where: { bookingId } });
    if (!existingJob) {
      await db.repairJob.create({
        data: { bookingId, status: "SCHEDULED" },
      });
    }
  }

  // If booking completes, complete the repair job too.
  if (to === "COMPLETED") {
    const job = await db.repairJob.findUnique({ where: { bookingId } });
    if (job && canTransition("REPAIR_JOB", job.status, "COMPLETED")) {
      await transitionRepairJob(job.id, "COMPLETED", note);
    }
  }
  return updated;
}

export async function transitionRepairJob(jobId: string, to: string, note?: string) {
  const job = await db.repairJob.findUnique({ where: { id: jobId } });
  if (!job) throw new Error("Repair job not found");
  assertTransition("REPAIR_JOB", job.status, to);
  const data: any = { status: to };
  if (to === "REPAIRING" && !job.startedAt) data.startedAt = new Date();
  if (to === "COMPLETED") data.completedAt = new Date();
  const updated = await db.repairJob.update({ where: { id: jobId }, data });
  await db.repairStatusHistory.create({
    data: { jobId, status: to, note },
  });

  if (to === "COMPLETED") {
    const booking = await db.booking.findUnique({ where: { id: job.bookingId } });
    if (booking && canTransition("BOOKING", booking.status, "COMPLETED")) {
      await transitionBooking(booking.id, "COMPLETED", note);
    }
  }

  await notifyJobStatus(jobId, to);
  await realtimeJobStatus(jobId, to);
  return updated;
}
