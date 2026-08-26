// General-purpose rate limiter for non-AI high-risk endpoints.
// Separate from the AI rate limiter (src/lib/ai/rate-limit.ts) but uses the
// same in-memory sliding-window pattern.

interface RateBucket {
  count: number;
  windowStart: number;
}

const buckets = new Map<string, RateBucket>();
const WINDOW_MS = 60_000;

// Limits per window (60s).
export const GENERAL_RATE_LIMITS = {
  login: 10,              // 10 login attempts per minute per IP
  register: 5,            // 5 registrations per minute per IP
  booking: 10,            // 10 bookings per minute per user
  payment_create: 10,     // 10 payment creations per minute per user
  dispute: 5,             // 5 disputes per minute per user
  disputeMessage: 20,     // 20 messages per minute per user
  upload: 20,             // 20 uploads per minute per user
  quote: 10,              // 10 quotes per minute per technician
  payment: 10,            // 10 payment operations per minute per user
  passwordReset: 3,       // 3 password reset requests per minute per IP
  emailVerification: 5,   // 5 verification resends per minute per IP
} as const;

function check(bucketKey: string, limit: number): { allowed: boolean; retryAfterMs: number } {
  const now = Date.now();
  const bucket = buckets.get(bucketKey);
  if (!bucket || now - bucket.windowStart > WINDOW_MS) {
    buckets.set(bucketKey, { count: 1, windowStart: now });
    return { allowed: true, retryAfterMs: 0 };
  }
  if (bucket.count >= limit) {
    return { allowed: false, retryAfterMs: WINDOW_MS - (now - bucket.windowStart) };
  }
  bucket.count++;
  return { allowed: true, retryAfterMs: 0 };
}

export function checkGeneralRateLimit(
  identifier: string, // userId or IP
  category: keyof typeof GENERAL_RATE_LIMITS,
): { allowed: boolean; retryAfterMs: number; limit: number } {
  const limit = GENERAL_RATE_LIMITS[category];
  const key = `${category}:${identifier}`;
  const result = check(key, limit);
  return { ...result, limit };
}

// Clean up expired buckets periodically.
setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of buckets) {
    if (now - bucket.windowStart > WINDOW_MS * 2) {
      buckets.delete(key);
    }
  }
}, 300_000);
