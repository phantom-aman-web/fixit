import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, apiError, requireAuth, HttpError } from "@/lib/api";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAuth();
    const { id } = await params;
    const n = await db.notification.findUnique({ where: { id } });
    if (!n || n.userId !== user.id) throw new HttpError(404, "Notification not found");
    await db.notification.update({ where: { id }, data: { read: true } });
    return ok({ ok: true });
  } catch (e) {
    return apiError(e);
  }
}
