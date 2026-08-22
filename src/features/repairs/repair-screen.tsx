"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { io, type Socket } from "socket.io-client";
import {
  AlertTriangle,
  ArrowLeft,
  BadgeCheck,
  Calendar,
  ClipboardList,
  Clock,
  CreditCard,
  History,
  Loader2,
  MapPin,
  MessageSquare,
  Package,
  Plus,
  ShieldCheck,
  Sparkles,
  Star,
  Trash2,
  Wrench,
} from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
  EmptyState,
  ErrorState,
  LoadingState,
  PageContainer,
} from "@/components/shared/states";
import { StatusBadge } from "@/components/shared/status-badges";
import { RepairTimeline, buildTimelineFromJob } from "@/components/shared/repair-timeline";
import { useApi, useApiMutation, apiFetch } from "@/hooks/use-api";
import { navigate } from "@/store/router";
import { formatCurrency, formatDateTime, timeAgo } from "@/lib/format";

// ────────────────────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────────────────────

type Technician = {
  id: string;
  displayName: string;
  avatarUrl?: string | null;
  phone?: string | null;
  rating: number;
  ratingCount: number;
  verified: boolean;
  userId: string;
};

type Problem = { id: string; description: string; category?: { slug: string; name: string } | null };
type RepairRequest = { id: string; status: string; problem: Problem };

type QuoteItem = { id: string; description: string; quantity: number; unitPrice: number; total: number };
type Quote = {
  id: string;
  status: string;
  inspectionFee: number;
  labor: number;
  partsTotal: number;
  taxesFees: number;
  totalEstimate: number;
  notes?: string | null;
  warrantyMonths?: number | null;
  estimatedDurationHours?: number | null;
  items: QuoteItem[];
};

type StatusHistory = { id: string; status: string; note?: string | null; createdAt: string };
type RepairPart = { id: string; name: string; partNumber?: string | null; quantity: number; unitCost: number; totalCost: number };

type Review = {
  id: string;
  rating: number;
  title?: string | null;
  body?: string | null;
  qualityRating?: number | null;
  professionalismRating?: number | null;
  communicationRating?: number | null;
  valueRating?: number | null;
  createdAt: string;
};

type Warranty = {
  id: string;
  startDate: string;
  endDate: string;
  durationMonths: number;
  coveredWork: string;
  status: string;
};

type Customer = { id: string; user?: { id: string; name?: string | null; email?: string | null } | null; phone?: string | null; subCity?: string | null };

type Booking = {
  id: string;
  status: string;
  scheduledAt: string;
  location: string;
  notes?: string | null;
  technician?: Technician | null;
  customer?: Customer | null;
  repairRequest: RepairRequest;
  quote?: Quote | null;
};

type RepairJob = {
  id: string;
  status: string;
  diagnosis?: string | null;
  workPerformed?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
  createdAt: string;
  booking: Booking;
  statusHistory: StatusHistory[];
  parts: RepairPart[];
  review?: Review | null;
  warranty?: Warranty | null;
};

// Job lifecycle, in order.
const JOB_STEPS = [
  "SCHEDULED",
  "EN_ROUTE",
  "ARRIVED",
  "INSPECTING",
  "DIAGNOSING",
  "QUOTE_SUBMITTED",
  "AWAITING_APPROVAL",
  "REPAIRING",
  "COMPLETED",
];

const NEXT_STATUS: Record<string, string | null> = {
  SCHEDULED: "EN_ROUTE",
  EN_ROUTE: "ARRIVED",
  ARRIVED: "INSPECTING",
  INSPECTING: "DIAGNOSING",
  DIAGNOSING: "QUOTE_SUBMITTED",
  QUOTE_SUBMITTED: "AWAITING_APPROVAL",
  AWAITING_APPROVAL: "REPAIRING",
  REPAIRING: "COMPLETED",
  COMPLETED: null,
};

const NEXT_STATUS_LABEL: Record<string, string> = {
  EN_ROUTE: "Mark en route",
  ARRIVED: "Mark arrived",
  INSPECTING: "Begin inspection",
  DIAGNOSING: "Begin diagnosing",
  QUOTE_SUBMITTED: "Mark quote submitted",
  AWAITING_APPROVAL: "Move to awaiting approval",
  REPAIRING: "Begin repair",
  COMPLETED: "Mark complete",
};

function initials(name: string): string {
  return name.split(" ").filter(Boolean).slice(0, 2).map((s) => s[0]?.toUpperCase()).join("");
}

// ────────────────────────────────────────────────────────────────────────────────
// Job status stepper (horizontal)
// ────────────────────────────────────────────────────────────────────────────────

function JobStepper({ status }: { status: string }) {
  const current = JOB_STEPS.indexOf(status);
  if (status === "CANCELLED") {
    return (
      <div className="rounded-md border border-destructive/30 bg-destructive/5 p-4 text-sm">
        <p className="flex items-center gap-2 font-medium text-destructive">
          <AlertTriangle className="h-4 w-4" /> This job was cancelled
        </p>
      </div>
    );
  }
  return (
    <div className="flex items-center justify-between gap-1 overflow-x-auto pb-1">
      {JOB_STEPS.map((s, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <div key={s} className="flex flex-1 flex-col items-center gap-1 text-center">
            <div className="flex w-full items-center">
              <div className={`h-0.5 flex-1 ${i === 0 ? "opacity-0" : done || active ? "bg-primary" : "bg-border"}`} />
              <div
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold sm:h-7 sm:w-7 ${
                  active
                    ? "bg-primary text-primary-foreground"
                    : done
                    ? "bg-primary/20 text-primary"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {i + 1}
              </div>
              <div className={`h-0.5 flex-1 ${i === JOB_STEPS.length - 1 ? "opacity-0" : done ? "bg-primary" : "bg-border"}`} />
            </div>
            <span className={`text-[9px] sm:text-[11px] ${active ? "font-medium text-primary" : "text-muted-foreground"}`}>
              {s.replaceAll("_", " ").toLowerCase()}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────────
// Customer review form
// ────────────────────────────────────────────────────────────────────────────────

function StarInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: 5 }).map((_, i) => (
        <button
          key={i}
          type="button"
          onClick={() => onChange(i + 1)}
          aria-label={`${i + 1} star${i === 0 ? "" : "s"}`}
          className="rounded p-0.5 hover:bg-muted"
        >
          <Star
            className={`h-6 w-6 ${
              i < value ? "fill-amber-400 text-amber-400" : "text-muted-foreground/40"
            }`}
          />
        </button>
      ))}
    </div>
  );
}

function ReviewForm({ jobId }: { jobId: string }) {
  const [rating, setRating] = useState(5);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [qualityRating, setQualityRating] = useState(0);
  const [professionalismRating, setProfessionalismRating] = useState(0);
  const [communicationRating, setCommunicationRating] = useState(0);
  const [valueRating, setValueRating] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  const mutation = useApiMutation(`/api/reviews/${jobId}`, "POST");

  const submit = async () => {
    if (rating < 1) {
      toast.error("Please select a star rating.");
      return;
    }
    setSubmitting(true);
    try {
      await mutation.mutateAsync({
        rating,
        title: title.trim() || undefined,
        body: body.trim() || undefined,
        qualityRating: qualityRating || undefined,
        professionalismRating: professionalismRating || undefined,
        communicationRating: communicationRating || undefined,
        valueRating: valueRating || undefined,
      });
      toast.success("Review submitted. Thank you!");
    } catch (e: any) {
      toast.error(e?.message ?? "Could not submit review");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Star className="h-4 w-4 text-amber-400" /> Rate your repair
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1.5">
          <Label>Overall rating</Label>
          <StarInput value={rating} onChange={setRating} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="r-title">Title (optional)</Label>
          <Input id="r-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Great service!" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="r-body">Review (optional)</Label>
          <Textarea id="r-body" rows={4} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Share details about your experience…" />
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            ["Quality", qualityRating, setQualityRating],
            ["Professionalism", professionalismRating, setProfessionalismRating],
            ["Communication", communicationRating, setCommunicationRating],
            ["Value", valueRating, setValueRating],
          ].map(([label, val, set]) => (
            <div key={label as string} className="space-y-1.5">
              <Label className="text-xs">{label as string}</Label>
              <div className="flex gap-0.5">
                {Array.from({ length: 5 }).map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => (set as (v: number) => void)(i + 1)}
                    aria-label={`${i + 1} star${i === 0 ? "" : "s"}`}
                    className="rounded p-0.5 hover:bg-muted"
                  >
                    <Star
                      className={`h-4 w-4 ${
                        i < (val as number) ? "fill-amber-400 text-amber-400" : "text-muted-foreground/40"
                      }`}
                    />
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
        <Button onClick={submit} disabled={submitting}>
          {submitting ? "Submitting…" : "Submit review"}
        </Button>
      </CardContent>
    </Card>
  );
}

function ReviewDisplay({ review }: { review: Review }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Star className="h-4 w-4 text-amber-400" /> Your review
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="flex items-center gap-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Star key={i} className={`h-4 w-4 ${i < review.rating ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"}`} />
          ))}
          <span className="text-xs text-muted-foreground">{timeAgo(review.createdAt)}</span>
        </div>
        {review.title && <p className="font-medium">{review.title}</p>}
        {review.body && <p className="text-sm text-muted-foreground">{review.body}</p>}
        {(review.qualityRating || review.professionalismRating || review.communicationRating || review.valueRating) && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {review.qualityRating && <Badge variant="secondary" className="text-xs">Quality {review.qualityRating}/5</Badge>}
            {review.professionalismRating && <Badge variant="secondary" className="text-xs">Pro {review.professionalismRating}/5</Badge>}
            {review.communicationRating && <Badge variant="secondary" className="text-xs">Comms {review.communicationRating}/5</Badge>}
            {review.valueRating && <Badge variant="secondary" className="text-xs">Value {review.valueRating}/5</Badge>}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ────────────────────────────────────────────────────────────────────────────────
// Technician workflow controls
// ────────────────────────────────────────────────────────────────────────────────

function TechnicianWorkflow({ job, onRefresh }: { job: RepairJob; onRefresh: () => void }) {
  const transition = useApiMutation(`/api/repair-jobs/${job.id}/transition`, "POST");
  const [transitioning, setTransitioning] = useState(false);

  const advance = async (next: string) => {
    setTransitioning(true);
    try {
      await transition.mutateAsync({ status: next });
      toast.success(`Status updated: ${next.replaceAll("_", " ").toLowerCase()}`);
      onRefresh();
    } catch (e: any) {
      toast.error(e?.message ?? "Could not update status");
    } finally {
      setTransitioning(false);
    }
  };

  const nextStatus = NEXT_STATUS[job.status] ?? null;
  const canSubmitQuote = ["INSPECTING", "DIAGNOSING"].includes(job.status);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Wrench className="h-4 w-4 text-primary" /> Workflow controls
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Current status</span>
            <StatusBadge status={job.status} />
          </div>
          {nextStatus && (
            <Button onClick={() => advance(nextStatus)} disabled={transitioning} className="w-full">
              {NEXT_STATUS_LABEL[nextStatus]}
            </Button>
          )}
          {canSubmitQuote && (
            <div className="rounded-md border border-primary/30 bg-primary/5 p-3 text-sm">
              <p className="font-medium">Ready to quote?</p>
              <p className="mt-0.5 text-muted-foreground">
                Submit a quote below; the request will move to <span className="font-medium">QUOTE_SUBMITTED</span> automatically.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quote submission */}
      <QuoteForm
        jobId={job.id}
        repairRequestId={job.booking.repairRequest.id}
        existingQuote={job.booking.quote}
        enabled={canSubmitQuote || job.status === "QUOTE_SUBMITTED" || job.status === "AWAITING_APPROVAL"}
        onSaved={onRefresh}
      />

      {/* Diagnosis & work performed */}
      <DiagnosisForm job={job} onSaved={onRefresh} />

      {/* Parts */}
      <PartsForm job={job} onSaved={onRefresh} />
    </div>
  );
}

function QuoteForm({
  jobId,
  repairRequestId,
  existingQuote,
  enabled,
  onSaved,
}: {
  jobId: string;
  repairRequestId: string;
  existingQuote?: Quote | null;
  enabled: boolean;
  onSaved: () => void;
}) {
  const [items, setItems] = useState<{ description: string; quantity: string; unitPrice: string }[]>(
    existingQuote?.items?.map((i) => ({
      description: i.description,
      quantity: String(i.quantity),
      unitPrice: String(i.unitPrice),
    })) ?? [{ description: "", quantity: "1", unitPrice: "" }],
  );
  const [inspectionFee, setInspectionFee] = useState(existingQuote ? String(existingQuote.inspectionFee) : "");
  const [labor, setLabor] = useState(existingQuote ? String(existingQuote.labor) : "");
  const [taxesFees, setTaxesFees] = useState(existingQuote ? String(existingQuote.taxesFees) : "");
  const [warrantyMonths, setWarrantyMonths] = useState(existingQuote?.warrantyMonths ? String(existingQuote.warrantyMonths) : "");
  const [estimatedDurationHours, setEstimatedDurationHours] = useState(
    existingQuote?.estimatedDurationHours ? String(existingQuote.estimatedDurationHours) : "",
  );
  const [notes, setNotes] = useState(existingQuote?.notes ?? "");
  const [submitting, setSubmitting] = useState(false);

  const mutation = useApiMutation(`/api/quotes`, "POST");

  const addItem = () => setItems([...items, { description: "", quantity: "1", unitPrice: "" }]);
  const removeItem = (i: number) => setItems(items.filter((_, idx) => idx !== i));
  const updateItem = (i: number, field: "description" | "quantity" | "unitPrice", value: string) =>
    setItems(items.map((it, idx) => (idx === i ? { ...it, [field]: value } : it)));

  const total = useMemo(() => {
    const itemsTotal = items.reduce((s, it) => {
      const qty = parseInt(it.quantity || "0", 10) || 0;
      const price = parseInt(it.unitPrice || "0", 10) || 0;
      return s + qty * price;
    }, 0);
    const insp = parseInt(inspectionFee || "0", 10) || 0;
    const lab = parseInt(labor || "0", 10) || 0;
    const tax = parseInt(taxesFees || "0", 10) || 0;
    return itemsTotal + insp + lab + tax;
  }, [items, inspectionFee, labor, taxesFees]);

  const submit = async () => {
    if (!repairRequestId) {
      toast.error("Missing repair request context.");
      return;
    }
    const cleanItems = items
      .filter((it) => it.description.trim() && parseInt(it.unitPrice || "0", 10) > 0)
      .map((it) => ({
        description: it.description.trim(),
        quantity: parseInt(it.quantity || "1", 10) || 1,
        unitPrice: parseInt(it.unitPrice || "0", 10) || 0,
      }));
    setSubmitting(true);
    try {
      await mutation.mutateAsync({
        repairRequestId,
        inspectionFee: parseInt(inspectionFee || "0", 10) || 0,
        labor: parseInt(labor || "0", 10) || 0,
        taxesFees: parseInt(taxesFees || "0", 10) || 0,
        warrantyMonths: warrantyMonths ? parseInt(warrantyMonths, 10) : undefined,
        estimatedDurationHours: estimatedDurationHours ? parseInt(estimatedDurationHours, 10) : undefined,
        notes: notes.trim() || undefined,
        items: cleanItems,
      });
      toast.success("Quote submitted.");
      onSaved();
    } catch (e: any) {
      toast.error(e?.message ?? "Could not submit quote");
    } finally {
      setSubmitting(false);
    }
  };

  if (!enabled) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-2 text-base">
          <span className="flex items-center gap-2"><ClipboardList className="h-4 w-4 text-primary" /> Quote</span>
          {existingQuote && <StatusBadge status={existingQuote.status} />}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label className="text-xs uppercase tracking-wide text-muted-foreground">Items / parts</Label>
          {items.map((it, i) => (
            <div key={i} className="grid grid-cols-12 gap-2">
              <Input
                className="col-span-12 sm:col-span-6"
                placeholder="Description (e.g. Drive belt)"
                value={it.description}
                onChange={(e) => updateItem(i, "description", e.target.value)}
              />
              <Input
                className="col-span-3 sm:col-span-2"
                type="number"
                min={1}
                placeholder="Qty"
                value={it.quantity}
                onChange={(e) => updateItem(i, "quantity", e.target.value)}
              />
              <Input
                className="col-span-7 sm:col-span-3"
                type="number"
                min={0}
                placeholder="Unit price (ETB)"
                value={it.unitPrice}
                onChange={(e) => updateItem(i, "unitPrice", e.target.value)}
              />
              <Button
                variant="ghost"
                size="icon"
                className="col-span-2 sm:col-span-1"
                onClick={() => removeItem(i)}
                disabled={items.length === 1}
                aria-label="Remove item"
              >
                <Trash2 className="h-4 w-4 text-muted-foreground" />
              </Button>
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={addItem}>
            <Plus className="h-4 w-4" /> Add item
          </Button>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="q-insp">Inspection fee (ETB)</Label>
            <Input id="q-insp" type="number" min={0} value={inspectionFee} onChange={(e) => setInspectionFee(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="q-labor">Labor (ETB)</Label>
            <Input id="q-labor" type="number" min={0} value={labor} onChange={(e) => setLabor(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="q-tax">Taxes &amp; fees (ETB)</Label>
            <Input id="q-tax" type="number" min={0} value={taxesFees} onChange={(e) => setTaxesFees(e.target.value)} />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="q-warranty">Warranty months (optional)</Label>
            <Input id="q-warranty" type="number" min={0} value={warrantyMonths} onChange={(e) => setWarrantyMonths(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="q-duration">Estimated duration hours (optional)</Label>
            <Input id="q-duration" type="number" min={0} value={estimatedDurationHours} onChange={(e) => setEstimatedDurationHours(e.target.value)} />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="q-notes">Notes for customer (optional)</Label>
          <Textarea id="q-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Explain what's included, assumptions, etc." />
        </div>

        <div className="flex items-center justify-between rounded-md bg-muted/40 p-3">
          <span className="text-sm text-muted-foreground">Total estimate</span>
          <span className="text-lg font-bold text-primary">{formatCurrency(total)}</span>
        </div>

        <Button onClick={submit} disabled={submitting} className="w-full">
          {submitting ? "Submitting…" : existingQuote ? "Update quote" : "Submit quote"}
        </Button>
      </CardContent>
    </Card>
  );
}

function DiagnosisForm({ job, onSaved }: { job: RepairJob; onSaved: () => void }) {
  const [diagnosis, setDiagnosis] = useState(job.diagnosis ?? "");
  const [workPerformed, setWorkPerformed] = useState(job.workPerformed ?? "");
  const [submitting, setSubmitting] = useState(false);
  const mutation = useApiMutation(`/api/repair-jobs/${job.id}/diagnosis`, "POST");

  const submit = async () => {
    setSubmitting(true);
    try {
      await mutation.mutateAsync({
        diagnosis: diagnosis.trim() || undefined,
        workPerformed: workPerformed.trim() || undefined,
      });
      toast.success("Diagnosis & work performed saved.");
      onSaved();
    } catch (e: any) {
      toast.error(e?.message ?? "Could not save");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <ClipboardList className="h-4 w-4 text-primary" /> Diagnosis &amp; work performed
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="d-diag">Diagnosis</Label>
          <Textarea id="d-diag" rows={3} value={diagnosis} onChange={(e) => setDiagnosis(e.target.value)} placeholder="What's wrong with the equipment?" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="d-work">Work performed</Label>
          <Textarea id="d-work" rows={3} value={workPerformed} onChange={(e) => setWorkPerformed(e.target.value)} placeholder="What did you do to fix it?" />
        </div>
        <Button onClick={submit} disabled={submitting} variant="outline">
          {submitting ? "Saving…" : "Save diagnosis"}
        </Button>
      </CardContent>
    </Card>
  );
}

function PartsForm({ job, onSaved }: { job: RepairJob; onSaved: () => void }) {
  const [parts, setParts] = useState<{ name: string; partNumber: string; quantity: string; unitCost: string }[]>(
    job.parts?.map((p) => ({
      name: p.name,
      partNumber: p.partNumber ?? "",
      quantity: String(p.quantity),
      unitCost: String(p.unitCost),
    })) ?? [{ name: "", partNumber: "", quantity: "1", unitCost: "" }],
  );
  const [submitting, setSubmitting] = useState(false);
  const mutation = useApiMutation(`/api/repair-jobs/${job.id}/parts`, "POST");

  const add = () => setParts([...parts, { name: "", partNumber: "", quantity: "1", unitCost: "" }]);
  const remove = (i: number) => setParts(parts.filter((_, idx) => idx !== i));
  const update = (i: number, field: "name" | "partNumber" | "quantity" | "unitCost", value: string) =>
    setParts(parts.map((p, idx) => (idx === i ? { ...p, [field]: value } : p)));

  const submit = async () => {
    const clean = parts
      .filter((p) => p.name.trim())
      .map((p) => ({
        name: p.name.trim(),
        partNumber: p.partNumber.trim() || undefined,
        quantity: parseInt(p.quantity || "1", 10) || 1,
        unitCost: parseInt(p.unitCost || "0", 10) || 0,
      }));
    setSubmitting(true);
    try {
      await mutation.mutateAsync({ parts: clean });
      toast.success("Parts saved.");
      onSaved();
    } catch (e: any) {
      toast.error(e?.message ?? "Could not save parts");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Package className="h-4 w-4 text-primary" /> Parts used
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {parts.map((p, i) => (
          <div key={i} className="grid grid-cols-12 gap-2">
            <Input className="col-span-12 sm:col-span-5" placeholder="Part name" value={p.name} onChange={(e) => update(i, "name", e.target.value)} />
            <Input className="col-span-6 sm:col-span-3" placeholder="Part #" value={p.partNumber} onChange={(e) => update(i, "partNumber", e.target.value)} />
            <Input className="col-span-3 sm:col-span-2" type="number" min={1} placeholder="Qty" value={p.quantity} onChange={(e) => update(i, "quantity", e.target.value)} />
            <Input className="col-span-7 sm:col-span-3" type="number" min={0} placeholder="Unit cost" value={p.unitCost} onChange={(e) => update(i, "unitCost", e.target.value)} />
            <Button variant="ghost" size="icon" className="col-span-4 sm:col-span-1" onClick={() => remove(i)} disabled={parts.length === 1} aria-label="Remove part">
              <Trash2 className="h-4 w-4 text-muted-foreground" />
            </Button>
          </div>
        ))}
        <Button variant="outline" size="sm" onClick={add}><Plus className="h-4 w-4" /> Add part</Button>
        <Button onClick={submit} disabled={submitting} className="w-full">
          {submitting ? "Saving…" : "Save parts"}
        </Button>
      </CardContent>
    </Card>
  );
}

// ────────────────────────────────────────────────────────────────────────────────
// Main screen
// ────────────────────────────────────────────────────────────────────────────────

export function RepairScreen({ jobId }: { jobId: string }) {
  const { data: session, status } = useSession();
  const role = session?.user?.role;

  // For technicians (and admins viewing as tech), use /api/technician/jobs;
  // for customers, use /api/bookings and find the matching repairJob.
  const isTechView = role === "TECHNICIAN" || role === "ADMIN";

  const {
    data: techData,
    isLoading: techLoading,
    isError: techError,
    error: techErr,
    refetch: techRefetch,
  } = useApi<{ jobs: RepairJob[] }>(
    ["technician-jobs", jobId],
    isTechView ? "/api/technician/jobs" : null,
    { refetchInterval: 10_000 },
  );

  const {
    data: custData,
    isLoading: custLoading,
    isError: custError,
    error: custErr,
    refetch: custRefetch,
  } = useApi<{ bookings: { repairJob: RepairJob }[] }>(
    ["bookings-for-repair", jobId],
    !isTechView ? "/api/bookings" : null,
    { refetchInterval: 10_000 },
  );

  const job = useMemo(() => {
    if (isTechView) {
      return techData?.jobs.find((j) => j.id === jobId);
    }
    return custData?.bookings.find((b) => b.repairJob?.id === jobId)?.repairJob;
  }, [isTechView, techData, custData, jobId]);

  // Realtime socket.io: best-effort — falls back to polling if unavailable.
  useEffect(() => {
    let socket: Socket | null = null;
    try {
      socket = io(`/?XTransformPort=3003`, {
        transports: ["websocket", "polling"],
        reconnection: true,
        reconnectionAttempts: 3,
        timeout: 8000,
      });
      socket.on(`job:${jobId}:status`, () => {
        if (isTechView) techRefetch();
        else custRefetch();
      });
    } catch {
      // Ignore — polling will handle updates.
    }
    return () => {
      try {
        socket?.disconnect();
      } catch {}
    };
  }, [jobId, isTechView, techRefetch, custRefetch]);

  const onRefresh = () => {
    if (isTechView) techRefetch();
    else custRefetch();
  };

  if (status === "loading" || (isTechView ? techLoading : custLoading)) {
    return (
      <PageContainer>
        <LoadingState label="Loading repair…" />
      </PageContainer>
    );
  }

  if (isTechView ? techError : custError) {
    const err = (isTechView ? techErr : custErr) as Error;
    return (
      <PageContainer>
        <ErrorState title="Could not load repair" detail={err?.message} onRetry={onRefresh} />
      </PageContainer>
    );
  }

  if (!job) {
    return (
      <PageContainer>
        <EmptyState
          icon={AlertTriangle}
          title="Repair job not found"
          description="This job may not exist or you may not have access."
          action={<Button onClick={() => navigate(isTechView ? "technician/jobs" : "history")}>Go back</Button>}
        />
      </PageContainer>
    );
  }

  const booking = job.booking;
  const tech = booking.technician;
  const customer = booking.customer;
  const problem = booking.repairRequest.problem;
  // The technician jobs endpoint already filters by the signed-in technician's profile,
  // so any job returned by it is one they're authorized to work on. Admins also see controls.
  const showTechControls = isTechView;

  return (
    <PageContainer>
      <Button variant="ghost" size="sm" className="mb-3 -ml-2" onClick={() => navigate(isTechView ? "technician/jobs" : "history")}>
        <ArrowLeft className="h-4 w-4" /> Back
      </Button>

      <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Repair job</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {problem?.category?.name ?? "Equipment"} · {booking.repairRequest.id.slice(-6).toUpperCase()}
          </p>
        </div>
        <StatusBadge status={job.status} />
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {/* Left/main column */}
        <div className="lg:col-span-2 space-y-5">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Status</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <JobStepper status={job.status} />
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="flex items-start gap-2 text-sm">
                  <Calendar className="mt-0.5 h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Scheduled</p>
                    <p className="font-medium">{formatDateTime(booking.scheduledAt)}</p>
                  </div>
                </div>
                <div className="flex items-start gap-2 text-sm">
                  <MapPin className="mt-0.5 h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Location</p>
                    <p className="font-medium">{booking.location}</p>
                  </div>
                </div>
              </div>
              {booking.notes && (
                <div className="rounded-md bg-muted/40 p-3 text-sm">
                  <p className="mb-0.5 flex items-center gap-1.5 font-medium"><MessageSquare className="h-3.5 w-3.5" /> Booking notes</p>
                  <p className="text-muted-foreground">{booking.notes}</p>
                </div>
              )}
              {problem && (
                <div className="rounded-md border p-3 text-sm">
                  <p className="mb-1 text-xs text-muted-foreground">Problem</p>
                  {problem.category && <Badge variant="secondary" className="mb-1.5">{problem.category.name}</Badge>}
                  <p className="text-muted-foreground">{problem.description}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Visual repair timeline */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <History className="h-4 w-4 text-primary" /> Repair progress
              </CardTitle>
            </CardHeader>
            <CardContent>
              <RepairTimeline steps={buildTimelineFromJob({
                status: job.status,
                startedAt: job.startedAt,
                completedAt: job.completedAt,
                createdAt: job.createdAt,
                statusHistory: job.statusHistory,
                booking: { status: booking.status, scheduledAt: booking.scheduledAt, createdAt: (booking as any).createdAt },
              })} />
            </CardContent>
          </Card>

          {/* Status history timeline */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <History className="h-4 w-4 text-primary" /> Detailed history
              </CardTitle>
            </CardHeader>
            <CardContent>
              {job.statusHistory.length === 0 ? (
                <p className="text-sm text-muted-foreground">No history yet.</p>
              ) : (
                <ol className="relative space-y-4 border-l border-border pl-4">
                  {job.statusHistory.map((h, i) => (
                    <li key={h.id} className="relative">
                      <span className={`absolute -left-[1.4rem] top-1 h-2.5 w-2.5 rounded-full ${i === 0 ? "bg-primary" : "bg-muted-foreground/50"}`} />
                      <div className="flex flex-wrap items-center gap-2">
                        <StatusBadge status={h.status} />
                        <span className="text-xs text-muted-foreground">{formatDateTime(h.createdAt)}</span>
                      </div>
                      {h.note && <p className="mt-1 text-sm text-muted-foreground">{h.note}</p>}
                    </li>
                  ))}
                </ol>
              )}
            </CardContent>
          </Card>

          {/* Quote display (customer view) */}
          {!showTechControls && booking.quote && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between gap-2 text-base">
                  <span className="flex items-center gap-2"><ClipboardList className="h-4 w-4 text-primary" /> Quote</span>
                  <StatusBadge status={booking.quote.status} />
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {booking.quote.items.length > 0 && (
                  <div className="divide-y rounded-md border">
                    {booking.quote.items.map((it) => (
                      <div key={it.id} className="flex items-center justify-between px-3 py-2">
                        <span className="truncate pr-2">{it.description} <span className="text-xs text-muted-foreground">x{it.quantity}</span></span>
                        <span className="font-medium">{formatCurrency(it.total)}</span>
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex items-center justify-between"><span className="text-muted-foreground">Inspection</span><span>{formatCurrency(booking.quote.inspectionFee)}</span></div>
                <div className="flex items-center justify-between"><span className="text-muted-foreground">Labor</span><span>{formatCurrency(booking.quote.labor)}</span></div>
                <div className="flex items-center justify-between"><span className="text-muted-foreground">Taxes &amp; fees</span><span>{formatCurrency(booking.quote.taxesFees)}</span></div>
                <Separator className="my-1" />
                <div className="flex items-center justify-between"><span className="font-medium">Total</span><span className="text-base font-bold text-primary">{formatCurrency(booking.quote.totalEstimate)}</span></div>
                {booking.quote.warrantyMonths != null && (
                  <Badge variant="secondary" className="mt-1 gap-1"><ShieldCheck className="h-3 w-3" /> {booking.quote.warrantyMonths}mo warranty</Badge>
                )}
                {booking.quote.notes && (
                  <p className="mt-2 rounded-md bg-muted/40 p-2 text-xs text-muted-foreground">{booking.quote.notes}</p>
                )}
              </CardContent>
            </Card>
          )}

          {/* Diagnosis / work performed display (customer view) */}
          {!showTechControls && (job.diagnosis || job.workPerformed) && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Diagnosis &amp; work performed</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                {job.diagnosis && (
                  <div>
                    <p className="text-xs text-muted-foreground">Diagnosis</p>
                    <p>{job.diagnosis}</p>
                  </div>
                )}
                {job.workPerformed && (
                  <div>
                    <p className="text-xs text-muted-foreground">Work performed</p>
                    <p>{job.workPerformed}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Parts display (customer view) */}
          {!showTechControls && job.parts.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base"><Package className="h-4 w-4 text-primary" /> Parts used</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="divide-y rounded-md border">
                  {job.parts.map((p) => (
                    <div key={p.id} className="flex items-center justify-between px-3 py-2 text-sm">
                      <div>
                        <p>{p.name}</p>
                        <p className="text-xs text-muted-foreground">x{p.quantity} · {formatCurrency(p.unitCost)}{p.partNumber ? ` · #${p.partNumber}` : ""}</p>
                      </div>
                      <span className="font-medium">{formatCurrency(p.totalCost)}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Review / warranty (customer view, completed jobs) */}
          {!showTechControls && job.status === "COMPLETED" && (
            <>
              {job.review ? <ReviewDisplay review={job.review} /> : <ReviewForm jobId={job.id} />}
              {job.warranty && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <ShieldCheck className="h-4 w-4 text-emerald-600" /> Warranty
                      <StatusBadge status={job.warranty.status} />
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <p><span className="text-muted-foreground">Duration:</span> {job.warranty.durationMonths} months</p>
                    <p><span className="text-muted-foreground">Valid:</span> {formatDateTime(job.warranty.startDate)} → {formatDateTime(job.warranty.endDate)}</p>
                    <p><span className="text-muted-foreground">Covered work:</span> {job.warranty.coveredWork}</p>
                  </CardContent>
                </Card>
              )}
            </>
          )}

          {/* Payment shortcut for customer */}
          {!showTechControls && booking.status === "CONFIRMED" && !booking.quote && (
            <Card className="border-primary/30">
              <CardContent className="p-4 text-sm">
                <p className="flex items-center gap-2 font-medium"><CreditCard className="h-4 w-4 text-primary" /> Payment pending</p>
                <p className="mt-1 text-muted-foreground">Your repair is confirmed. Once a quote is in place, you can complete payment.</p>
                <Button className="mt-3" onClick={() => navigate(`booking/${booking.id}`)}>Go to booking</Button>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right column */}
        <div className="lg:col-span-1 space-y-5">
          {/* Technician (customer view) or Customer (tech view) */}
          {showTechControls && customer ? (
            <Card>
              <CardHeader><CardTitle className="text-base">Customer</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p className="font-medium">{customer.user?.name ?? customer.user?.email ?? "Customer"}</p>
                {customer.phone && <p className="text-muted-foreground">{customer.phone}</p>}
                {customer.subCity && (
                  <p className="flex items-center gap-1 text-muted-foreground"><MapPin className="h-3.5 w-3.5" /> {customer.subCity}</p>
                )}
                <Separator className="my-2" />
                <p className="flex items-center gap-1 text-muted-foreground"><MapPin className="h-3.5 w-3.5" /> {booking.location}</p>
                <p className="flex items-center gap-1 text-muted-foreground"><Calendar className="h-3.5 w-3.5" /> {formatDateTime(booking.scheduledAt)}</p>
                {booking.notes && (
                  <p className="mt-2 rounded-md bg-muted/40 p-2 text-xs">{booking.notes}</p>
                )}
              </CardContent>
            </Card>
          ) : !showTechControls && tech ? (
            <Card>
              <CardHeader><CardTitle className="text-base">Technician</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-3">
                  <Avatar className="h-12 w-12 border">
                    {tech.avatarUrl ? <AvatarImage src={tech.avatarUrl} alt="" /> : null}
                    <AvatarFallback>{initials(tech.displayName)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="flex items-center gap-1.5 font-medium">
                      {tech.displayName}
                      {tech.verified && <BadgeCheck className="h-4 w-4 text-emerald-600" />}
                    </p>
                    <p className="text-xs text-muted-foreground">★ {tech.rating.toFixed(1)} ({tech.ratingCount})</p>
                  </div>
                </div>
                {tech.phone && <p className="flex items-center gap-1 text-sm text-muted-foreground"><MessageSquare className="h-3.5 w-3.5" /> {tech.phone}</p>}
                <Button variant="outline" size="sm" className="w-full" onClick={() => navigate(`technicians/${tech.id}`)}>View profile</Button>
              </CardContent>
            </Card>
          ) : null}

          {/* Tech workflow controls */}
          {showTechControls && <TechnicianWorkflow job={job} onRefresh={onRefresh} />}

          {/* AI technician brief + repair summary */}
          {booking.repairRequest && (
            <AIBriefCard repairRequestId={booking.repairRequest.id} jobId={job.id} jobStatus={job.status} />
          )}

          {/* Quick meta */}
          <Card>
            <CardHeader><CardTitle className="text-base">Details</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Booking</span>
                <Badge variant="outline">{booking.status.replaceAll("_", " ").toLowerCase()}</Badge>
              </div>
              {job.startedAt && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Started</span>
                  <span>{formatDateTime(job.startedAt)}</span>
                </div>
              )}
              {job.completedAt && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Completed</span>
                  <span>{formatDateTime(job.completedAt)}</span>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Created</span>
                <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {timeAgo(job.createdAt)}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </PageContainer>
  );
}

// AI technician brief + repair summary card.
function AIBriefCard({ repairRequestId, jobId, jobStatus }: { repairRequestId: string; jobId: string; jobStatus: string }) {
  const [brief, setBrief] = useState<any>(null);
  const [summary, setSummary] = useState<any>(null);
  const [loadingBrief, setLoadingBrief] = useState(false);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [tab, setTab] = useState<"brief" | "summary">("brief");

  async function fetchBrief() {
    setLoadingBrief(true);
    try {
      const res = await apiFetch<{ brief: any; fellBack: boolean }>("/api/ai/technician-brief", {
        method: "POST",
        body: JSON.stringify({ repairRequestId }),
      });
      if (res.brief) setBrief(res.brief);
      else toast.info("AI brief unavailable.");
    } catch (e: any) { toast.error(e.message); }
    finally { setLoadingBrief(false); }
  }

  async function fetchSummary() {
    setLoadingSummary(true);
    try {
      const res = await apiFetch<{ summary: any; fellBack: boolean }>("/api/ai/repair-summary", {
        method: "POST",
        body: JSON.stringify({ jobId }),
      });
      if (res.summary) setSummary(res.summary);
      else toast.info("AI summary unavailable.");
    } catch (e: any) { toast.error(e.message); }
    finally { setLoadingSummary(false); }
  }

  return (
    <Card className="border-primary/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className="h-4 w-4 text-primary" /> AI assistance
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="flex gap-2">
          <Button size="sm" variant={tab === "brief" ? "default" : "outline"} onClick={() => { setTab("brief"); if (!brief) fetchBrief(); }}>
            Technician brief
          </Button>
          {jobStatus === "COMPLETED" && (
            <Button size="sm" variant={tab === "summary" ? "default" : "outline"} onClick={() => { setTab("summary"); if (!summary) fetchSummary(); }}>
              Repair summary
            </Button>
          )}
        </div>

        {tab === "brief" && (
          loadingBrief ? (
            <p className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Generating brief…</p>
          ) : brief ? (
            <div className="space-y-2">
              {brief.customerReported && <div><p className="text-xs font-semibold text-muted-foreground">Customer reported</p><p>{brief.customerReported}</p></div>}
              {brief.equipment && <div><p className="text-xs font-semibold text-muted-foreground">Equipment</p><p>{brief.equipment}{brief.brandModel ? ` — ${brief.brandModel}` : ""}</p></div>}
              {brief.symptoms?.length > 0 && <div><p className="text-xs font-semibold text-muted-foreground">Symptoms</p><ul className="list-disc pl-4">{brief.symptoms.map((s:string,i:number)=>(<li key={i}>{s}</li>))}</ul></div>}
              {brief.likelyCauses?.length > 0 && <div><p className="text-xs font-semibold text-muted-foreground">Likely causes</p><ul className="list-disc pl-4">{brief.likelyCauses.map((s:string,i:number)=>(<li key={i}>{s}</li>))}</ul></div>}
              {brief.safety && <div><p className="text-xs font-semibold text-muted-foreground">Safety</p><p>{brief.safety}</p></div>}
              {brief.confidence && <div><p className="text-xs font-semibold text-muted-foreground">Confidence</p><p className="capitalize">{brief.confidence}</p></div>}
              {brief.inspectionChecklist?.length > 0 && (
                <div className="rounded-md bg-primary/5 p-2">
                  <p className="text-xs font-semibold text-primary">Inspection checklist</p>
                  <ul className="mt-1 list-disc pl-4">{brief.inspectionChecklist.map((s:string,i:number)=>(<li key={i}>{s}</li>))}</ul>
                </div>
              )}
              <p className="text-xs text-muted-foreground italic">Generated from actual diagnostic data.</p>
            </div>
          ) : (
            <p className="text-muted-foreground">Click "Technician brief" to generate an AI summary from the diagnostic data.</p>
          )
        )}

        {tab === "summary" && jobStatus === "COMPLETED" && (
          loadingSummary ? (
            <p className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Generating summary…</p>
          ) : summary ? (
            <div className="space-y-2">
              {summary.problem && <div><p className="text-xs font-semibold text-muted-foreground">Problem</p><p>{summary.problem}</p></div>}
              {summary.likelyCause && <div><p className="text-xs font-semibold text-muted-foreground">Likely cause</p><p>{summary.likelyCause}</p></div>}
              {summary.checksCompleted?.length > 0 && <div><p className="text-xs font-semibold text-muted-foreground">Checks completed</p><ul className="list-disc pl-4">{summary.checksCompleted.map((s:string,i:number)=>(<li key={i}>{s}</li>))}</ul></div>}
              {summary.repairPerformed && <div><p className="text-xs font-semibold text-muted-foreground">Repair performed</p><p>{summary.repairPerformed}</p></div>}
              {summary.recommendation && <div><p className="text-xs font-semibold text-muted-foreground">Recommendation</p><p>{summary.recommendation}</p></div>}
              {summary.warrantyNote && <div><p className="text-xs font-semibold text-muted-foreground">Warranty</p><p>{summary.warrantyNote}</p></div>}
              <p className="text-xs text-muted-foreground italic">Generated from actual repair data.</p>
            </div>
          ) : (
            <p className="text-muted-foreground">Click "Repair summary" to generate a customer-friendly summary.</p>
          )
        )}
      </CardContent>
    </Card>
  );
}
