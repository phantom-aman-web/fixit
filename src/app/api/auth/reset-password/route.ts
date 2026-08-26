// POST /api/auth/reset-password
//
// Security guarantees:
// - Validates token against stored bcrypt hash (timing-safe via bcrypt.compare)
// - Enforces 1-hour expiry
// - Single-use: deletes VerificationToken on success
// - Does not reveal whether token is expired vs invalid (same error)
// - Updates passwordHash in DB using bcrypt
// - Does not auto-sign-in after reset (separate login step required)
// - Never logs the raw token

import { NextRequest } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { ok, apiError, HttpError } from "@/lib/api";
import { db } from "@/lib/db";
import { checkGeneralRateLimit } from "@/lib/rate-limit";
import { logInfo } from "@/lib/logger";

const schema = z.object({
  token: z.string().min(1).max(256),
  uid: z.string().min(1).max(64),
  newPassword: z.string().min(8).max(100),
});

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    ?? req.headers.get("x-real-ip")
    ?? "unknown";

  // Rate limit password reset completions too.
  const rl = checkGeneralRateLimit(ip, "passwordReset");
  if (!rl.allowed) {
    return ok({ error: "Too many attempts. Please wait before trying again." }, 429);
  }

  let parsed: z.infer<typeof schema>;
  try {
    const body = await req.json();
    parsed = schema.parse(body);
  } catch {
    return ok({ error: "Invalid request." }, 400);
  }

  try {
    const { token: rawToken, uid, newPassword } = parsed;

    // Look up the stored token hash.
    const stored = await db.verificationToken.findFirst({
      where: { identifier: `password-reset:${uid}` },
    });

    // Use a constant-time-equivalent error — do NOT distinguish between:
    // "token not found", "token expired", "token mismatch"
    // This prevents timing attacks and token oracle attacks.
    const INVALID_MSG = "This password reset link is invalid or has expired. Please request a new one.";

    if (!stored) {
      throw new HttpError(400, INVALID_MSG);
    }

    // Check expiry.
    if (stored.expires < new Date()) {
      // Clean up expired token.
      await db.verificationToken.delete({
        where: { identifier_token: { identifier: stored.identifier, token: stored.token } },
      }).catch(() => {});
      throw new HttpError(400, INVALID_MSG);
    }

    // bcrypt.compare is timing-safe.
    const valid = await bcrypt.compare(rawToken, stored.token);
    if (!valid) {
      throw new HttpError(400, INVALID_MSG);
    }

    // Verify the user exists.
    const user = await db.user.findUnique({ where: { id: uid } });
    if (!user) {
      throw new HttpError(400, INVALID_MSG);
    }

    // Hash the new password.
    const newHash = await bcrypt.hash(newPassword, 12);

    // Atomically: update password + delete (consume) the token.
    await db.$transaction([
      db.user.update({
        where: { id: uid },
        data: { passwordHash: newHash, updatedAt: new Date() },
      }),
      db.verificationToken.delete({
        where: { identifier_token: { identifier: stored.identifier, token: stored.token } },
      }),
    ]);

    logInfo("PASSWORD_RESET_COMPLETED", { userId: uid });

    return ok({ message: "Password reset successfully. You can now sign in with your new password." });
  } catch (e) {
    return apiError(e);
  }
}
