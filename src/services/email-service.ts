// Central Email Service — the ONLY entry point for sending email.
//
// Architecture:
//   Business Code → emailService.send() → EmailProvider → delivery
//
// Guarantees:
//   - Recipients resolved server-side, never from client input
//   - HTML escaping enforced at template level
//   - Secrets never logged
//   - Email failure NEVER throws — returns failure result
//   - Business transactions are never rolled back due to email failure
//   - Every send carries deduplicationKey + correlationId (Phase 8.6 ready)
//   - Errors normalized to typed error classes (retryable vs permanent)

import { randomUUID } from "crypto";
import { getEmailProvider } from "@/lib/providers/email";
import {
  EmailError,
  EmailValidationError,
  type EmailSendRequest,
  type EmailSendResult,
} from "@/lib/providers/email/types";
import { logInfo, logError, logWarn } from "@/lib/logger";

// Basic RFC-5322 email validation — server-side only.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateEmail(email: string): boolean {
  return EMAIL_RE.test(email) && email.length <= 254;
}

/**
 * Sends an email message via the configured provider.
 *
 * NEVER throws — returns a result object with error info if sending fails.
 * Business logic should fire-and-forget post-transaction:
 *
 *   // After DB transaction commits:
 *   void emailService.send({ ... });
 *   // or check the result if needed:
 *   const result = await emailService.send({ ... });
 *   if (!result.success) { logWarn(...) }
 */
export async function sendEmail(request: EmailSendRequest): Promise<EmailSendResult> {
  const correlationId = request.correlationId ?? randomUUID();
  const { recipient, event, deduplicationKey, rendered } = request;

  const logMeta = {
    event,
    deduplicationKey,
    correlationId,
    recipientRole: recipient.email.endsWith("@example.com") ? "test" : "user",
    // NEVER log the actual email address in structured logs (PII).
    // Log a safe hash if needed for debugging.
  };

  // 1. Validate recipient email address.
  if (!validateEmail(recipient.email)) {
    logWarn("EMAIL_VALIDATION_FAILED", {
      ...logMeta,
      reason: "Invalid email format",
    });
    return {
      success: false,
      deduplicationKey,
      correlationId,
      error: {
        type: "EmailValidationError",
        message: "Invalid recipient email address",
        retryable: false,
      },
    };
  }

  logInfo("EMAIL_SEND_STARTED", logMeta);

  try {
    const provider = getEmailProvider();

    const result = await provider.send({
      to: [recipient],
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
      // Idempotency and tracking metadata — no sensitive values.
      metadata: {
        event,
        deduplicationKey,
        correlationId,
      },
    });

    logInfo("EMAIL_SEND_SUCCESS", {
      ...logMeta,
      messageId: result.messageId ?? "unknown",
    });

    return {
      success: true,
      deduplicationKey,
      correlationId,
      messageId: result.messageId,
    };
  } catch (err: unknown) {
    const isEmailError = err instanceof EmailError;
    const retryable = isEmailError ? err.retryable : true; // unknown errors → retry
    const type = err instanceof Error ? err.constructor.name : "UnknownError";
    const message = err instanceof Error ? err.message : "Unknown error";

    // NEVER log secrets, tokens, API keys, or sensitive PII.
    if (err instanceof EmailValidationError) {
      logWarn("EMAIL_SEND_FAILED", { ...logMeta, type, message, retryable });
    } else {
      logError("EMAIL_SEND_FAILED", err, { ...logMeta, type, retryable });
    }

    return {
      success: false,
      deduplicationKey,
      correlationId,
      error: { type, message, retryable },
    };
  }
}

// ── Convenience wrappers for each notification event ─────────────────────────
// These are the ONLY functions imported by services/notifications.ts.
// They do NOT throw. They return results that callers can optionally inspect.

import { getEnvConfig } from "@/lib/env";
import { renderWelcome } from "@/lib/email/templates/welcome";
import { renderJobCreated } from "@/lib/email/templates/job-created";
import { renderTechnicianAssigned } from "@/lib/email/templates/technician-assigned";
import { renderJobAssignedTech } from "@/lib/email/templates/job-assigned-tech";
import { renderQuoteReceived } from "@/lib/email/templates/quote-received";
import { renderQuoteDecision } from "@/lib/email/templates/quote-decision";
import { renderJobStatus } from "@/lib/email/templates/job-status";
import { renderPaymentReceipt } from "@/lib/email/templates/payment-receipt";
import { renderAccountStatus } from "@/lib/email/templates/account-status";
import { renderPasswordReset } from "@/lib/email/templates/password-reset";

/** Returns APP_URL — never constructed from request headers. */
function appUrl(): string {
  return getEnvConfig().appUrl.replace(/\/$/, "");
}

export async function emailWelcome(params: {
  userId: string;
  name: string;
  email: string;
}) {
  return sendEmail({
    recipient: { name: params.name, email: params.email },
    event: "USER_WELCOME",
    deduplicationKey: `user:${params.userId}:welcome`,
    rendered: renderWelcome({
      customerName: params.name,
      dashboardUrl: `${appUrl()}/#/dashboard`,
    }),
  });
}

export async function emailRepairRequestCreated(params: {
  userId: string;
  name: string;
  email: string;
  requestId: string;
  equipmentName: string;
  problemSummary: string;
}) {
  return sendEmail({
    recipient: { name: params.name, email: params.email },
    event: "REPAIR_REQUEST_CREATED",
    deduplicationKey: `repair-request:${params.requestId}:created`,
    rendered: renderJobCreated({
      customerName: params.name,
      equipmentName: params.equipmentName,
      problemSummary: params.problemSummary,
      jobId: params.requestId,
      dashboardUrl: `${appUrl()}/#/dashboard`,
    }),
  });
}

export async function emailTechnicianAssigned(params: {
  customerUserId: string;
  customerName: string;
  customerEmail: string;
  technicianName: string;
  equipmentName: string;
  scheduledAt: Date;
  requestId: string;
}) {
  return sendEmail({
    recipient: { name: params.customerName, email: params.customerEmail },
    event: "TECHNICIAN_ASSIGNED",
    deduplicationKey: `repair-request:${params.requestId}:technician-assigned`,
    rendered: renderTechnicianAssigned({
      customerName: params.customerName,
      technicianName: params.technicianName,
      equipmentName: params.equipmentName,
      scheduledAt: params.scheduledAt.toLocaleString("en-US", { dateStyle: "full", timeStyle: "short" }),
      dashboardUrl: `${appUrl()}/#/dashboard`,
    }),
  });
}

export async function emailJobAssignedTech(params: {
  techUserId: string;
  techName: string;
  techEmail: string;
  customerFirstName: string;
  equipmentName: string;
  scheduledAt: Date;
  requestId: string;
}) {
  return sendEmail({
    recipient: { name: params.techName, email: params.techEmail },
    event: "JOB_ASSIGNED_TECH",
    deduplicationKey: `repair-request:${params.requestId}:job-assigned-tech`,
    rendered: renderJobAssignedTech({
      technicianName: params.techName,
      customerFirstName: params.customerFirstName,
      equipmentName: params.equipmentName,
      scheduledAt: params.scheduledAt.toLocaleString("en-US", { dateStyle: "full", timeStyle: "short" }),
      jobUrl: `${appUrl()}/#/technician/jobs`,
    }),
  });
}

export async function emailQuoteReceived(params: {
  customerUserId: string;
  customerName: string;
  customerEmail: string;
  quoteId: string;
  equipmentName: string;
  totalEstimate: number;
  currency: string;
}) {
  return sendEmail({
    recipient: { name: params.customerName, email: params.customerEmail },
    event: "QUOTE_RECEIVED",
    deduplicationKey: `quote:${params.quoteId}:received`,
    rendered: renderQuoteReceived({
      customerName: params.customerName,
      equipmentName: params.equipmentName,
      totalEstimate: params.totalEstimate,
      currency: params.currency,
      quoteUrl: `${appUrl()}/#/dashboard`,
    }),
  });
}

export async function emailQuoteDecision(params: {
  techUserId: string;
  techName: string;
  techEmail: string;
  quoteId: string;
  equipmentName: string;
  decision: "APPROVED" | "REJECTED";
}) {
  return sendEmail({
    recipient: { name: params.techName, email: params.techEmail },
    event: "QUOTE_DECISION",
    deduplicationKey: `quote:${params.quoteId}:decision-${params.decision.toLowerCase()}`,
    rendered: renderQuoteDecision({
      technicianName: params.techName,
      equipmentName: params.equipmentName,
      decision: params.decision,
      jobUrl: `${appUrl()}/#/technician/jobs`,
    }),
  });
}

export async function emailJobStatus(params: {
  customerUserId: string;
  customerName: string;
  customerEmail: string;
  jobId: string;
  equipmentName: string;
  newStatus: string;
  statusLabel: string;
}) {
  return sendEmail({
    recipient: { name: params.customerName, email: params.customerEmail },
    event: "JOB_STATUS_CHANGED",
    deduplicationKey: `repair-job:${params.jobId}:status-${params.newStatus}`,
    rendered: renderJobStatus({
      customerName: params.customerName,
      equipmentName: params.equipmentName,
      newStatus: params.newStatus,
      statusLabel: params.statusLabel,
      dashboardUrl: `${appUrl()}/#/dashboard`,
    }),
  });
}

export async function emailPaymentReceipt(params: {
  customerUserId: string;
  customerName: string;
  customerEmail: string;
  jobId: string;
  equipmentName: string;
  amount: number;
  currency: string;
  paidAt: Date;
}) {
  return sendEmail({
    recipient: { name: params.customerName, email: params.customerEmail },
    event: "PAYMENT_SUCCEEDED",
    deduplicationKey: `repair-job:${params.jobId}:payment-succeeded`,
    rendered: renderPaymentReceipt({
      customerName: params.customerName,
      equipmentName: params.equipmentName,
      amount: params.amount,
      currency: params.currency,
      paidAt: params.paidAt.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" }),
      dashboardUrl: `${appUrl()}/#/dashboard`,
    }),
  });
}

export async function emailAccountStatus(params: {
  techUserId: string;
  techName: string;
  techEmail: string;
  newStatus: "ACTIVE" | "SUSPENDED";
}) {
  return sendEmail({
    recipient: { name: params.techName, email: params.techEmail },
    event: "ACCOUNT_STATUS_CHANGED",
    deduplicationKey: `technician:${params.techUserId}:account-status-${params.newStatus.toLowerCase()}`,
    rendered: renderAccountStatus({
      technicianName: params.techName,
      newStatus: params.newStatus,
      dashboardUrl: `${appUrl()}/#/technician/dashboard`,
    }),
  });
}

/**
 * Sends a password reset email.
 * The caller is responsible for:
 * - Generating a cryptographically random token
 * - Storing only the hash in the DB
 * - Constructing resetUrl from APP_URL only
 * - Never logging the raw token
 */
export async function emailPasswordReset(params: {
  userId: string;
  email: string;
  resetUrl: string; // Already constructed from APP_URL — never from request headers
}) {
  return sendEmail({
    recipient: { name: "", email: params.email },
    event: "PASSWORD_RESET",
    // Token is NOT in deduplicationKey — only the userId, so we can track
    // that a reset was sent without revealing the token.
    deduplicationKey: `user:${params.userId}:password-reset-${Math.floor(Date.now() / 3600000)}`,
    rendered: renderPasswordReset({
      resetUrl: params.resetUrl,
    }),
  });
}
