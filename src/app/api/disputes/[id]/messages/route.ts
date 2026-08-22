import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { ok, apiError, requireAuth, HttpError } from "@/lib/api";

const schema = z.object({ message: z.string().min(1).max(2000) });

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAuth();
    const { id } = await params;
    const body = await req.json();
    const parsed = schema.parse(body);

    const dispute = await db.dispute.findUnique({
      where: { id },
      include: { job: { include: { booking: true } } },
    });
    if (!dispute) throw new HttpError(404, "Dispute not found");

    // Authorization: customer who opened, assigned technician, or admin.
    const cp = await db.customerProfile.findUnique({ where: { userId: user.id } });
    const tp = await db.technicianProfile.findUnique({ where: { userId: user.id } });
    const isOwner = cp && dispute.customerId === cp.id;
    const isTech = tp && dispute.technicianId === tp.id;
    if (user.role !== "ADMIN" && !isOwner && !isTech) throw new HttpError(403, "Not authorized");

    const authorRole = isOwner ? "customer" : isTech ? "technician" : "admin";
    const msg = await db.disputeMessage.create({
      data: {
        disputeId: id,
        authorId: user.id,
        authorRole,
        message: parsed.message,
      },
    });

    return ok({ message: msg }, 201);
  } catch (e) {
    return apiError(e);
  }
}
