import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Security headers middleware.
// Applied to all routes to set production security headers.
export function middleware(req: NextRequest) {
  const res = NextResponse.next();

  // Security headers.
  res.headers.set("X-Content-Type-Options", "nosniff");
  res.headers.set("X-Frame-Options", "DENY");
  res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  res.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=(self)");

  // Content-Security-Policy — restrictive but allows inline styles (Tailwind)
  // and scripts from same origin. In production, tighten further with nonces.
  if (process.env.NODE_ENV === "production") {
    res.headers.set(
      "Content-Security-Policy",
      "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; font-src 'self' data:; connect-src 'self' ws: wss:; frame-ancestors 'none';",
    );
  }

  // Generate a request correlation ID for observability.
  const requestId = req.headers.get("x-request-id") || crypto.randomUUID();
  res.headers.set("X-Request-ID", requestId);

  return res;
}

export const config = {
  // Apply to all routes except static assets.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|logo.svg|robots.txt).*)"],
};
