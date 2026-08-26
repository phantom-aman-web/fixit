import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, apiError, requireTechnicianProfile, unauthorized, notFound } from "@/lib/api";

export async function DELETE(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await props.params;
    const { profile: techProfile } = await requireTechnicianProfile();

    const warranty = await db.warranty.findUnique({
      where: { id },
      include: { job: { include: { booking: true } } }
    });

    if (!warranty) return notFound();
    if (warranty.job.booking.technicianId !== techProfile.id) return unauthorized();

    await db.warranty.delete({ where: { id } });

    return ok({ success: true });
  } catch (e) {
    return apiError(e);
  }
}

export async function PUT(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await props.params;
    const { profile: techProfile } = await requireTechnicianProfile();
    const body = await req.json();
    const { durationMonths, coveredWork, documentUrl } = body;

    const warranty = await db.warranty.findUnique({
      where: { id },
      include: { job: { include: { booking: true } } }
    });

    if (!warranty) return notFound();
    if (warranty.job.booking.technicianId !== techProfile.id) return unauthorized();

    const startDate = warranty.startDate;
    const endDate = new Date(startDate);
    endDate.setMonth(endDate.getMonth() + parseInt(durationMonths));

    const updated = await db.warranty.update({
      where: { id },
      data: {
        durationMonths: parseInt(durationMonths),
        coveredWork,
        documentUrl: documentUrl !== undefined ? documentUrl : warranty.documentUrl,
        endDate
      }
    });

    return ok({ warranty: updated });
  } catch (e) {
    return apiError(e);
  }
}
