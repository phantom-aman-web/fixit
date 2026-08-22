// Audit log service — records important workflow + administrative actions.

import { db } from "@/lib/db";

export async function auditLog(params: {
  actorId?: string;
  actorRole?: "CUSTOMER" | "TECHNICIAN" | "ADMIN" | "SYSTEM";
  action: string;
  entityType: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
}) {
  try {
    return await db.auditLog.create({
      data: {
        actorId: params.actorId,
        actorRole: params.actorRole,
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId,
        metadataJson: params.metadata ? JSON.stringify(params.metadata) : null,
      },
    });
  } catch {
    // Audit logging is best-effort; never fail the business operation.
  }
}

// Get audit logs, filtered by entity or actor.
export async function getAuditLogs(params: {
  entityType?: string;
  entityId?: string;
  actorId?: string;
  action?: string;
  take?: number;
}) {
  return db.auditLog.findMany({
    where: {
      ...(params.entityType ? { entityType: params.entityType } : {}),
      ...(params.entityId ? { entityId: params.entityId } : {}),
      ...(params.actorId ? { actorId: params.actorId } : {}),
      ...(params.action ? { action: params.action } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: params.take ?? 50,
  });
}
