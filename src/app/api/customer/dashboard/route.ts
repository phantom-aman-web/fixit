import { db } from "@/lib/db";
import { ok, apiError, requireCustomerProfile } from "@/lib/api";

// GET /api/customer/dashboard — prioritized cards for "what needs my attention?"
export async function GET() {
  try {
    const { profile } = await requireCustomerProfile();

    const [activeBookings, pendingQuotes, pendingPayments, activeWarranties, recentEquipment, recentSessions] = await Promise.all([
      db.booking.findMany({
        where: { customerId: profile.id, status: { in: ["REQUESTED", "ACCEPTED", "SCHEDULED", "CONFIRMED"] } },
        select: {
          id: true,
          status: true,
          scheduledAt: true,
          location: true,
          technician: { select: { id: true, displayName: true, verified: true } },
          repairRequest: { select: { id: true, problem: { select: { id: true, description: true, category: { select: { id: true, slug: true, name: true } } } } } },
          repairJob: { select: { id: true, status: true } },
          appointment: { select: { id: true, scheduledAt: true, endsAt: true, status: true } },
        },
        orderBy: { scheduledAt: "asc" },
        take: 5,
      }),
      db.quote.findMany({
        where: { repairRequest: { customerId: profile.id }, status: "SUBMITTED" },
        select: {
          id: true,
          totalEstimate: true,
          currency: true,
          status: true,
          createdAt: true,
          repairRequest: { select: { id: true, problem: { select: { id: true, description: true, category: { select: { id: true, slug: true, name: true } } } } } },
          technician: { select: { id: true, displayName: true, verified: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 5,
      }),
      db.payment.findMany({
        where: { customerId: profile.id, status: "PENDING" },
        select: {
          id: true,
          amount: true,
          currency: true,
          status: true,
          booking: {
            select: {
              id: true,
              technician: { select: { id: true, displayName: true, verified: true } },
              repairRequest: { select: { id: true, problem: { select: { id: true, description: true, category: { select: { id: true, slug: true, name: true } } } } } },
            },
          },
        },
        take: 5,
      }),
      db.warranty.findMany({
        where: { job: { booking: { customerId: profile.id } }, status: "ACTIVE" },
        select: {
          id: true,
          endDate: true,
          status: true,
          coveredWork: true,
          job: {
            select: {
              id: true,
              booking: { select: { id: true, technician: { select: { id: true, displayName: true, verified: true } } } },
            },
          },
        },
        take: 5,
      }),
      db.customerEquipment.findMany({
        where: { customerId: profile.id },
        select: {
          id: true,
          nickname: true,
          brand: true,
          model: true,
          category: { select: { id: true, slug: true, name: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 5,
      }),
      db.diagnosticSession.findMany({
        where: { customerId: profile.id, status: "IN_PROGRESS" },
        select: {
          id: true,
          status: true,
          startedAt: true,
          categoryId: true,
          problem: { select: { id: true, description: true } },
        },
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
