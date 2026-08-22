import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { ok, apiError, requireCustomerProfile, HttpError } from "@/lib/api";
import { storage } from "@/lib/providers/storage";

const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "video/mp4",
  "video/webm",
]);
const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB

const schema = z.object({
  problemId: z.string(),
  fileName: z.string().min(1).max(255),
  mimeType: z.string().min(1).max(100),
  // base64-encoded data URL or raw base64
  data: z.string().min(1),
});

export async function POST(req: NextRequest) {
  try {
    const { profile } = await requireCustomerProfile();
    const body = await req.json();
    const parsed = schema.parse(body);

    const problem = await db.problemReport.findUnique({ where: { id: parsed.problemId } });
    if (!problem || problem.customerId !== profile.id) throw new HttpError(403, "Not your problem");

    // Validate mime type (server-side, do not trust client blindly).
    if (!ALLOWED_MIME_TYPES.has(parsed.mimeType)) {
      throw new HttpError(400, `Unsupported file type: ${parsed.mimeType}. Allowed: ${[...ALLOWED_MIME_TYPES].join(", ")}`);
    }

    const rawBase64 = parsed.data.replace(/^data:[^;]+;base64,/, "");
    const buffer = Buffer.from(rawBase64, "base64");

    // Validate file size.
    if (buffer.byteLength === 0) throw new HttpError(400, "Empty file");
    if (buffer.byteLength > MAX_FILE_BYTES) {
      throw new HttpError(413, `File too large (max ${MAX_FILE_BYTES / 1024 / 1024}MB)`);
    }

    const stored = await storage.save(buffer, parsed.fileName, parsed.mimeType);

    const media = await db.problemMedia.create({
      data: {
        problemId: parsed.problemId,
        url: stored.key,
        fileName: parsed.fileName,
        mimeType: parsed.mimeType,
        sizeBytes: stored.sizeBytes,
        type: parsed.mimeType.startsWith("video") ? "video" : "image",
      },
    });
    return ok({ media }, 201);
  } catch (e) {
    return apiError(e);
  }
}
