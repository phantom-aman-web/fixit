// Email provider abstraction — business logic never imports a provider directly.
// All types used by providers and the email service are defined here.

export interface EmailRecipient {
  name: string;
  email: string;
}

export interface EmailMessage {
  to: EmailRecipient[];
  cc?: EmailRecipient[];
  // BCC is never exposed to clients — only used internally for admin copies.
  bcc?: EmailRecipient[];
  replyTo?: string;
  subject: string;
  html: string;
  text: string;
  // Immutable, safe headers only — never allow user-controlled headers.
  headers?: Record<string, string>;
  // Safe metadata for provider tracking (no secrets).
  metadata?: Record<string, string>;
}

export interface EmailResult {
  success: boolean;
  messageId?: string;
  providerResponse?: string;
}

// ── Normalized error hierarchy ───────────────────────────────────────────────

export class EmailError extends Error {
  public readonly retryable: boolean;
  constructor(message: string, retryable = false) {
    super(message);
    this.name = "EmailError";
    this.retryable = retryable;
  }
}

/** Invalid email address, malformed template, missing required field. */
export class EmailValidationError extends EmailError {
  constructor(message: string) {
    super(message, false); // never retryable
    this.name = "EmailValidationError";
  }
}

/** Provider rejected the message permanently (invalid API key, domain not verified). */
export class EmailConfigurationError extends EmailError {
  constructor(message: string) {
    super(message, false); // never retryable
    this.name = "EmailConfigurationError";
  }
}

/** Transient provider error — network timeout, 5xx, provider outage. */
export class EmailProviderError extends EmailError {
  public readonly statusCode?: number;
  constructor(message: string, statusCode?: number) {
    // Retryable for 429 and 5xx; permanent for 4xx (except 429).
    const retryable = !statusCode || statusCode === 429 || statusCode >= 500;
    super(message, retryable);
    this.name = "EmailProviderError";
    this.statusCode = statusCode;
  }
}

/** Provider rate-limited this request. Always retryable. */
export class EmailRateLimitError extends EmailError {
  public readonly retryAfterMs?: number;
  constructor(retryAfterMs?: number) {
    super("Email provider rate limit exceeded", true);
    this.name = "EmailRateLimitError";
    this.retryAfterMs = retryAfterMs;
  }
}

// ── Provider interface ───────────────────────────────────────────────────────

export interface EmailProvider {
  send(message: EmailMessage): Promise<EmailResult>;
}

// ── Notification event vocabulary ────────────────────────────────────────────
// Only events that actually exist in the FixIt business architecture.

export type NotificationEvent =
  | "USER_WELCOME"
  | "REPAIR_REQUEST_CREATED"
  | "TECHNICIAN_ASSIGNED"
  | "JOB_ASSIGNED_TECH"
  | "QUOTE_RECEIVED"
  | "QUOTE_DECISION"
  | "JOB_STATUS_CHANGED"
  | "PAYMENT_SUCCEEDED"
  | "PAYMENT_FAILED"
  | "PAYMENT_REFUNDED"
  | "ACCOUNT_STATUS_CHANGED"
  | "PASSWORD_RESET";

// ── Typed template variable contracts ────────────────────────────────────────
// Using branded types prevents passing wrong variables to wrong templates.

export interface WelcomeTemplateData {
  customerName: string;
  dashboardUrl: string;
}

export interface RepairRequestCreatedTemplateData {
  customerName: string;
  equipmentName: string;  // NEVER hardcoded — always from DB
  problemSummary: string;
  jobId: string;
  dashboardUrl: string;
}

export interface TechnicianAssignedTemplateData {
  customerName: string;
  technicianName: string;
  equipmentName: string;
  scheduledAt: string;
  dashboardUrl: string;
}

export interface JobAssignedTechTemplateData {
  technicianName: string;
  customerFirstName: string;
  equipmentName: string;
  scheduledAt: string;
  jobUrl: string;
}

export interface QuoteReceivedTemplateData {
  customerName: string;
  equipmentName: string;
  totalEstimate: number;
  currency: string;
  quoteUrl: string;
}

export interface QuoteDecisionTemplateData {
  technicianName: string;
  equipmentName: string;
  decision: "APPROVED" | "REJECTED";
  jobUrl: string;
}

export interface JobStatusTemplateData {
  customerName: string;
  equipmentName: string;
  newStatus: string;
  statusLabel: string;
  dashboardUrl: string;
}

export interface PaymentReceiptTemplateData {
  customerName: string;
  equipmentName: string;
  amount: number;
  currency: string;
  paidAt: string;
  dashboardUrl: string;
}

export interface AccountStatusTemplateData {
  technicianName: string;
  newStatus: "ACTIVE" | "SUSPENDED";
  dashboardUrl: string;
}

export interface PasswordResetTemplateData {
  // resetUrl contains the token — it is NEVER logged.
  resetUrl: string;
}

// ── Rendered email output ────────────────────────────────────────────────────

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

// ── Email send request ────────────────────────────────────────────────────────

export interface EmailSendRequest {
  recipient: EmailRecipient;
  event: NotificationEvent;
  // Deterministic deduplication key — e.g. "repair-request:abc123:created"
  // Critical for Phase 8.6 outbox reliability.
  deduplicationKey: string;
  correlationId?: string;
  // Pre-rendered email — produced by the template system.
  rendered: RenderedEmail;
}

export interface EmailSendResult {
  success: boolean;
  deduplicationKey: string;
  correlationId: string;
  messageId?: string;
  error?: {
    type: string;
    message: string;
    retryable: boolean;
  };
}
