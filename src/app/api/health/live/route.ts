import { NextResponse } from "next/server";

// GET /api/health/live — liveness probe.
// Returns 200 if the application process is running.
export async function GET() {
  return NextResponse.json({ status: "ok", timestamp: new Date().toISOString() });
}
