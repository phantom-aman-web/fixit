import { db } from "@/lib/db";
import { ok, apiError, requireCustomerProfile } from "@/lib/api";

// GET /api/customer/dashboard — prioritized cards for "what needs my attention?"
export async function GET() {
  try {
    const { profile } = await requireCustomerProfile();

    const [activeBookings, pendingQuotes, pendingPayments, activeWarranties, recentEquipment, recentSessions] = await Promise.all([
      db.booking.findMany({
        where: { customerId: profile.id, status: { in: ["REQUESTED", "ACCEPTED", "SCHEDULED", "CONFIRMED"] } },
        include: { technician: true, repairRequest: { include: { problem: { include: { category: true } } } }, repairJob: true, appointment: true },
        orderBy: { scheduledAt: "asc" },
        take: 5,
      }),
      db.quote.findMany({
        where: { repairRequest: { customerId: profile.id }, status: "SUBMITTED" },
        include: { repairRequest: { include: { problem: { include: { category: true } } } }, technician: true },
        orderBy: { createdAt: "desc" },
        take: 5,
      }),
      db.payment.findMany({
        where: { customerId: profile.id, status: "PENDING" },
        include: { booking: { include: { technician: true, repairRequest: { include: { problem: { include: { category: true } } } } } } },
        take: 5,
      }),
      db.warranty.findMany({
        where: { job: { booking: { customerId: profile.id } }, status: "ACTIVE" },
        include: { job: { include: { booking: { include: { technician: true } } } } },
        take: 5,
      }),
      db.customerEquipment.findMany({
        where: { customerId: profile.id },
        include: { category: true },
        orderBy: { createdAt: "desc" },
        take: 5,
      }),
      db.diagnosticSession.findMany({
        where: { customerId: profile.id, status: "IN_PROGRESS" },
        include: { problem: true },
        orderBy: { startedAt: "desc" },
        take: 5,
      }),
    ]);

    return ok({
      dashboard: {
        activeBookings,
        pendingQuotes,
        pendingPayments,
        activeWarranties,
        recentEquipment,
        recentSessions,
        counts: {
          activeBookings: activeBookings.length,
          pendingQuotes: pendingQuotes.length,
          pendingPayments: pendingPayments.length,
          activeWarranties: activeWarranties.length,
        },
      },
    });
  } catch (e) {
    return apiError(e);
  }
}
