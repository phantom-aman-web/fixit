// Resend email provider — production mode.
// Uses the Resend HTTP API directly (no SDK dependency required,
// but the resend npm package can be added if preferred).
//
// NEVER import this file from business logic — use the provider factory.
// NEVER expose RESEND_API_KEY outside server-side code.
//
// To enable: EMAIL_PROVIDER=resend + RESEND_API_KEY=re_...

import type {
  EmailProvider,
  EmailMessage,
  EmailResult,
} from "./types";
import {
  EmailConfigurationError,
  EmailProviderError,
  EmailRateLimitError,
  EmailValidationError,
} from "./types";

const RESEND_API_URL = "https://api.resend.com/emails";

export class ResendEmailProvider implements EmailProvider {
  private readonly apiKey: string;
  private readonly fromAddress: string;

  constructor(apiKey: string, fromAddress: string) {
    if (!apiKey || !apiKey.startsWith("re_")) {
      throw new EmailConfigurationError(
        "Invalid Resend API key — must start with 're_'. Check RESEND_API_KEY."
      );
    }
    this.apiKey = apiKey;
    this.fromAddress = fromAddress;
  }

  async send(message: EmailMessage): Promise<EmailResult> {
    const body = {
      from: this.fromAddress,
      to: message.to.map((r) => (r.name ? `${r.name} <${r.email}>` : r.email)),
      cc: message.cc?.map((r) => (r.name ? `${r.name} <${r.email}>` : r.email)),
      reply_to: message.replyTo,
      subject: message.subject,
      html: message.html,
      text: message.text,
      // Only forward safe, non-sensitive headers.
      headers: message.headers,
      // Tags for Resend analytics — no sensitive values.
      tags: message.metadata
        ? Object.entries(message.metadata)
            .filter(([k, v]) => k.length <= 36 && v.length <= 256)
            .slice(0, 10)
            .map(([name, value]) => ({ name, value }))
        : undefined,
    };

    let response: Response;
    try {
      response = await fetch(RESEND_API_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });
    } catch (err: unknown) {
      // Network error — always retryable.
      throw new EmailProviderError(
        `Network error contacting Resend: ${err instanceof Error ? err.message : "unknown"}`
      );
    }

    const status = response.status;

    if (status === 429) {
      const retryAfter = response.headers.get("Retry-After");
      const retryMs = retryAfter ? parseInt(retryAfter) * 1000 : undefined;
      throw new EmailRateLimitError(retryMs);
    }

    let responseBody: Record<string, unknown>;
    try {
      responseBody = await response.json() as Record<string, unknown>;
    } catch {
      throw new EmailProviderError("Failed to parse Resend response", status);
    }

    if (status === 422 || status === 400) {
      // Validation error — permanent failure.
      throw new EmailValidationError(
        `Resend rejected message: ${(responseBody as any)?.message ?? "unknown validation error"}`
      );
    }

    if (status === 401 || status === 403) {
      // Auth error — permanent failure.
      throw new EmailConfigurationError(
        "Resend authentication failed — check RESEND_API_KEY and sender domain"
      );
    }

    if (!response.ok) {
      throw new EmailProviderError(
        `Resend API error ${status}: ${(responseBody as any)?.message ?? "unknown"}`,
        status
      );
    }

    const messageId = (responseBody as any)?.id as string | undefined;
    return { success: true, messageId, providerResponse: JSON.stringify(responseBody) };
  }
}
