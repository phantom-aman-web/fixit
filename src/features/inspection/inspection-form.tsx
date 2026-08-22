"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  Eye,
  Plus,
  Save,
  Stethoscope,
  Trash2,
  Wrench,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  LoadingState,
  ErrorState,
  EmptyState,
} from "@/components/shared/states";
import { useApi, apiFetch } from "@/hooks/use-api";
import { navigate } from "@/store/router";
import { formatDateTime } from "@/lib/format";

// ────────────────────────────────────────────────────────────────────────────────
// Types — shape returned by GET /api/inspections/[jobId]
// ────────────────────────────────────────────────────────────────────────────────

type DiagnosticCheck = { check: string; result: string };

type Inspection = {
  id?: string;
  jobId: string;
  observedIssue?: string | null;
  physicalCondition?: string | null;
  diagnosticChecks?: string | null; // JSON string of DiagnosticCheck[]
  errorCodes?: string | null; // JSON string of string[]
  suspectedParts?: string | null; // JSON string of string[]
  safetyConcerns?: string | null; // JSON string of string[]
  notes?: string | null;
  photosJson?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

type InspectionResponse = { inspection: Inspection | null };

// ────────────────────────────────────────────────────────────────────────────────
// Helpers — parse/serialize JSON-encoded fields safely.
// ────────────────────────────────────────────────────────────────────────────────

function parseList(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw);
    if (Array.isArray(v)) return v.map((x) => String(x));
    return [];
  } catch {
    return [];
  }
}

function parseChecks(raw: string | null | undefined): DiagnosticCheck[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw);
    if (Array.isArray(v)) {
      return v.map((x) => ({
        check: String(x?.check ?? ""),
        result: String(x?.result ?? ""),
      }));
    }
    return [];
  } catch {
    return [];
  }
}

function listToCsv(list: string[]): string {
  return list.join(", ");
}

function csvToList(csv: string): string[] {
  return csv
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

// ────────────────────────────────────────────────────────────────────────────────
// Customer-report panel (read-only, optionally populated by parent).
// ────────────────────────────────────────────────────────────────────────────────

function CustomerReportPanel({
  customerReport,
  jobId,
}: {
  customerReport?: React.ReactNode;
  jobId: string;
}) {
  return (
    <Card className="border-primary/30 bg-primary/5">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Eye className="h-4 w-4 text-primary" aria-hidden />
          Verified customer report
        </CardTitle>
        <CardDescription>
          What the customer reported. Do not edit — record your findings below.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        {customerReport ? (
          customerReport
        ) : (
          <p className="text-muted-foreground">
            Review the customer's original report on the repair screen before
            completing your inspection.
          </p>
        )}
        <div className="pt-1">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate(`repair/${jobId}`)}
          >
            Open repair screen
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ────────────────────────────────────────────────────────────────────────────────
// Main InspectionForm
// ────────────────────────────────────────────────────────────────────────────────

export function InspectionForm({
  jobId,
  customerReport,
  onSaved,
}: {
  jobId: string;
  customerReport?: React.ReactNode;
  onSaved?: (inspection: Inspection) => void;
}) {
  const { data, isLoading, isError, error, refetch } = useApi<InspectionResponse>(
    ["inspection", jobId],
    `/api/inspections/${jobId}`,
  );

  const existing = data?.inspection ?? null;

  // Local form state.
  const [observedIssue, setObservedIssue] = useState("");
  const [physicalCondition, setPhysicalCondition] = useState("");
  const [checks, setChecks] = useState<DiagnosticCheck[]>([{ check: "", result: "" }]);
  const [errorCodesCsv, setErrorCodesCsv] = useState("");
  const [suspectedPartsCsv, setSuspectedPartsCsv] = useState("");
  const [safetyConcernsCsv, setSafetyConcernsCsv] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  // Pre-fill from existing inspection (runs once when data arrives).
  // Uses the "adjust state during render" pattern (with a guard) to avoid
  // setState-in-effect rules.
  const [hydratedKey, setHydratedKey] = useState<string | null>(null);
  if (existing && hydratedKey !== (existing.id ?? existing.jobId) + (existing.updatedAt ?? "")) {
    setHydratedKey((existing.id ?? existing.jobId) + (existing.updatedAt ?? ""));
    setObservedIssue(existing.observedIssue ?? "");
    setPhysicalCondition(existing.physicalCondition ?? "");
    const parsedChecks = parseChecks(existing.diagnosticChecks);
    setChecks(parsedChecks.length > 0 ? parsedChecks : [{ check: "", result: "" }]);
    setErrorCodesCsv(listToCsv(parseList(existing.errorCodes)));
    setSuspectedPartsCsv(listToCsv(parseList(existing.suspectedParts)));
    setSafetyConcernsCsv(listToCsv(parseList(existing.safetyConcerns)));
    setNotes(existing.notes ?? "");
    setSavedAt(existing.updatedAt ?? existing.createdAt ?? null);
  }

  // Reset state when jobId changes (defensive — keeps the form bound to the right job).
  useEffect(() => {
    setHydratedKey(null);
  }, [jobId]);

  // ── Diagnostic checks list handlers ─────────────────────────────────────────
  const updateCheck = (i: number, field: "check" | "result", value: string) => {
    setChecks((cs) => cs.map((c, idx) => (idx === i ? { ...c, [field]: value } : c)));
  };
  const addCheck = () => setChecks((cs) => [...cs, { check: "", result: "" }]);
  const removeCheck = (i: number) =>
    setChecks((cs) => cs.filter((_, idx) => idx !== i));

  // ── Submit ───────────────────────────────────────────────────────────────────
  const canSubmit = useMemo(() => {
    return (
      observedIssue.trim().length > 0 ||
      physicalCondition.trim().length > 0 ||
      notes.trim().length > 0 ||
      checks.some((c) => c.check.trim() || c.result.trim()) ||
      !!errorCodesCsv.trim() ||
      !!suspectedPartsCsv.trim() ||
      !!safetyConcernsCsv.trim()
    );
  }, [observedIssue, physicalCondition, notes, checks, errorCodesCsv, suspectedPartsCsv, safetyConcernsCsv]);

  const submit = async () => {
    if (!canSubmit) {
      toast.error("Please fill in at least one field before saving.");
      return;
    }
    const cleanChecks = checks
      .map((c) => ({ check: c.check.trim(), result: c.result.trim() }))
      .filter((c) => c.check || c.result);
    const payload: Record<string, string | undefined> = {
      observedIssue: observedIssue.trim() || undefined,
      physicalCondition: physicalCondition.trim() || undefined,
      diagnosticChecks: cleanChecks.length > 0 ? JSON.stringify(cleanChecks) : undefined,
      errorCodes: errorCodesCsv.trim() ? JSON.stringify(csvToList(errorCodesCsv)) : undefined,
      suspectedParts: suspectedPartsCsv.trim() ? JSON.stringify(csvToList(suspectedPartsCsv)) : undefined,
      safetyConcerns: safetyConcernsCsv.trim() ? JSON.stringify(csvToList(safetyConcernsCsv)) : undefined,
      notes: notes.trim() || undefined,
    };
    setSubmitting(true);
    try {
      const res = await apiFetch<InspectionResponse>(`/api/inspections/${jobId}`, {
        method: "POST",
        body: JSON.stringify(payload),
      });
      toast.success("Inspection recorded.");
      setSavedAt(new Date().toISOString());
      // Re-fetch so the form reflects the persisted record (createdAt/updatedAt, etc.).
      await refetch();
      onSaved?.(res.inspection ?? { jobId, ...payload });
    } catch (e: any) {
      toast.error(e?.message ?? "Could not save inspection");
    } finally {
      setSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ClipboardList className="h-4 w-4 text-primary" /> Inspection
          </CardTitle>
        </CardHeader>
        <CardContent>
          <LoadingState label="Loading inspection…" />
        </CardContent>
      </Card>
    );
  }

  if (isError) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ClipboardList className="h-4 w-4 text-primary" /> Inspection
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ErrorState
            title="Could not load inspection"
            detail={(error as Error)?.message}
            onRetry={() => refetch()}
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* VERIFIED CUSTOMER REPORT — read-only panel. */}
      <CustomerReportPanel customerReport={customerReport} jobId={jobId} />

      {/* TECHNICIAN OBSERVATION — the actual editable form. */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Stethoscope className="h-4 w-4 text-primary" />
            Technician observation
          </CardTitle>
          <CardDescription>
            Record what you found during the on-site inspection. Saved to the
            job and visible to the customer.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Observed issue */}
          <div className="space-y-1.5">
            <Label htmlFor="i-observed">Observed issue</Label>
            <Textarea
              id="i-observed"
              rows={3}
              value={observedIssue}
              onChange={(e) => setObservedIssue(e.target.value)}
              placeholder="What you observed when you arrived and inspected the equipment…"
            />
          </div>

          {/* Physical condition */}
          <div className="space-y-1.5">
            <Label htmlFor="i-condition">Physical condition</Label>
            <Textarea
              id="i-condition"
              rows={3}
              value={physicalCondition}
              onChange={(e) => setPhysicalCondition(e.target.value)}
              placeholder="External state of the equipment: visible damage, wear, leaks, etc."
            />
          </div>

          {/* Diagnostic checks (dynamic list) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Diagnostic checks</Label>
              <Button type="button" size="sm" variant="outline" onClick={addCheck}>
                <Plus className="h-4 w-4" /> Add check
              </Button>
            </div>
            <div className="space-y-2">
              {checks.map((c, i) => (
                <div
                  key={i}
                  className="grid grid-cols-1 gap-2 rounded-md border border-border bg-muted/20 p-2 sm:grid-cols-[1fr_1fr_auto]"
                >
                  <Input
                    aria-label={`Check ${i + 1} — what you tested`}
                    placeholder="What you tested (e.g. continuity, voltage)"
                    value={c.check}
                    onChange={(e) => updateCheck(i, "check", e.target.value)}
                  />
                  <Input
                    aria-label={`Check ${i + 1} — result`}
                    placeholder="Result (e.g. 0Ω, 240V, failed)"
                    value={c.result}
                    onChange={(e) => updateCheck(i, "result", e.target.value)}
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => removeCheck(i)}
                    aria-label={`Remove check ${i + 1}`}
                    disabled={checks.length === 1}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          </div>

          {/* Error codes */}
          <div className="space-y-1.5">
            <Label htmlFor="i-codes">Error codes (comma-separated)</Label>
            <Input
              id="i-codes"
              value={errorCodesCsv}
              onChange={(e) => setErrorCodesCsv(e.target.value)}
              placeholder="E.g. OE, F02, E1"
            />
            <p className="text-xs text-muted-foreground">
              Manufacturer-specific codes displayed on the equipment.
            </p>
          </div>

          {/* Suspected parts */}
          <div className="space-y-1.5">
            <Label htmlFor="i-parts">Suspected parts (comma-separated)</Label>
            <Input
              id="i-parts"
              value={suspectedPartsCsv}
              onChange={(e) => setSuspectedPartsCsv(e.target.value)}
              placeholder="E.g. drain pump, drum bearing, control board"
            />
          </div>

          {/* Safety concerns */}
          <div className="space-y-1.5">
            <Label htmlFor="i-safety">Safety concerns (comma-separated)</Label>
            <Input
              id="i-safety"
              value={safetyConcernsCsv}
              onChange={(e) => setSafetyConcernsCsv(e.target.value)}
              placeholder="E.g. exposed wiring, gas leak risk"
            />
            {safetyConcernsCsv.trim().length > 0 && (
              <Alert variant="destructive" className="mt-2 py-2">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle className="text-sm">Safety concern flagged</AlertTitle>
                <AlertDescription className="text-xs">
                  Highlight these concerns to the customer before proceeding
                  with any repair work.
                </AlertDescription>
              </Alert>
            )}
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label htmlFor="i-notes">Notes</Label>
            <Textarea
              id="i-notes"
              rows={4}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any additional context for the customer or your records…"
            />
          </div>

          {/* Save + post-save actions */}
          <div className="flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              {existing ? (
                <>
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" aria-hidden />
                  Inspection on file
                  {savedAt && <span>· last saved {formatDateTime(savedAt)}</span>}
                </>
              ) : (
                <>
                  <ClipboardList className="h-4 w-4" aria-hidden />
                  No inspection recorded yet
                </>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={submit} disabled={submitting || !canSubmit}>
                <Save className="h-4 w-4" />
                {submitting ? "Saving…" : existing ? "Update inspection" : "Save inspection"}
              </Button>
              {existing && (
                <Button
                  variant="outline"
                  onClick={() => navigate(`repair/${jobId}`)}
                >
                  <Wrench className="h-4 w-4" />
                  Proceed to quote
                </Button>
              )}
            </div>
          </div>

          {!canSubmit && (
            <p className="text-xs text-muted-foreground">
              Fill in at least one field to enable saving.
            </p>
          )}
        </CardContent>
      </Card>

      {existing === null && !isLoading && !isError && (
        // Helpful nudge when no inspection exists yet — keeps the page actionable.
        <EmptyState
          icon={ClipboardList}
          title="No inspection recorded yet"
          description="Complete the form above to document your findings. The customer will see this record alongside their original report."
        />
      )}
    </div>
  );
}

export default InspectionForm;
