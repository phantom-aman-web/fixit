// Structured logging for production observability.
// In development: human-readable console output.
// In production: structured JSON with request correlation IDs.
// NEVER logs: passwords, tokens, payment credentials, full AI prompts, PII.

import { getEnvConfig } from "@/lib/env";

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  requestId?: string;
  userId?: string;
  route?: string;
  operation?: string;
  duration?: number;
  status?: string;
  errorCategory?: string;
  [key: string]: unknown;
}

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

// Sensitive keys that must never appear in logs.
const SENSITIVE_KEYS = [
  "password", "passwordHash", "token", "secret", "apiKey", "api_key",
  "authorization", "cookie", "session", "credential", "privateKey",
  "stripeKey", "paymentKey", "webhookSecret", "refresh_token", "access_token",
];

function sanitize(data: Record<string, unknown>): Record<string, unknown> {
  const cleaned: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (SENSITIVE_KEYS.some((s) => key.toLowerCase().includes(s.toLowerCase()))) {
      cleaned[key] = "[REDACTED]";
    } else if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      cleaned[key] = sanitize(value as Record<string, unknown>);
    } else {
      cleaned[key] = value;
    }
  }
  return cleaned;
}

export function log(entry: Partial<LogEntry> & { message: string; level?: LogLevel }) {
  const config = getEnvConfig();
  const level = entry.level ?? "info";
  const minLevel = config.logLevel as LogLevel;

  if (LEVEL_PRIORITY[level] < LEVEL_PRIORITY[minLevel]) return;

  const fullEntry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    message: entry.message,
    requestId: entry.requestId,
    userId: entry.userId,
    route: entry.route,
    operation: entry.operation,
    duration: entry.duration,
    status: entry.status,
    errorCategory: entry.errorCategory,
    ...sanitize(entry),
  };

  // Remove undefined values.
  Object.keys(fullEntry).forEach((k) => fullEntry[k] === undefined && delete fullEntry[k]);

  if (config.isProduction) {
    // Production: structured JSON.
    const json = JSON.stringify(fullEntry);
    if (level === "error") console.error(json);
    else if (level === "warn") console.warn(json);
    else console.log(json);
  } else {
    // Development: human-readable.
    const prefix = `[${level.toUpperCase()}]`;
    const parts = [prefix, fullEntry.message];
    if (fullEntry.requestId) parts.push(`req=${fullEntry.requestId.slice(0, 8)}`);
    if (fullEntry.userId) parts.push(`user=${fullEntry.userId.slice(0, 8)}`);
    if (fullEntry.duration != null) parts.push(`${fullEntry.duration}ms`);
    if (fullEntry.operation) parts.push(`op=${fullEntry.operation}`);
    console.log(parts.join(" "));
  }
}

export function logError(message: string, error: unknown, context?: Record<string, unknown>) {
  const err = error instanceof Error ? error : new Error(String(error));
  log({
    level: "error",
    message,
    error: err.message,
    stack: err.stack,
    ...context,
  });
}

export function logInfo(message: string, context?: Record<string, unknown>) {
  log({ level: "info", message, ...context });
}

export function logWarn(message: string, context?: Record<string, unknown>) {
  log({ level: "warn", message, ...context });
}
