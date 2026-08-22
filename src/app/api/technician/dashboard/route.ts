import { db } from "@/lib/db";
import { ok, apiError, requireTechnicianProfile } from "@/lib/api";

// GET /api/technician/dashboard — operational technician workspace data.
export async function GET() {
  try {
    const { profile } = await requireTechnicianProfile();

    const [todayJobs, incomingRequests, activeJobs, awaitingApproval, awaitingParts, completedThisMonth, totalEarningsAgg, monthEarningsAgg] = await Promise.all([
      // Today's appointments
      db.repairJob.findMany({
        where: {
          booking: { technicianId: profile.id, scheduledAt: {
            gte: new Date(new Date().setHours(0, 0, 0, 0)),
            lt: new Date(new Date().setHours(23, 59, 59, 999)),
          } },
        },
        include: { booking: { include: { customer: { include: { user: true } }, repairRequest: { include: { problem: { include: { category: true } } } }, appointment: true } } },
        orderBy: { createdAt: "asc" },
        take: 10,
      }),
      // Incoming requests (matched but not yet selected/accepted)
      db.repairRequest.findMany({
        where: {
          OR: [
            { technicianId: profile.id, status: "TECHNICIAN_SELECTED" },
            { matches: { some: { technicianId: profile.id } }, status: "MATCHED" },
          ],
        },
        include: { problem: { include: { category: true } }, customer: { include: { user: true } } },
        orderBy: { createdAt: "desc" },
        take: 10,
      }),
      // Active jobs
      db.repairJob.findMany({
        where: { booking: { technicianId: profile.id }, status: { in: ["SCHEDULED", "EN_ROUTE", "ARRIVED", "INSPECTING", "DIAGNOSING", "REPAIRING"] } },
        include: { booking: { include: { customer: { include: { user: true } }, repairRequest: { include: { problem: { include: { category: true } } } } } } },
        orderBy: { updatedAt: "desc" },
        take: 10,
      }),
      // Awaiting customer approval
      db.repairJob.findMany({
        where: { booking: { technicianId: profile.id }, status: "AWAITING_APPROVAL" },
        include: { booking: { include: { customer: { include: { user: true } } } } },
        take: 10,
      }),
      // Completed this month
      db.repairJob.findMany({
        where: {
          booking: { technicianId: profile.id },
          status: "COMPLETED",
          completedAt: { gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) },
        },
        take: 50,
      }),
      // All completed (for stats)
      db.repairJob.findMany({
        where: { booking: { technicianId: profile.id }, status: "COMPLETED" },
        select: { id: true, completedAt: true },
      }),
      // Earnings — computed server-side from actual completed jobs with succeeded payments.
      db.payment.aggregate({
        _sum: { amount: true },
        where: {
          status: "SUCCEEDED",
          booking: { technicianId: profile.id, repairJob: { status: "COMPLETED" } },
        },
      }),
      // This month's earnings
      db.payment.aggregate({
        _sum: { amount: true },
        where: {
          status: "SUCCEEDED",
          booking: { technicianId: profile.id, repairJob: { status: "COMPLETED" } },
          paidAt: { gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) },
        },
      }),
    ]);

    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const jobsThisMonth = completedThisMonth.length;

    // Server-derived earnings from actual succeeded payments for completed jobs.
    const totalEarnings = totalEarningsAgg._sum.amount ?? 0;
    const earningsThisMonth = monthEarningsAgg._sum.amount ?? 0;

    return ok({
      dashboard: {
        today: todayJobs,
        requests: incomingRequests,
        activeJobs,
        awaitingApproval,
        performance: {
          completedJobs: profile.completedJobs,
          rating: profile.rating,
          ratingCount: profile.ratingCount,
          jobsThisMonth,
          responseTimeHours: profile.responseTimeHours,
          cancellationRate: profile.cancellationRate,
        },
        earnings: {
          totalEarnings,
          earningsThisMonth,
          jobsThisMonth,
          pendingPayouts: 0, // Phase 3: no payout system — all earnings are available
        },
      },
    });
  } catch (e) {
    return apiError(e);
  }
}
