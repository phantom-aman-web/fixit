import { db } from "@/lib/db";
import { ok, apiError, requireAuth } from "@/lib/api";

export async function GET() {
  try {
    const user = await requireAuth();
    const count = await db.notification.count({
      where: { userId: user.id, read: false },
    });
    return ok({ count });
  } catch (e) {
    return apiError(e);
  }
}
