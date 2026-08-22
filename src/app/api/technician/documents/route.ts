import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { ok, apiError, requireTechnicianProfile, HttpError } from "@/lib/api";
import { storage } from "@/lib/providers/storage";

const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf"]);
const MAX_BYTES = 5 * 1024 * 1024;

const schema = z.object({
  type: z.enum(["identity", "certification", "insurance", "other"]),
  fileName: z.string().min(1).max(255),
  mimeType: z.string(),
  data: z.string(), // base64
});

export async function GET() {
  try {
    const { profile } = await requireTechnicianProfile();
    const docs = await db.technicianDocument.findMany({
      where: { technicianId: profile.id },
      orderBy: { createdAt: "desc" },
    });
    return ok({ documents: docs });
  } catch (e) {
    return apiError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const { profile } = await requireTechnicianProfile();
    const body = await req.json();
    const parsed = schema.parse(body);

    if (!ALLOWED_TYPES.has(parsed.mimeType)) {
      throw new HttpError(400, `Unsupported document type. Allowed: ${[...ALLOWED_TYPES].join(", ")}`);
    }
    const buffer = Buffer.from(parsed.data.replace(/^data:[^;]+;base64,/, ""), "base64");
    if (buffer.byteLength > MAX_BYTES) throw new HttpError(413, "Document too large (max 5MB)");

    const stored = await storage.save(buffer, parsed.fileName, parsed.mimeType);
    const doc = await db.technicianDocument.create({
      data: {
        technicianId: profile.id,
        type: parsed.type,
        fileName: parsed.fileName,
        storageKey: stored.key,
        status: "PENDING",
      },
    });
    return ok({ document: doc }, 201);
  } catch (e) {
    return apiError(e);
  }
}
