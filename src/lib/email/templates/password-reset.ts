// Password reset email — security-critical template.
//
// IMPORTANT:
// - The resetUrl contains the raw token. It must NEVER be logged.
// - This template receives only the full reset URL (pre-constructed server-side).
// - The URL is constructed from APP_URL only — never from request headers.
// - The token is high-entropy (crypto.randomUUID) hashed before DB storage.

import type { PasswordResetTemplateData, RenderedEmail } from "@/lib/providers/email/types";
import { emailLayout, ctaButton, h1, p, securityNote, plainTextLayout } from "./base";

export function renderPasswordReset(data: PasswordResetTemplateData): RenderedEmail {
  // resetUrl is pre-validated by the service layer — contains the token.
  // We intentionally do NOT log or expose it; the URL itself is the credential.
  const html = emailLayout(`
    ${h1("Reset your FixIt password 🔐")}
    ${p("We received a request to reset your password. Click the button below to choose a new password.")}
    ${p("This link will expire in <strong>1 hour</strong> and can only be used once.")}
    ${ctaButton("Reset My Password", data.resetUrl)}
    ${securityNote(
      "If you did not request a password reset, you can safely ignore this email. " +
      "Your password will not be changed. " +
      "If you are concerned about your account security, contact support@fixit.app."
    )}
  `, "Reset your FixIt password — link valid for 1 hour");

  // Plain text version — includes the URL so non-HTML clients can use it.
  // In plain text, the URL is fully visible. Never redact it here; the
  // caller (console provider) redacts tokens from logs separately.
  const text = plainTextLayout([
    "You requested a password reset for your FixIt account.",
    "Click the link below to reset your password. This link expires in 1 hour and can only be used once.",
    `Reset link: ${data.resetUrl}`,
    "If you did not request this, ignore this email — your password will not change.",
    "Security concern? Contact support@fixit.app",
  ]);

  return {
    subject: "Reset your FixIt password",
    html,
    text,
  };
}
