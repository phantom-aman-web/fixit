import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { ok, apiError, requireTechnicianProfile, HttpError } from "@/lib/api";
import { notifyQuoteSubmitted } from "@/services/notifications";

const schema = z.object({
  repairRequestId: z.string(),
  inspectionFee: z.number().int().min(0).default(0),
  labor: z.number().int().min(0).default(0),
  taxesFees: z.number().int().min(0).default(0),
  warrantyMonths: z.number().int().min(0).optional(),
  estimatedDurationHours: z.number().int().min(0).optional(),
  expiresAt: z.string().optional(),
  notes: z.string().optional(),
  items: z.array(z.object({
    description: z.string(),
    quantity: z.number().int().min(1).default(1),
    unitPrice: z.number().int().min(0),
  })).default([]),
});

export async function POST(req: NextRequest) {
  try {
    const { profile } = await requireTechnicianProfile();
    const body = await req.json();
    const parsed = schema.parse(body);

    const rr = await db.repairRequest.findUnique({
      where: { id: parsed.repairRequestId },
      include: { technician: true },
    });
    if (!rr) throw new HttpError(404, "Repair request not found");
    // Only the selected technician may quote. If no technician is selected yet,
    // quoting is not allowed — the customer must select a technician first.
    if (!rr.technicianId || rr.technicianId !== profile.id) {
      throw new HttpError(403, "Only the selected technician can quote this request");
    }

    const partsTotal = parsed.items.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
    const total = parsed.inspectionFee + parsed.labor + partsTotal + parsed.taxesFees;

    // Replace any previous quote.
    const existing = await db.quote.findUnique({ where: { repairRequestId: parsed.repairRequestId } });
    if (existing) {
      await db.quoteItem.deleteMany({ where: { quoteId: existing.id } });
      await db.quote.delete({ where: { id: existing.id } });
    }

    const quote = await db.quote.create({
      data: {
        repairRequestId: parsed.repairRequestId,
        technicianId: profile.id,
        inspectionFee: parsed.inspectionFee,
        labor: parsed.labor,
        partsTotal,
        taxesFees: parsed.taxesFees,
        totalEstimate: total,
        notes: parsed.notes,
        warrantyMonths: parsed.warrantyMonths,
        estimatedDurationHours: parsed.estimatedDurationHours,
        expiresAt: parsed.expiresAt ? new Date(parsed.expiresAt) : undefined,
        items: {
          create: parsed.items.map((i) => ({
            description: i.description,
            quantity: i.quantity,
            unitPrice: i.unitPrice,
            total: i.unitPrice * i.quantity,
          })),
        },
      },
      include: { items: true },
    });

    await db.repairRequest.update({
      where: { id: parsed.repairRequestId },
      data: { status: "QUOTED" },
    });

    // Also update the active Booking to QUOTE_SUBMITTED.
    const activeBooking = await db.booking.findFirst({
      where: { repairRequestId: parsed.repairRequestId, status: "ACCEPTED" },
    });
    if (activeBooking) {
      await db.booking.update({
        where: { id: activeBooking.id },
        data: { status: "QUOTE_SUBMITTED", quoteId: quote.id },
      });
    }

    await notifyQuoteSubmitted(quote.id);

    return ok({ quote }, 201);
  } catch (e) {
    return apiError(e);
  }
}
