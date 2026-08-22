import { ok, apiError, requireRole } from "@/lib/api";
import { getUsageStats } from "@/lib/ai/usage";

export async function GET() {
  try {
    await requireRole("ADMIN");
    const stats = await getUsageStats();
    return ok({ stats });
  } catch (e) {
    return apiError(e);
  }
}
