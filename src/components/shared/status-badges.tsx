"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const SAFETY_STYLES: Record<string, string> = {
  SAFE: "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300",
  CAUTION:
    "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950 dark:text-amber-300",
  PROFESSIONAL_ONLY:
    "bg-red-100 text-red-800 border-red-200 dark:bg-red-950 dark:text-red-300",
};

const SAFETY_LABEL: Record<string, string> = {
  SAFE: "Safe",
  CAUTION: "Caution",
  PROFESSIONAL_ONLY: "Professional only",
};

export function SafetyBadge({ level }: { level: string }) {
  return (
    <Badge
      variant="outline"
      className={cn("font-medium", SAFETY_STYLES[level] ?? SAFETY_STYLES.SAFE)}
      title={level}
    >
      <span aria-hidden className="mr-1">
        {level === "PROFESSIONAL_ONLY" ? "⚠" : level === "CAUTION" ? "▲" : "✓"}
      </span>
      {SAFETY_LABEL[level] ?? level}
    </Badge>
  );
}

const CONFIDENCE_LABEL: Record<string, string> = {
  HIGH: "High confidence",
  MEDIUM: "Medium confidence",
  LOW: "Low confidence",
};

const CONFIDENCE_STYLE: Record<string, string> = {
  HIGH: "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300",
  MEDIUM:
    "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950 dark:text-amber-300",
  LOW: "bg-muted text-muted-foreground border-border",
};

export function confidenceTier(p: number): "HIGH" | "MEDIUM" | "LOW" {
  if (p >= 0.7) return "HIGH";
  if (p >= 0.45) return "MEDIUM";
  return "LOW";
}

export function ConfidenceBadge({ probability }: { probability: number }) {
  const tier = confidenceTier(probability);
  return (
    <Badge variant="outline" className={cn("font-medium", CONFIDENCE_STYLE[tier])}>
      {CONFIDENCE_LABEL[tier]} · {Math.round(probability * 100)}%
    </Badge>
  );
}

const RISK_LABEL: Record<string, string> = {
  SAFE: "Low risk",
  CAUTION: "Moderate risk",
  PROFESSIONAL_ONLY: "High risk",
};

export function RiskBadge({ level }: { level: string }) {
  return (
    <Badge variant="outline" className={cn("font-medium", SAFETY_STYLES[level] ?? SAFETY_STYLES.SAFE)}>
      {RISK_LABEL[level] ?? level}
    </Badge>
  );
}

const STATUS_STYLE: Record<string, string> = {
  // generic status colors
  OPEN: "bg-sky-100 text-sky-800 border-sky-200 dark:bg-sky-950 dark:text-sky-300",
  IN_PROGRESS:
    "bg-sky-100 text-sky-800 border-sky-200 dark:bg-sky-950 dark:text-sky-300",
  COMPLETED:
    "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300",
  CANCELLED:
    "bg-muted text-muted-foreground border-border",
  ESCALATED:
    "bg-red-100 text-red-800 border-red-200 dark:bg-red-950 dark:text-red-300",
  RESOLVED:
    "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300",
  ABANDONED:
    "bg-muted text-muted-foreground border-border",
  REQUESTED:
    "bg-sky-100 text-sky-800 border-sky-200 dark:bg-sky-950 dark:text-sky-300",
  ACCEPTED:
    "bg-indigo-100 text-indigo-800 border-indigo-200 dark:bg-indigo-950 dark:text-indigo-300",
  SCHEDULED:
    "bg-violet-100 text-violet-800 border-violet-200 dark:bg-violet-950 dark:text-violet-300",
  CONFIRMED:
    "bg-teal-100 text-teal-800 border-teal-200 dark:bg-teal-950 dark:text-teal-300",
  EN_ROUTE:
    "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950 dark:text-amber-300",
  ARRIVED:
    "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950 dark:text-amber-300",
  INSPECTING:
    "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950 dark:text-amber-300",
  DIAGNOSING:
    "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950 dark:text-amber-300",
  QUOTE_SUBMITTED:
    "bg-indigo-100 text-indigo-800 border-indigo-200 dark:bg-indigo-950 dark:text-indigo-300",
  AWAITING_APPROVAL:
    "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950 dark:text-amber-300",
  REPAIRING:
    "bg-sky-100 text-sky-800 border-sky-200 dark:bg-sky-950 dark:text-sky-300",
  SUBMITTED:
    "bg-indigo-100 text-indigo-800 border-indigo-200 dark:bg-indigo-950 dark:text-indigo-300",
  APPROVED:
    "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300",
  REJECTED:
    "bg-red-100 text-red-800 border-red-200 dark:bg-red-950 dark:text-red-300",
  EXPIRED:
    "bg-muted text-muted-foreground border-border",
  PENDING:
    "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950 dark:text-amber-300",
  SUCCEEDED:
    "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300",
  FAILED:
    "bg-red-100 text-red-800 border-red-200 dark:bg-red-950 dark:text-red-300",
  REFUNDED:
    "bg-muted text-muted-foreground border-border",
  MATCHED:
    "bg-indigo-100 text-indigo-800 border-indigo-200 dark:bg-indigo-950 dark:text-indigo-300",
  TECHNICIAN_SELECTED:
    "bg-indigo-100 text-indigo-800 border-indigo-200 dark:bg-indigo-950 dark:text-indigo-300",
  QUOTED:
    "bg-indigo-100 text-indigo-800 border-indigo-200 dark:bg-indigo-950 dark:text-indigo-300",
  BOOKED:
    "bg-teal-100 text-teal-800 border-teal-200 dark:bg-teal-950 dark:text-teal-300",
  ACTIVE:
    "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300",
  VOIDED:
    "bg-muted text-muted-foreground border-border",
  PENDING_TECH: "bg-muted text-muted-foreground border-border",
  AVAILABLE: "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300",
  BUSY: "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950 dark:text-amber-300",
  OFFLINE: "bg-muted text-muted-foreground border-border",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <Badge
      variant="outline"
      className={cn("font-medium capitalize", STATUS_STYLE[status] ?? "bg-muted text-muted-foreground border-border")}
    >
      {status.replaceAll("_", " ").toLowerCase()}
    </Badge>
  );
}
