// POST /api/auth/forgot-password
//
// Security guarantees:
// - Generic response regardless of whether the email exists (no account enumeration)
// - Rate-limited by IP (3 per minute)
// - Token: high-entropy crypto.randomUUID(), only hashed value stored in DB
// - Token expiry: 1 hour
// - Previous tokens for same user are invalidated before new one is issued
// - Reset URL constructed from APP_URL only — never from request Host/Origin/Referer
// - Raw token NEVER logged

import { NextRequest } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { randomUUID } from "crypto";
import { ok, apiError } from "@/lib/api";
import { db } from "@/lib/db";
import { checkGeneralRateLimit } from "@/lib/rate-limit";
import { getEnvConfig } from "@/lib/env";
import { emailPasswordReset } from "@/services/email-service";
import { logInfo } from "@/lib/logger";

const schema = z.object({
  email: z.string().email().max(254).transform((e) => e.trim().toLowerCase()),
});

const TOKEN_EXPIRY_MS = 60 * 60 * 1000; // 1 hour

export async function POST(req: NextRequest) {
  // Rate limit by IP — not by email (to avoid timing attacks).
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    ?? req.headers.get("x-real-ip")
    ?? "unknown";

  const rl = checkGeneralRateLimit(ip, "passwordReset");
  if (!rl.allowed) {
    // Return 200 even for rate-limited requests — no enumeration or timing hints.
    return ok({
      message: "If an account exists for this email, we've sent password reset instructions.",
    });
  }

  let email: string;
  try {
    const body = await req.json();
    email = schema.parse(body).email;
  } catch {
    return ok({
      message: "If an account exists for this email, we've sent password reset instructions.",
    });
  }

  try {
    // Look up user — but do NOT reveal whether account exists.
    const user = await db.user.findUnique({ where: { email } });

    if (user) {
      // Invalidate any existing reset tokens for this user.
      // VerificationToken identifier = userId for password resets.
      await db.verificationToken.deleteMany({
        where: { identifier: `password-reset:${user.id}` },
      });

      // Generate a high-entropy random token.
      const rawToken = randomUUID(); // 128 bits of entropy — cryptographically secure

      // Store ONLY the hash — raw token is never persisted.
      const tokenHash = await bcrypt.hash(rawToken, 10);
      const expiresAt = new Date(Date.now() + TOKEN_EXPIRY_MS);

      await db.verificationToken.create({
        data: {
          identifier: `password-reset:${user.id}`,
          token: tokenHash,
          expires: expiresAt,
        },
      });

      // Construct reset URL from APP_URL only — never from request headers.
      const env = getEnvConfig();
      const baseUrl = env.appUrl.replace(/\/$/, "");
      // rawToken is the credential — include it in the URL, but NEVER log it.
      const resetUrl = `${baseUrl}/#/auth/reset-password?token=${rawToken}&uid=${user.id}`;

      // Send email — fire and forget. Email failure MUST NOT fail the request.
      void emailPasswordReset({
        userId: user.id,
        email: user.email,
        resetUrl, // token embedded in URL — console provider redacts from logs
      });

      // Log the event (no token, no email address in structured log).
      logInfo("PASSWORD_RESET_REQUESTED", { userId: user.id });
    }

    // Always return the same generic response.
    return ok({
      message: "If an account exists for this email, we've sent password reset instructions.",
    });
  } catch (e) {
    return apiError(e);
  }
}
