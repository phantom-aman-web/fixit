import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { ok, apiError, requireAuth } from "@/lib/api";

const updateSchema = z.object({
  name: z.string().min(2).max(80).optional(),
  image: z.string().optional().or(z.literal("")),
});

export async function GET() {
  try {
    const userSession = await requireAuth();
    const user = await db.user.findUnique({
      where: { id: userSession.id },
      select: { id: true, name: true, email: true, image: true, role: true },
    });
    return ok({ user });
  } catch (e) {
    return apiError(e);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const userSession = await requireAuth();
    const body = await req.json();
    const parsed = updateSchema.parse(body);

    const user = await db.user.update({
      where: { id: userSession.id },
      data: {
        name: parsed.name,
        image: parsed.image || null,
      },
      select: { id: true, name: true, email: true, image: true, role: true },
    });

    if (user.role === "TECHNICIAN") {
      const avatarUrl = parsed.image ? `/api/uploads/${parsed.image}` : null;
      await db.technicianProfile.updateMany({
        where: { userId: user.id },
        data: { avatarUrl },
      });
    }

    return ok({ user });
  } catch (e) {
    return apiError(e);
  }
}
