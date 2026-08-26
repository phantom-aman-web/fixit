import { NextRequest } from "next/server";
import { requireAuth, ok, apiError, badRequest } from "@/lib/api";
import { storage } from "@/lib/providers/storage";
import { checkGeneralRateLimit } from "@/lib/rate-limit";
import { randomUUID } from "crypto";

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth();
    const rl = checkGeneralRateLimit(user.id, "upload");
    if (!rl.allowed) return new Response("Too Many Requests", { status: 429 });

    const formData = await req.formData();
    const file = formData.get("file") as File;
    if (!file || !(file instanceof Blob)) {
      return badRequest("No file provided");
    }

    // Limit to 5MB
    if (file.size > 5 * 1024 * 1024) {
      return badRequest("File too large. Maximum size is 5MB.");
    }

    const validTypes = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
    if (!validTypes.includes(file.type)) {
      return badRequest("Invalid file type.");
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const id = randomUUID(); // This is the storage key

    const stored = await storage.save(
      buffer,
      file.name,
      file.type,
    );

    // We do NOT save it to the DB here yet.
    // We just return the key, and the client will pass it to the equipment/warranty creation endpoint.
    return ok({ url: stored.key });
  } catch (e) {
    return apiError(e);
  }
}
