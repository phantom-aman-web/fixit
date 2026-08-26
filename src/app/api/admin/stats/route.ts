import { db } from "@/lib/db";
import { ok, apiError, requireRole } from "@/lib/api";

export async function GET() {
  try {
    await requireRole("ADMIN");
    const [users, technicians, jobs, sessions, reviews] = await Promise.all([
      db.user.count(),
      db.technicianProfile.count(),
      db.repairJob.count(),
      db.diagnosticSession.count(),
      db.review.count(),
    ]);
    const recentJobs = await db.repairJob.findMany({
      take: 10,
      orderBy: { createdAt: "desc" },
      include: { booking: { include: { customer: { include: { user: { select: { id: true, name: true, email: true, image: true, role: true } } } }, technician: true, repairRequest: { include: { problem: { include: { category: true } } } } } } },
    });
    return ok({ stats: { users, technicians, jobs, sessions, reviews }, recentJobs });
  } catch (e) {
    return apiError(e);
  }
}

