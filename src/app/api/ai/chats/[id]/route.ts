import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, apiError, requireCustomerProfile, HttpError } from "@/lib/api";
import { z } from "zod";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { profile } = await requireCustomerProfile();
    const { id } = await params;

    const chat = await db.aIChat.findUnique({
      where: { id },
    });

    if (!chat || chat.customerId !== profile.id) {
      throw new HttpError(404, "Chat not found");
    }

    return ok({ chat });
  } catch (e) {
    return apiError(e);
  }
}

const patchSchema = z.object({
  messagesJson: z.string().optional(),
  title: z.string().optional(),
  diagnosticSessionId: z.string().optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { profile } = await requireCustomerProfile();
    const body = await req.json();
    const parsed = patchSchema.parse(body);
    const { id } = await params;

    const chat = await db.aIChat.findUnique({
      where: { id },
    });

    if (!chat || chat.customerId !== profile.id) {
      throw new HttpError(404, "Chat not found");
    }

    const updated = await db.aIChat.update({
      where: { id },
      data: parsed,
    });

    return ok({ chat: updated });
  } catch (e) {
    return apiError(e);
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { profile } = await requireCustomerProfile();
    const { id } = await params;

    const chat = await db.aIChat.findUnique({
      where: { id },
    });

    if (!chat || chat.customerId !== profile.id) {
      throw new HttpError(404, "Chat not found");
    }

    await db.aIChat.delete({
      where: { id },
    });

    return ok({ success: true });
  } catch (e) {
    return apiError(e);
  }
}
