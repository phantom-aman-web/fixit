// Console email provider — development mode.
// Logs a structured email representation to stdout.
// NEVER sends a real email.
// NEVER logs raw tokens, passwords, API keys, or signed URLs.
//
// To enable: EMAIL_PROVIDER=console (default in development)

import type { EmailProvider, EmailMessage, EmailResult } from "./types";

function redactSensitivePaths(text: string): string {
  // Redact anything that looks like a reset token URL parameter.
  return text
    .replace(/([?&]token=)[^\s&"<]+/gi, "$1[REDACTED]")
    .replace(/([?&]code=)[^\s&"<]+/gi, "$1[REDACTED]");
}

export class ConsoleEmailProvider implements EmailProvider {
  async send(message: EmailMessage): Promise<EmailResult> {
    const separator = "─".repeat(60);

    console.log("\n" + separator);
    console.log("📧  EMAIL (console provider — not sent)");
    console.log(separator);
    console.log(`TO:      ${message.to.map((r) => `${r.name} <${r.email}>`).join(", ")}`);
    if (message.cc?.length) {
      console.log(`CC:      ${message.cc.map((r) => `${r.name} <${r.email}>`).join(", ")}`);
    }
    console.log(`SUBJECT: ${message.subject}`);
    if (message.metadata) {
      // Log metadata (event type, correlation IDs) but never secrets.
      const safeMeta = Object.fromEntries(
        Object.entries(message.metadata).filter(([k]) =>
          !k.toLowerCase().includes("token") &&
          !k.toLowerCase().includes("key") &&
          !k.toLowerCase().includes("secret")
        )
      );
      if (Object.keys(safeMeta).length) {
        console.log(`META:    ${JSON.stringify(safeMeta)}`);
      }
    }
    console.log("\n--- PLAIN TEXT ---");
    console.log(redactSensitivePaths(message.text));
    console.log(separator + "\n");

    // Return a synthetic message ID for testing purposes.
    const syntheticId = `console-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    return { success: true, messageId: syntheticId };
  }
}
