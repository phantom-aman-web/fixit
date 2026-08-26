import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { ok, unauthorized, apiError, badRequest } from "@/lib/api";

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
      return ok({ conversations: [] });
    }

    // Fetch conversations where the user is either the customer or the technician
    const conversations = await db.conversation.findMany({
      where: role === "TECHNICIAN" ? { technicianId: profileId } : { customerId: profileId },
      include: {
        customer: {
          select: { user: { select: { name: true, lastSeenAt: true, image: true } } },
        },
        technician: {
          select: {
            id: true,
            displayName: true,
            rating: true,
            ratingCount: true,
            completedJobs: true,
            yearsExperience: true,
            bio: true,
            baseCallOutFee: true,
            hourlyRate: true,
            phone: true,
            user: { select: { lastSeenAt: true, image: true } },
          },
        },
        messages: {
          orderBy: { createdAt: "desc" },
          take: 1, // Get the last message
        },
        _count: {
          select: {
            messages: {
              where: {
                readAt: null,
                senderId: { not: userId },
              },
            },
          },
        },
      },
      orderBy: { updatedAt: "desc" },
    });

    return ok({ conversations });
  } catch (e: any) {
    return apiError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return unauthorized();

    const body = await req.json();
    const { technicianId, customerId } = body;

    // Determine who is starting it
    const role = session.user.role;
    let actualCustomerId = customerId;
    let actualTechnicianId = technicianId;

    if (role === "CUSTOMER") {
      const custProfile = await db.customerProfile.findUnique({ where: { userId: session.user.id } });
      if (!custProfile) return unauthorized();
      actualCustomerId = custProfile.id;
    } else if (role === "TECHNICIAN") {
      const techProfile = await db.technicianProfile.findUnique({ where: { userId: session.user.id } });
      if (!techProfile) return unauthorized();
      actualTechnicianId = techProfile.id;
    }

    if (!actualCustomerId || !actualTechnicianId) {
      return badRequest("Both customerId and technicianId are required");
    }

    // Check if it already exists to avoid dupes
    let conversation = await db.conversation.findUnique({
      where: {
        customerId_technicianId: {
          customerId: actualCustomerId,
          technicianId: actualTechnicianId,
        },
      },
    });

    if (!conversation) {
      conversation = await db.conversation.create({
        data: {
          customerId: actualCustomerId,
          technicianId: actualTechnicianId,
        },
      });
    }

    return ok({ conversation });
  } catch (e: any) {
    return apiError(e);
  }
}
