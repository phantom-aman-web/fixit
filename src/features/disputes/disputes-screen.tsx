"use client";

import { useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { toast } from "sonner";
import {
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  ChevronDown,
  ChevronUp,
  ClipboardList,
  MessageSquare,
  Plus,
  Send,
  ShieldAlert,
  User,
  Wrench,
} from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  EmptyState,
  ErrorState,
  LoadingState,
  PageContainer,
  PageHeader,
} from "@/components/shared/states";
import { StatusBadge } from "@/components/shared/status-badges";
import { apiFetch, useApi } from "@/hooks/use-api";
import { navigate } from "@/store/router";
import { formatDateTime, timeAgo } from "@/lib/format";

// ────────────────────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────────────────────

type Technician = {
  id: string;
  displayName: string;
  verified: boolean;
};

type Customer = {
  id: string;
  user?: { id: string; name?: string | null; email?: string | null } | null;
};

type Booking = {
  id: string;
  technician: Technician;
  customer?: Customer | null;
};

type Job = {
  id: string;
  status: string;
  booking: Booking;
};

type Problem = {
  id: string;
  description: string;
  category?: { slug: string; name: string } | null;
};

type RepairRequest = {
  id: string;
  status: string;
  notes?: string | null;
  problem: Problem;
  booking?: { repairJob?: { id: string; status: string } | null } | null;
};

type DisputeMessage = {
  id: string;
  authorId: string;
  authorRole: "customer" | "technician" | "admin";
  message: string;
  createdAt: string;
};

type Dispute = {
  id: string;
  jobId: string;
  reason: "repair_quality" | "unexpected_charge" | "incomplete_work" | "other";
  description: string;
  status: "OPEN" | "UNDER_REVIEW" | "RESOLVED" | "REJECTED";
  resolution?: string | null;
  refundAmount?: number | null;
  createdAt: string;
  updatedAt: string;
  job: Job;
  messages: DisputeMessage[];
};

const REASON_LABEL: Record<string, string> = {
  repair_quality: "Repair quality",
  unexpected_charge: "Unexpected charge",
  incomplete_work: "Incomplete work",
  other: "Other",
};

// ────────────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────────────

function authorLabel(role: string): string {
  if (role === "customer") return "Customer";
  if (role === "technician") return "Technician";
  return "Admin";
}

function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase())
    .join("");
}

// ────────────────────────────────────────────────────────────────────────────────
// Open dispute dialog
// ────────────────────────────────────────────────────────────────────────────────

function OpenDisputeDialog({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [jobId, setJobId] = useState("");
  const [reason, setReason] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Fetch customer's completed jobs (via repair-requests list).
  const { data, isLoading } = useApi<{ requests: RepairRequest[] }>(
    ["repair-requests", "for-dispute"],
    open ? "/api/repair-requests" : null,
    { enabled: open },
  );

  const completedJobs = useMemo(() => {
    const list = data?.requests ?? [];
    const out: { jobId: string; label: string }[] = [];
    for (const r of list) {
      const job = r.booking?.repairJob;
      if (job && job.status === "COMPLETED") {
        out.push({
          jobId: job.id,
          label: `${r.problem.category?.name ?? "Repair"} · ${r.problem.description.slice(0, 50)}`,
        });
      }
    }
    return out;
  }, [data]);

  const reset = () => {
    setJobId("");
    setReason("");
    setDescription("");
  };

  const submit = async () => {
    if (!jobId) {
      toast.error("Please pick a completed job.");
      return;
    }
    if (!reason) {
      toast.error("Please pick a reason.");
      return;
    }
    if (description.trim().length < 10) {
      toast.error("Please describe the issue (at least 10 characters).");
      return;
    }
    setSubmitting(true);
    try {
      await apiFetch("/api/disputes", {
        method: "POST",
        body: JSON.stringify({ jobId, reason, description: description.trim() }),
      });
      toast.success("Dispute opened. We'll notify the technician.");
      setOpen(false);
      reset();
      onCreated();
    } catch (e: any) {
      toast.error(e?.message ?? "Could not open dispute");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Button
        onClick={() => setOpen(true)}
        size="sm"
      >
        <Plus className="h-4 w-4" aria-hidden />
        Open a dispute
      </Button>
      <Dialog
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (!o) reset();
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-amber-600" aria-hidden />
              Open a dispute
            </DialogTitle>
            <DialogDescription>
              Disputes are visible to the technician and FixIt admins. Please describe the issue factually.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="dispute-job">Completed job</Label>
              <Select value={jobId} onValueChange={setJobId}>
                <SelectTrigger id="dispute-job" className="w-full">
                  <SelectValue placeholder={isLoading ? "Loading your jobs…" : "Pick a completed job"} />
                </SelectTrigger>
                <SelectContent>
                  {completedJobs.length === 0 && !isLoading ? (
                    <SelectItem value="__none" disabled>
                      No completed jobs to dispute
                    </SelectItem>
                  ) : (
                    completedJobs.map((j) => (
                      <SelectItem key={j.jobId} value={j.jobId}>
                        {j.label}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="dispute-reason">Reason</Label>
              <Select value={reason} onValueChange={setReason}>
                <SelectTrigger id="dispute-reason" className="w-full">
                  <SelectValue placeholder="Pick a reason" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(REASON_LABEL).map(([k, v]) => (
                    <SelectItem key={k} value={k}>
                      {v}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="dispute-desc">Description</Label>
              <Textarea
                id="dispute-desc"
                rows={5}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Explain what went wrong, when you noticed it, and what outcome you'd like…"
              />
              <p className="text-xs text-muted-foreground">{description.length}/2000</p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={submit} disabled={submitting}>
              {submitting ? "Opening…" : "Open dispute"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ────────────────────────────────────────────────────────────────────────────────
// Message thread
// ────────────────────────────────────────────────────────────────────────────────

function DisputeThread({ dispute }: { dispute: Dispute }) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);

  const send = async () => {
    if (!text.trim()) return;
    setSending(true);
    try {
      await apiFetch(`/api/disputes/${dispute.id}/messages`, {
        method: "POST",
        body: JSON.stringify({ message: text.trim() }),
      });
      setText("");
      toast.success("Message sent");
    } catch (e: any) {
      toast.error(e?.message ?? "Could not send message");
    } finally {
      setSending(false);
    }
  };

  const ordered = [...dispute.messages].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );

  return (
    <div className="mt-3 space-y-3 border-t border-border pt-3">
      <div className="flex items-center gap-2 text-sm font-medium">
        <MessageSquare className="h-4 w-4 text-muted-foreground" aria-hidden />
        Conversation
        <Badge variant="secondary" className="ml-1 text-xs">
          {ordered.length}
        </Badge>
      </div>
      <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
        {ordered.length === 0 ? (
          <p className="rounded-md border border-dashed border-border p-3 text-center text-sm text-muted-foreground">
            No messages yet. Start the conversation below.
          </p>
        ) : (
          ordered.map((m) => (
            <div key={m.id} className="flex gap-2">
              <Avatar className="h-8 w-8 border">
                <AvatarFallback className="text-[10px]">
                  {authorLabel(m.authorRole).slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1 rounded-lg border border-border bg-muted/30 p-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium capitalize">{authorLabel(m.authorRole)}</span>
                  <span className="text-[10px] text-muted-foreground">{timeAgo(m.createdAt)}</span>
                </div>
                <p className="mt-1 whitespace-pre-wrap break-words text-sm">{m.message}</p>
              </div>
            </div>
          ))
        )}
      </div>
      <div className="flex gap-2">
        <Textarea
          rows={2}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Type a reply…"
          className="min-h-[44px]"
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              send();
            }
          }}
        />
        <Button
          size="icon"
          onClick={send}
          disabled={sending || !text.trim()}
          aria-label="Send message"
          className="h-auto"
        >
          <Send className="h-4 w-4" aria-hidden />
        </Button>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────────
// Dispute card (expandable)
// ────────────────────────────────────────────────────────────────────────────────

function DisputeCard({
  dispute,
  isTechnicianView,
}: {
  dispute: Dispute;
  isTechnicianView: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const counterparty = isTechnicianView
    ? dispute.job.booking.customer?.user?.name ?? "Customer"
    : dispute.job.booking.technician.displayName;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-start justify-between gap-2 text-base">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-600" aria-hidden />
            <div>
              <p className="font-semibold leading-tight">
                {REASON_LABEL[dispute.reason] ?? dispute.reason}
              </p>
              <p className="text-xs font-normal text-muted-foreground">
                {isTechnicianView ? "Customer" : "Technician"}: {counterparty}
              </p>
            </div>
          </div>
          <StatusBadge status={dispute.status} />
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <CalendarClock className="h-3.5 w-3.5" aria-hidden />
            Opened {formatDateTime(dispute.createdAt)}
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Wrench className="h-3.5 w-3.5" aria-hidden />
            Job #{dispute.jobId.slice(-6)}
          </div>
        </div>

        <div className="rounded-md bg-muted/40 p-3">
          <p className="text-xs font-medium text-muted-foreground">Description</p>
          <p className="mt-1 whitespace-pre-wrap break-words">{dispute.description}</p>
        </div>

        {dispute.resolution && (
          <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 dark:border-emerald-900 dark:bg-emerald-950/40">
            <p className="text-xs font-medium text-emerald-700 dark:text-emerald-300">Resolution</p>
            <p className="mt-1 whitespace-pre-wrap break-words text-emerald-900 dark:text-emerald-200">
              {dispute.resolution}
            </p>
            {dispute.refundAmount != null && dispute.refundAmount > 0 && (
              <p className="mt-1 text-xs font-medium text-emerald-700 dark:text-emerald-300">
                Refund issued.
              </p>
            )}
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => navigate(`repair/${dispute.jobId}`)}
          >
            View job
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
          >
            {expanded ? (
              <>
                Hide conversation <ChevronUp className="h-4 w-4" aria-hidden />
              </>
            ) : (
              <>
                {dispute.messages.length > 0
                  ? `Show conversation (${dispute.messages.length})`
                  : "Reply"}
                <ChevronDown className="h-4 w-4" aria-hidden />
              </>
            )}
          </Button>
        </div>

        {expanded && <DisputeThread dispute={dispute} />}
      </CardContent>
    </Card>
  );
}

// ────────────────────────────────────────────────────────────────────────────────
// Main
// ────────────────────────────────────────────────────────────────────────────────

export function DisputesScreen() {
  const { data: session, status } = useSession();
  const role = session?.user?.role;
  const isTechnicianView = role === "TECHNICIAN";

  const { data, isLoading, isError, error, refetch } = useApi<{ disputes: Dispute[] }>(
    ["disputes"],
    "/api/disputes",
    { enabled: status === "authenticated" },
  );

  if (status === "loading" || isLoading) {
    return (
      <PageContainer>
        <PageHeader title="Disputes" />
        <LoadingState label="Loading disputes…" />
      </PageContainer>
    );
  }

  if (isError) {
    return (
      <PageContainer>
        <PageHeader title="Disputes" />
        <ErrorState
          title="Could not load disputes"
          detail={(error as Error)?.message}
          onRetry={() => refetch()}
        />
      </PageContainer>
    );
  }

  const disputes = data?.disputes ?? [];

  const headerDesc =
    role === "ADMIN"
      ? "All disputes raised by customers on completed jobs."
      : isTechnicianView
      ? "Disputes opened against your repair jobs. Reply to keep the conversation on record."
      : "Track and resolve disputes on your completed repairs.";

  return (
    <PageContainer>
      <PageHeader
        title={role === "ADMIN" ? "All disputes" : "Disputes"}
        description={headerDesc}
        actions={
          role === "CUSTOMER" ? <OpenDisputeDialog onCreated={() => refetch()} /> : undefined
        }
      />

      {disputes.length === 0 ? (
        <EmptyState
          icon={ShieldAlert}
          title="No disputes. We hope it stays that way."
          description={
            role === "CUSTOMER"
              ? "If something goes wrong with a completed repair, you can open a dispute here."
              : "When a dispute is opened, it will appear here for you to review and reply."
          }
          action={
            role === "CUSTOMER" ? (
              <Button variant="outline" onClick={() => navigate("history")}>
                <ClipboardList className="h-4 w-4" aria-hidden />
                View repair history
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {disputes.map((d) => (
            <DisputeCard key={d.id} dispute={d} isTechnicianView={isTechnicianView} />
          ))}
        </div>
      )}

      <div className="mt-8 rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
        <p className="flex items-center gap-2 font-medium text-foreground">
          <User className="h-4 w-4 text-primary" aria-hidden /> How disputes work
        </p>
        <p className="mt-1">
          A dispute opens a moderated thread between you, the technician, and FixIt admins.
          Keep messages factual — they become part of the resolution record. Refunds, if any, are issued by an admin.
        </p>
        <p className="mt-2">
          Need to leave the platform?{" "}
          <Link href="/api/auth/signout" className="font-medium text-primary hover:underline">
            Sign out
          </Link>
          .
        </p>
      </div>
    </PageContainer>
  );
}

export default DisputesScreen;
