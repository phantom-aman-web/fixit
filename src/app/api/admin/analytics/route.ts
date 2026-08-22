import { db } from "@/lib/db";
import { ok, apiError, requireRole } from "@/lib/api";
import { getUsageStats } from "@/lib/ai/usage";

// GET /api/admin/analytics — platform-wide operational + AI analytics.
export async function GET() {
  try {
    await requireRole("ADMIN");

    const [
      totalUsers,
      totalCustomers,
      totalTechnicians,
      totalBookings,
      completedJobs,
      cancelledBookings,
      totalRevenue,
      activeDisputes,
      openWarrantyClaims,
      pendingVerifications,
      totalReviews,
      avgRating,
    ] = await Promise.all([
      db.user.count(),
      db.customerProfile.count(),
      db.technicianProfile.count(),
      db.booking.count(),
      db.repairJob.count({ where: { status: "COMPLETED" } }),
      db.booking.count({ where: { status: "CANCELLED" } }),
      db.payment.aggregate({ _sum: { amount: true }, where: { status: "SUCCEEDED" } }),
      db.dispute.count({ where: { status: { in: ["OPEN", "UNDER_REVIEW"] } } }),
      db.warrantyClaim.count({ where: { status: "OPEN" } }),
      db.technicianDocument.count({ where: { status: "PENDING" } }),
      db.review.count(),
      db.review.aggregate({ _avg: { rating: true } }),
    ]);

    // AI stats
    const aiStats = await getUsageStats();

    // Recent audit log entries
    const recentAudit = await db.auditLog.findMany({
      take: 20,
      orderBy: { createdAt: "desc" },
    });

    return ok({
      analytics: {
        users: { total: totalUsers, customers: totalCustomers, technicians: totalTechnicians },
        bookings: { total: totalBookings, completed: completedJobs, cancelled: cancelledBookings },
        revenue: { totalMinorUnits: totalRevenue._sum.amount ?? 0, currency: "ETB" },
        disputes: { active: activeDisputes },
        warranties: { openClaims: openWarrantyClaims },
        verification: { pending: pendingVerifications },
        reviews: { total: totalReviews, avgRating: avgRating._avg.rating ?? 0 },
        ai: aiStats,
        recentAudit,
      },
    });
  } catch (e) {
    return apiError(e);
  }
}
