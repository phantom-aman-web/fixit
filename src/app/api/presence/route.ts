import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { ok, unauthorized, apiError } from "@/lib/api";

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return unauthorized();

    await db.user.update({
      where: { id: session.user.id },
      data: { lastSeenAt: new Date() },
    });

    return ok({ success: true });
  } catch (e: any) {
    return apiError(e);
  }
}
