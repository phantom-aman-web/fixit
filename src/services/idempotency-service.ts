// Idempotency service — prevents duplicate operations from retried requests.
// Uses the IdempotencyKey model to store request hashes + cached responses.

import { db } from "@/lib/db";
import { createHash } from "crypto";

const KEY_TTL_HOURS = 24;

export interface IdempotencyResult<T> {
  replayed: boolean;
  status: number;
  data: T | null;
}

// Check if a request with the given idempotency key has already been processed.
// If yes, return the cached response. If no, mark it as in-progress.
export async function checkIdempotency<T>(
  key: string,
  userId: string,
  operation: string,
  requestBody: unknown,
): Promise<IdempotencyResult<T>> {
  const requestHash = hashRequest(requestBody);
  const existing = await db.idempotencyKey.findUnique({ where: { key } });

  if (existing) {
    // Same key + same request hash → return cached response (idempotent replay).
    if (existing.requestHash === requestHash) {
      return {
        replayed: true,
        status: existing.responseStatus,
        data: existing.responseJson ? (JSON.parse(existing.responseJson) as T) : null,
      };
    }
    // Same key + different request → reject (conflict).
    throw new Error("Idempotency key was used with a different request body");
  }

  // No existing key — create one (mark as in-progress).
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + KEY_TTL_HOURS);

  await db.idempotencyKey.create({
    data: {
      key,
      userId,
      operation,
      requestHash,
      expiresAt,
    },
  });

  return { replayed: false, status: 200, data: null };
}

// Store the response for an idempotent operation.
export async function storeIdempotencyResponse(
  key: string,
  status: number,
  response: unknown,
): Promise<void> {
  await db.idempotencyKey.update({
    where: { key },
    data: {
      responseStatus: status,
      responseJson: JSON.stringify(response),
    },
  });
}

function hashRequest(body: unknown): string {
  const str = JSON.stringify(body ?? {});
  return createHash("sha256").update(str).digest("hex").slice(0, 32);
}

// Clean up expired idempotency keys (call periodically).
export async function cleanupExpiredKeys(): Promise<number> {
  const result = await db.idempotencyKey.deleteMany({
    where: { expiresAt: { lt: new Date() } },
  });
  return result.count;
}
