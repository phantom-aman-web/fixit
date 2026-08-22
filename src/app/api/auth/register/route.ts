import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { db } from "@/lib/db";
import { ok, apiError, HttpError } from "@/lib/api";
import { ADDIS_ABABA_AREAS } from "@/lib/geo";
import { checkGeneralRateLimit } from "@/lib/rate-limit";
import { auditLog } from "@/services/audit-service";

const schema = z.object({
  name: z.string().min(2).max(80),
  email: z.string().email(),
  password: z.string().min(6).max(100),
  role: z.enum(["CUSTOMER", "TECHNICIAN"]).default("CUSTOMER"),
  subCity: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    // Rate limit registration by IP to prevent abuse.
    const ip = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown";
    const rl = checkGeneralRateLimit(ip, "register");
    if (!rl.allowed) {
      return ok({ error: "Too many registration attempts. Please wait a minute.", retryAfterMs: rl.retryAfterMs }, 429);
    }

    const body = await req.json();
    const parsed = schema.parse(body);
    const email = parsed.email.trim().toLowerCase();

    const existing = await db.user.findUnique({ where: { email } });
    if (existing) throw new HttpError(409, "Email already registered");

    const passwordHash = await bcrypt.hash(parsed.password, 10);
    const user = await db.user.create({
      data: {
        email,
        name: parsed.name,
        role: parsed.role,
        passwordHash,
      },
    });

    if (parsed.role === "CUSTOMER") {
      const area = parsed.subCity ? ADDIS_ABABA_AREAS[parsed.subCity] : undefined;
      await db.customerProfile.create({
        data: {
          userId: user.id,
          subCity: parsed.subCity,
          latitude: area?.latitude,
          longitude: area?.longitude,
        },
      });
    } else {
      // Technicians start PENDING until admin approval.
      await db.technicianProfile.create({
        data: {
          userId: user.id,
          displayName: parsed.name,
          status: "PENDING",
          availability: "OFFLINE",
        },
      });
    }

    await auditLog({
      actorId: user.id,
      actorRole: parsed.role as any,
      action: "user_registered",
      entityType: "user",
      entityId: user.id,
      metadata: { role: parsed.role },
    });

    return ok({ ok: true, userId: user.id, role: parsed.role });
  } catch (e) {
    return apiError(e);
  }
}
