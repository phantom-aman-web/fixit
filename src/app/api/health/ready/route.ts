import { db } from "@/lib/db";
import { NextResponse } from "next/server";

// GET /api/health/ready — readiness probe.
// Returns 200 if the application is ready to serve requests (database available).
export async function GET() {
  try {
    await db.$queryRaw`SELECT 1`;
    return NextResponse.json({ status: "ok", database: "ok" });
  } catch (e) {
    return NextResponse.json(
      { status: "error", database: "unavailable" },
      { status: 503 },
    );
  }
}
