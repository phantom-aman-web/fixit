import { db } from "@/lib/db";
import { getEnvConfig, validateProductionReadiness } from "@/lib/env";
import { NextResponse } from "next/server";

// GET /api/health — overall health check.
// Returns: status, database connectivity, version, environment, readiness checks.
export async function GET() {
  const config = getEnvConfig();
  const checks = validateProductionReadiness();

  let dbStatus: "ok" | "error" = "error";
  try {
    await db.$queryRaw`SELECT 1`;
    dbStatus = "ok";
  } catch {
    dbStatus = "error";
  }

  const allPassed = checks.filter((c) => c.severity === "critical").every((c) => c.passed);
  const httpStatus = dbStatus === "ok" && allPassed ? 200 : 503;

  return NextResponse.json({
    status: dbStatus === "ok" && allPassed ? "ok" : "degraded",
    database: dbStatus,
    version: process.env.npm_package_version || "unknown",
    environment: config.nodeEnv,
    timestamp: new Date().toISOString(),
    checks: checks.map((c) => ({
      name: c.name,
      passed: c.passed,
      severity: c.severity,
      message: c.message,
    })),
  }, { status: httpStatus });
}
