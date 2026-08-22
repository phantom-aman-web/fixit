import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, apiError, requireCustomerProfile } from "@/lib/api";
import { z } from "zod";

export async function GET(req: NextRequest) {
  try {
    const { profile } = await requireCustomerProfile();

    const chats = await db.aIChat.findMany({
      where: { customerId: profile.id },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        title: true,
        updatedAt: true,
        diagnosticSessionId: true,
      },
    });

    return ok({ chats });
  } catch (e) {
    return apiError(e);
  }
}

const postSchema = z.object({
  title: z.string().optional(),
  messagesJson: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const { profile } = await requireCustomerProfile();
    
    // Parse body gracefully if it exists
    let body = {};
    try {
      body = await req.json();
    } catch (e) {}
    
    const parsed = postSchema.parse(body);

    const chat = await db.aIChat.create({
      data: {
        customerId: profile.id,
        title: parsed.title || "New Diagnosis",
        messagesJson: parsed.messagesJson || "[]",
      },
    });

    return ok({ chat });
  } catch (e) {
    return apiError(e);
  }
}
