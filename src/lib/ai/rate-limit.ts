// Simple in-memory rate limiter for AI endpoints.
// Uses a sliding window per user + per session. No external infrastructure
// needed — compatible with the SQLite/single-process environment.
// If the process restarts, limits reset (acceptable for Phase 2).

interface RateBucket {
  count: number;
  windowStart: number;
}

const buckets = new Map<string, RateBucket>();

// Limits per window (60s).
export const AI_RATE_LIMITS = {
  perUser: 20,        // 20 AI requests per minute per user
  perSession: 15,     // 15 AI requests per minute per session
  imagePerUser: 5,    // 5 image analyses per minute per user
  conversePerSession: 10, // 10 conversational turns per minute per session
} as const;

const WINDOW_MS = 60_000;

function check(bucketKey: string, limit: number): { allowed: boolean; retryAfterMs: number } {
  const now = Date.now();
  const bucket = buckets.get(bucketKey);
  if (!bucket || now - bucket.windowStart > WINDOW_MS) {
    buckets.set(bucketKey, { count: 1, windowStart: now });
    return { allowed: true, retryAfterMs: 0 };
  }
  if (bucket.count >= limit) {
    const retryAfterMs = WINDOW_MS - (now - bucket.windowStart);
    return { allowed: false, retryAfterMs };
  }
  bucket.count++;
  return { allowed: true, retryAfterMs: 0 };
}

export function checkRateLimit(
  userId: string,
  requestType: string,
  sessionId?: string,
): { allowed: boolean; retryAfterMs: number; limit: number } {
  // Per-user limit.
  const userKey = `user:${userId}:${requestType}`;
  const userLimit = requestType === "analyze_image" ? AI_RATE_LIMITS.imagePerUser : AI_RATE_LIMITS.perUser;
  const userCheck = check(userKey, userLimit);
  if (!userCheck.allowed) {
    return { allowed: false, retryAfterMs: userCheck.retryAfterMs, limit: userLimit };
  }

  // Per-session limit (if session provided).
  if (sessionId) {
    const sessionLimit = requestType === "converse" ? AI_RATE_LIMITS.conversePerSession : AI_RATE_LIMITS.perSession;
    const sessionKey = `session:${sessionId}:${requestType}`;
    const sessionCheck = check(sessionKey, sessionLimit);
    if (!sessionCheck.allowed) {
      return { allowed: false, retryAfterMs: sessionCheck.retryAfterMs, limit: sessionLimit };
    }
  }

  return { allowed: true, retryAfterMs: 0, limit: userLimit };
}

// Clean up expired buckets periodically (every 5 minutes).
setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of buckets) {
    if (now - bucket.windowStart > WINDOW_MS * 2) {
      buckets.delete(key);
    }
  }
}, 300_000);
