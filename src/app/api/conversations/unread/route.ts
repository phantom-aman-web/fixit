import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { ok, unauthorized, apiError } from "@/lib/api";

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return unauthorized();

    const role = session.user.role;
    const userId = session.user.id;

    let profileId: string | undefined;
    if (role === "CUSTOMER") {
      const p = await db.customerProfile.findUnique({ where: { userId } });
      profileId = p?.id;
    } else if (role === "TECHNICIAN") {
      const p = await db.technicianProfile.findUnique({ where: { userId } });
      profileId = p?.id;
    }

    if (!profileId) {
      return ok({ unread: 0 });
    }

    const unread = await db.message.count({
      where: {
        readAt: null,
        senderId: { not: userId },
        conversation: role === "TECHNICIAN" 
          ? { technicianId: profileId } 
          : { customerId: profileId }
      }
    });

    return ok({ unread });
  } catch (e: any) {
    return apiError(e);
  }
}
