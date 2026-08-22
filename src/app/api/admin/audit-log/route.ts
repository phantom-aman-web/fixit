import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, apiError, requireRole } from "@/lib/api";

// GET /api/admin/audit-log — admin views audit log.
export async function GET(req: NextRequest) {
  try {
    await requireRole("ADMIN");
    const { searchParams } = new URL(req.url);
    const entityType = searchParams.get("entityType");
    const action = searchParams.get("action");
    const take = Math.min(Number(searchParams.get("take") || "50"), 200);

    const logs = await db.auditLog.findMany({
      where: {
        ...(entityType ? { entityType } : {}),
        ...(action ? { action } : {}),
      },
      orderBy: { createdAt: "desc" },
      take,
    });
    return ok({ logs });
  } catch (e) {
    return apiError(e);
  }
}
