import { db } from "@/lib/db";

// Push to the realtime mini-service via its local HTTP endpoint.
// The mini-service then emits to the user's socket.io channel.
async function realtimeEmit(channel: string, event: string, payload: unknown) {
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
    include: { repairRequest: { include: { customer: { include: { user: true } } } } },
  });
  if (!q) return;
  await notify({
    userId: q.repairRequest.customer.userId,
    type: "quote_submitted",
    title: "Quote submitted",
    body: `A quote of ${q.totalEstimate} (minor units) has been submitted for your repair.`,
    data: { quoteId },
  });
}

export async function notifyQuoteDecision(quoteId: string, approved: boolean) {
  const q = await db.quote.findUnique({
    where: { id: quoteId },
    include: { technician: { include: { user: true } } },
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
}

export async function notifyJobStatus(jobId: string, status: string) {
  const job = await db.repairJob.findUnique({
    where: { id: jobId },
    include: { booking: { include: { customer: { include: { user: true } } } } },
  });
  if (!job) return;
  await notify({
    userId: job.booking.customer.userId,
    type: "repair_status",
    title: "Repair status updated",
    body: `Your repair is now: ${status.replaceAll("_", " ").toLowerCase()}.`,
    data: { jobId, status },
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
