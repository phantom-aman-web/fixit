import { db } from "@/lib/db";
import {
  emailWelcome,
  emailRepairRequestCreated,
  emailTechnicianAssigned,
  emailJobAssignedTech,
  emailQuoteReceived,
  emailQuoteDecision,
  emailJobStatus,
  emailPaymentReceipt,
  emailAccountStatus,
} from "@/services/email-service";

// Push to the realtime mini-service via its local HTTP endpoint.
// The mini-service then emits to the user's socket.io channel.
export async function realtimeEmit(channel: string, event: string, payload: unknown) {
  try {
    await fetch("http://127.0.0.1:3003/emit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ channel, event, payload }),
    });
  } catch {
    // Realtime is a UX nicety; never fail the business operation on it.
  }
}

// Map notification types to preference categories.
// If the user has disabled a category, the notification is NOT created.
const TYPE_TO_PREFERENCE: Record<string, string> = {
  booking_accepted: "bookingUpdates",
  booking_requested: "bookingUpdates",
  appointment_changed: "bookingUpdates",
  quote_submitted: "bookingUpdates",
  quote_approved: "bookingUpdates",
  quote_rejected: "bookingUpdates",
  repair_status: "repairUpdates",
  booking_accepted_tech: "repairUpdates",
  review_received: "repairUpdates",
  technician_accepted: "repairUpdates",
  repair_request_received: "repairUpdates",
  payment_required: "paymentNotifications",
  payment_completed: "paymentNotifications",
  warranty_expiring: "warrantyReminders",
  review_reminder: "reviewRequests",
  dispute_created: "disputeUpdates",
  dispute_updated: "disputeUpdates",
  verification_update: "bookingUpdates",
};

// Check if the user has enabled this notification type. If no preference
// record exists, default to enabled (all notifications on).
async function isNotificationEnabled(userId: string, type: string): Promise<boolean> {
  try {
    const pref = await db.notificationPreference.findUnique({ where: { userId } });
    if (!pref) return true; // default: all enabled
    const prefKey = TYPE_TO_PREFERENCE[type];
    if (!prefKey) return true; // unmapped types default to enabled
    return (pref as any)[prefKey] ?? true;
  } catch {
    return true; // on error, default to enabled
  }
}

export async function notify(params: {
  userId: string;
  type: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
}) {
  // Check user preferences — skip if disabled.
  const enabled = await isNotificationEnabled(params.userId, params.type);
  if (!enabled) return null;

  const n = await db.notification.create({
    data: {
      userId: params.userId,
      type: params.type,
      title: params.title,
      body: params.body,
      dataJson: params.data ? JSON.stringify(params.data) : null,
    },
  });
  await realtimeEmit(params.userId, "notification", n);
  return n;
}

// ── Business event notification functions ────────────────────────────────────
// Each function handles BOTH in-app notification AND email.
// Email is always fire-and-forget: email failure NEVER fails the business operation.

export async function notifyBookingAccepted(bookingId: string) {
  const b = await db.booking.findUnique({
    where: { id: bookingId },
    include: { customer: { include: { user: true } } },
  });
  if (!b) return;
  await notify({
    userId: b.customer.userId,
    type: "booking_accepted",
    title: "Technician accepted your request",
    body: `Your booking has been accepted and is being scheduled.`,
    data: { bookingId },
  });
}

export async function notifyQuoteSubmitted(quoteId: string) {
  const q = await db.quote.findUnique({
    where: { id: quoteId },
    include: {
      repairRequest: {
        include: {
          customer: { include: { user: true } },
          problem: { include: { category: true, equipment: true } },
        },
      },
    },
  });
  if (!q) return;

  await notify({
    userId: q.repairRequest.customer.userId,
    type: "quote_submitted",
    title: "Quote submitted",
    body: `A quote of ${q.totalEstimate} has been submitted for your repair.`,
    data: { quoteId },
  });

  // Email: quote received — fire and forget.
  const user = q.repairRequest.customer.user;
  const equipment = q.repairRequest.problem.equipment;
  const category = q.repairRequest.problem.category;
  const equipmentName = equipment
    ? `${equipment.brand ?? ""} ${equipment.model ?? ""}`.trim() || category.name
    : category.name;

  void emailQuoteReceived({
    customerUserId: q.repairRequest.customer.userId,
    customerName: user.name ?? user.email,
    customerEmail: user.email,
    quoteId: q.id,
    equipmentName,
    totalEstimate: q.totalEstimate,
    currency: q.currency,
  });
}

export async function notifyQuoteDecision(quoteId: string, approved: boolean) {
  const q = await db.quote.findUnique({
    where: { id: quoteId },
    include: {
      technician: { include: { user: true } },
      repairRequest: { include: { problem: { include: { category: true, equipment: true } } } },
    },
  });
  if (!q) return;

  await notify({
    userId: q.technician.userId,
    type: approved ? "quote_approved" : "quote_rejected",
    title: approved ? "Quote approved" : "Quote rejected",
    body: approved
      ? `The customer approved your quote. You can now begin the repair.`
      : `The customer rejected your quote.`,
    data: { quoteId },
  });

  // Email: quote decision — fire and forget.
  const user = q.technician.user;
  const equipment = q.repairRequest.problem.equipment;
  const category = q.repairRequest.problem.category;
  const equipmentName = equipment
    ? `${equipment.brand ?? ""} ${equipment.model ?? ""}`.trim() || category.name
    : category.name;

  void emailQuoteDecision({
    techUserId: q.technician.userId,
    techName: q.technician.displayName,
    techEmail: user.email,
    quoteId: q.id,
    equipmentName,
    decision: approved ? "APPROVED" : "REJECTED",
  });
}

export async function notifyJobStatus(jobId: string, status: string) {
  const job = await db.repairJob.findUnique({
    where: { id: jobId },
    include: {
      booking: {
        include: {
          customer: { include: { user: true } },
          repairRequest: { include: { problem: { include: { category: true, equipment: true } } } },
        },
      },
    },
  });
  if (!job) return;

  const statusLabel = status.replaceAll("_", " ").toLowerCase();

  await notify({
    userId: job.booking.customer.userId,
    type: "repair_status",
    title: "Repair status updated",
    body: `Your repair is now: ${statusLabel}.`,
    data: { jobId, status },
  });

  // Email: job status — fire and forget.
  const user = job.booking.customer.user;
  const equipment = job.booking.repairRequest.problem.equipment;
  const category = job.booking.repairRequest.problem.category;
  const equipmentName = equipment
    ? `${equipment.brand ?? ""} ${equipment.model ?? ""}`.trim() || category.name
    : category.name;

  void emailJobStatus({
    customerUserId: job.booking.customer.userId,
    customerName: user.name ?? user.email,
    customerEmail: user.email,
    jobId,
    equipmentName,
    newStatus: status,
    statusLabel,
  });
}

export async function notifyReviewSubmitted(reviewId: string) {
  const r = await db.review.findUnique({
    where: { id: reviewId },
    include: { technician: { include: { user: true } } },
  });
  if (!r) return;
  await notify({
    userId: r.technician.userId,
    type: "review_received",
    title: "You received a review",
    body: `A customer rated you ${r.rating}/5.`,
    data: { reviewId },
  });
}

export async function notifyWarrantyExpiring(warrantyId: string) {
  const w = await db.warranty.findUnique({
    where: { id: warrantyId },
    include: { job: { include: { booking: { include: { customer: { include: { user: true } } } } } } },
  });
  if (!w) return;
  await notify({
    userId: w.job.booking.customer.userId,
    type: "warranty_expiring",
    title: "Warranty expiring soon",
    body: `Your warranty ends on ${w.endDate.toLocaleDateString()}.`,
    data: { warrantyId },
  });
}

// ── Welcome email (auth only — no in-app notification needed) ─────────────────

export async function notifyWelcome(params: {
  userId: string;
  name: string;
  email: string;
}) {
  // Welcome email only — no in-app notification for registration.
  void emailWelcome(params);
}

// ── Technician assignment notifications ──────────────────────────────────────

export async function notifyTechnicianAssigned(params: {
  requestId: string;
  customerId: string;       // CustomerProfile.id
  technicianId: string;     // TechnicianProfile.id
  scheduledAt: Date;
}) {
  const [cust, tech] = await Promise.all([
    db.customerProfile.findUnique({
      where: { id: params.customerId },
      include: { user: true },
    }),
    db.technicianProfile.findUnique({
      where: { id: params.technicianId },
      include: { user: true },
    }),
  ]);

  const rr = await db.repairRequest.findUnique({
    where: { id: params.requestId },
    include: { problem: { include: { category: true, equipment: true } } },
  });

  if (!cust || !tech || !rr) return;

  const equipment = rr.problem.equipment;
  const category = rr.problem.category;
  const equipmentName = equipment
    ? `${equipment.brand ?? ""} ${equipment.model ?? ""}`.trim() || category.name
    : category.name;

  // In-app notification to customer.
  await notify({
    userId: cust.userId,
    type: "technician_accepted",
    title: "Technician assigned to your request",
    body: `${tech.displayName} has been assigned to your repair.`,
    data: { requestId: params.requestId },
  });

  // In-app notification to technician.
  await notify({
    userId: tech.userId,
    type: "repair_request_received",
    title: "New repair job assigned",
    body: `You have been assigned a repair job.`,
    data: { requestId: params.requestId },
  });

  // Emails — fire and forget.
  void emailTechnicianAssigned({
    customerUserId: cust.userId,
    customerName: cust.user.name ?? cust.user.email,
    customerEmail: cust.user.email,
    technicianName: tech.displayName,
    equipmentName,
    scheduledAt: params.scheduledAt,
    requestId: params.requestId,
  });

  void emailJobAssignedTech({
    techUserId: tech.userId,
    techName: tech.displayName,
    techEmail: tech.user.email,
    customerFirstName: (cust.user.name ?? cust.user.email).split(" ")[0],
    equipmentName,
    scheduledAt: params.scheduledAt,
    requestId: params.requestId,
  });
}

// ── Account status notification (technician verification) ────────────────────

export async function notifyAccountStatus(params: {
  technicianId: string; // TechnicianProfile.id
  newStatus: "ACTIVE" | "SUSPENDED";
}) {
  const tech = await db.technicianProfile.findUnique({
    where: { id: params.technicianId },
    include: { user: true },
  });
  if (!tech) return;

  // In-app notification.
  await notify({
    userId: tech.userId,
    type: "verification_update",
    title: params.newStatus === "ACTIVE" ? "Your account has been approved" : "Your account has been suspended",
    body: params.newStatus === "ACTIVE" ? "You can now receive repair requests." : "Please contact support.",
    data: { technicianId: params.technicianId },
  });

  // Email — fire and forget.
  void emailAccountStatus({
    techUserId: tech.userId,
    techName: tech.displayName,
    techEmail: tech.user.email,
    newStatus: params.newStatus,
  });
}

// ── Payment receipt notification ─────────────────────────────────────────────

export async function notifyPaymentSucceeded(params: {
  jobId: string;
  amount: number;
  currency: string;
  paidAt: Date;
}) {
  const job = await db.repairJob.findUnique({
    where: { id: params.jobId },
    include: {
      booking: {
        include: {
          customer: { include: { user: true } },
          repairRequest: { include: { problem: { include: { category: true, equipment: true } } } },
        },
      },
    },
  });
  if (!job) return;

  const user = job.booking.customer.user;
  const equipment = job.booking.repairRequest.problem.equipment;
  const category = job.booking.repairRequest.problem.category;
  const equipmentName = equipment
    ? `${equipment.brand ?? ""} ${equipment.model ?? ""}`.trim() || category.name
    : category.name;

  // Email receipt — fire and forget.
  void emailPaymentReceipt({
    customerUserId: job.booking.customer.userId,
    customerName: user.name ?? user.email,
    customerEmail: user.email,
    jobId: params.jobId,
    equipmentName,
    amount: params.amount,
    currency: params.currency,
    paidAt: params.paidAt,
  });
}
