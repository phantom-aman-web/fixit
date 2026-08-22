import { db } from "@/lib/db";
import { ok, apiError, requireCustomerProfile } from "@/lib/api";

export async function GET() {
  try {
    const { profile } = await requireCustomerProfile();
    const items = await db.warranty.findMany({
      where: { job: { booking: { customerId: profile.id } } },
      include: { job: { include: { booking: { include: { technician: true, repairRequest: { include: { problem: { include: { category: true } } } } } } } } },
      orderBy: { endDate: "asc" },
    });
    return ok({ warranties: items });
  } catch (e) {
    return apiError(e);
  }
}
