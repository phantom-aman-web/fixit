import { db } from "@/lib/db";
import { ok, apiError, requireAuth } from "@/lib/api";

export async function GET() {
  try {
    const user = await requireAuth();
    const items = await db.notification.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    return ok({ notifications: items });
  } catch (e) {
    return apiError(e);
  }
}
