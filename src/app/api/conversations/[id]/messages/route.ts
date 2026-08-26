import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { ok, unauthorized, apiError, badRequest, notFound } from "@/lib/api";
import { realtimeEmit } from "@/services/notifications";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return unauthorized();

    const { id: conversationId } = await params;
    const conversation = await db.conversation.findUnique({
      where: { id: conversationId },
    });

    if (!conversation) return notFound("Conversation not found");

    let profileId: string | undefined;
    if (session.user.role === "CUSTOMER") {
      const p = await db.customerProfile.findUnique({ where: { userId: session.user.id } });
      profileId = p?.id;
    } else if (session.user.role === "TECHNICIAN") {
      const p = await db.technicianProfile.findUnique({ where: { userId: session.user.id } });
      profileId = p?.id;
    }

    if (!profileId) return unauthorized();

    // Check AuthZ
    if (
      session.user.role === "CUSTOMER" &&
      conversation.customerId !== profileId
    ) {
      return unauthorized();
    }
    if (
      session.user.role === "TECHNICIAN" &&
      conversation.technicianId !== profileId
    ) {
      return unauthorized();
    }

    const searchParams = req.nextUrl.searchParams;
    const after = searchParams.get("after");

    const where: any = { conversationId };
    if (after) {
      // Assuming 'after' is an ISO date string
      where.createdAt = { gt: new Date(after) };
    }

    const messages = await db.message.findMany({
      where,
      orderBy: { createdAt: "asc" },
      take: 100,
    });

    // Mark messages as read if they were sent by the other party and are unread
    const unreadIds = messages
      .filter((m) => m.senderId !== session.user.id && !m.readAt)
      .map((m) => m.id);

    if (unreadIds.length > 0) {
      await db.message.updateMany({
        where: { id: { in: unreadIds } },
        data: { readAt: new Date() },
      });
    }

    return ok({ messages });
  } catch (e: any) {
    return apiError(e);
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return unauthorized();

    const { id: conversationId } = await params;
    const conversation = await db.conversation.findUnique({
      where: { id: conversationId },
      include: {
        customer: { select: { userId: true } },
        technician: { select: { userId: true } },
      }
    });

    if (!conversation) return notFound("Conversation not found");

    let profileId: string | undefined;
    if (session.user.role === "CUSTOMER") {
      const p = await db.customerProfile.findUnique({ where: { userId: session.user.id } });
      profileId = p?.id;
    } else if (session.user.role === "TECHNICIAN") {
      const p = await db.technicianProfile.findUnique({ where: { userId: session.user.id } });
      profileId = p?.id;
    }

    if (!profileId) return unauthorized();

    // Check AuthZ
    if (
      session.user.role === "CUSTOMER" &&
      conversation.customerId !== profileId
    ) {
      return unauthorized();
    }
    if (
      session.user.role === "TECHNICIAN" &&
      conversation.technicianId !== profileId
    ) {
      return unauthorized();
    }

    const body = await req.json();
    const { content } = body;

    if (!content || typeof content !== "string" || content.trim().length === 0) {
      return badRequest("Content is required");
    }

    const message = await db.message.create({
      data: {
        conversationId,
        senderId: session.user.id,
        content: content.trim(),
      },
    });

    // Update conversation updatedAt
    await db.conversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    });

    const recipientUserId = session.user.role === "CUSTOMER"
      ? conversation.technician.userId
      : conversation.customer.userId;

    await realtimeEmit(recipientUserId, "message", message);

    return ok({ message });
  } catch (e: any) {
    return apiError(e);
  }
}
