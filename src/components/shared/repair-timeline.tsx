"use client";

import { CheckCircle2, Circle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDateTime } from "@/lib/format";

export interface TimelineStep {
  label: string;
  status: "completed" | "current" | "pending";
  timestamp?: string | Date;
  description?: string;
}

// Visual repair timeline showing the complete journey from booking to completion.
// Uses real RepairJob state to determine which steps are completed/current/pending.
export function RepairTimeline({ steps, className }: { steps: TimelineStep[]; className?: string }) {
  return (
    <ol className={cn("space-y-1", className)}>
      {steps.map((step, i) => (
        <li key={i} className="flex gap-3">
          {/* Vertical line + icon */}
          <div className="flex flex-col items-center">
            {step.status === "completed" ? (
              <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" aria-label="Completed" />
            ) : step.status === "current" ? (
              <Loader2 className="h-5 w-5 shrink-0 animate-spin text-primary" aria-label="In progress" />
            ) : (
              <Circle className="h-5 w-5 shrink-0 text-muted-foreground/40" aria-label="Pending" />
            )}
            {i < steps.length - 1 && (
              <div
                className={cn(
                  "w-px flex-1 min-h-[24px]",
                  step.status === "completed" ? "bg-emerald-300 dark:bg-emerald-800" : "bg-border"
                )}
              />
            )}
          </div>
          {/* Content */}
          <div className={cn("pb-4", step.status === "pending" && "opacity-50")}>
            <p className={cn(
              "text-sm font-medium",
              step.status === "current" && "text-primary",
              step.status === "completed" && "text-foreground",
              step.status === "pending" && "text-muted-foreground"
            )}>
              {step.label}
            </p>
            {step.timestamp && (
              <p className="text-xs text-muted-foreground">
                {formatDateTime(step.timestamp)}
              </p>
            )}
            {step.description && (
              <p className="mt-0.5 text-xs text-muted-foreground">{step.description}</p>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}

// Build timeline steps from a repair job's status history.
export function buildTimelineFromJob(job: {
  status: string;
  startedAt?: string | Date | null;
  completedAt?: string | Date | null;
  createdAt: string | Date;
  statusHistory?: { status: string; createdAt: string | Date; note?: string | null }[];
  booking: {
    status: string;
    scheduledAt: string | Date;
    createdAt: string | Date;
    quote?: { status: string; createdAt: string | Date } | null;
    payment?: { status: string; paidAt?: string | Date | null } | null;
    repairJob?: { status: string } | null;
  };
}): TimelineStep[] {
  const statuses = job.statusHistory?.map((h) => h.status) ?? [];
  const historyMap = new Map(job.statusHistory?.map((h) => [h.status, h.createdAt]));

  const stepDefs: { key: string; label: string }[] = [
    { key: "BOOKED", label: "Booking created" },
    { key: "ACCEPTED", label: "Technician accepted" },
    { key: "SCHEDULED", label: "Appointment scheduled" },
    { key: "CONFIRMED", label: "Appointment confirmed" },
    { key: "EN_ROUTE", label: "Technician en route" },
    { key: "ARRIVED", label: "Technician arrived" },
    { key: "INSPECTING", label: "Inspection in progress" },
    { key: "DIAGNOSING", label: "Diagnosing" },
    { key: "QUOTE_SUBMITTED", label: "Quote submitted" },
    { key: "AWAITING_APPROVAL", label: "Awaiting your approval" },
    { key: "REPAIRING", label: "Repair in progress" },
    { key: "COMPLETED", label: "Repair completed" },
  ];

  const currentIdx = stepDefs.findIndex((s) => s.key === job.status);

  return stepDefs.map((step, i) => {
    const histTime = historyMap.get(step.key);
    const isCompleted = i < currentIdx || (job.status === "COMPLETED" && step.key === "COMPLETED");
    const isCurrent = i === currentIdx && job.status !== "COMPLETED";
    const ts = histTime ?? (step.key === job.status ? (job.startedAt ?? undefined) : undefined);
    return {
      label: step.label,
      status: (isCompleted ? "completed" : isCurrent ? "current" : "pending") as "completed" | "current" | "pending",
      timestamp: ts ?? undefined,
    };
  });
}
