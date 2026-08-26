import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, apiError, HttpError } from "@/lib/api";

import { getSessionUser } from "@/lib/api";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const tech = await db.technicianProfile.findUnique({
      where: { id },
      include: {
        user: { select: { lastSeenAt: true, image: true } },
        skills: true,
        serviceAreas: { include: { serviceArea: true } },
        reviews: {
          include: { 
            customer: { 
              include: { 
                user: {
                  select: { name: true, image: true, id: true }
                } 
              } 
            } 
          },
          orderBy: { createdAt: "desc" },
          take: 20,
        },
        _count: {
          select: { bookings: { where: { status: "COMPLETED" } } }
        }
      },
    });
    if (!tech) throw new HttpError(404, "Technician not found");

    const user = await getSessionUser();
    let canMessage = false;

    if (user && user.role === "CUSTOMER") {
      const customer = await db.customerProfile.findUnique({ where: { userId: user.id } });
      if (customer) {
        const hasBooking = await db.booking.findFirst({
          where: {
            customerId: customer.id,
            technicianId: id,
            status: { in: ["CONFIRMED", "COMPLETED"] },
          },
        });
        if (hasBooking) canMessage = true;
      }
    } else if (user && (user.role === "TECHNICIAN" || user.role === "ADMIN")) {
      canMessage = true;
    }

    const { _count, ...rest } = tech;
    const mapped = {
      ...rest,
      completedJobs: _count.bookings,
      avatarUrl: tech.user.image ? `/api/uploads/${tech.user.image}` : null,
      canMessage,
    };
    return ok({ technician: mapped });
  } catch (e) {
    return apiError(e);
  }
}
