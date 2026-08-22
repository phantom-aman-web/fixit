"use client";

import { useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import {
  ArrowRight,
  BadgeCheck,
  CalendarClock,
  ChevronRight,
  ClipboardList,
  Plus,
  ShieldCheck,
  Wrench,
} from "lucide-react";

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
import { formatDate } from "@/lib/format";

// ────────────────────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────────────────────

type Technician = {
  id: string;
  displayName: string;
  verified: boolean;
};

type RepairRequest = {
  id: string;
  problem?: { description: string; category?: { name: string } | null } | null;
};

type Booking = {
  id: string;
  technician: Technician;
  repairRequest?: RepairRequest | null;
};

type Job = {
  id: string;
  booking: Booking;
};

type Warranty = {
  id: string;
  startDate: string;
  endDate: string;
  durationMonths: number;
  coveredWork: string;
  status: string;
  job: Job;
};

type WarrantyClaim = {
  id: string;
  warrantyId: string;
  customerId: string;
  description: string;
  status: "OPEN" | "APPROVED" | "REJECTED" | "RESOLVED";
  resolution?: string | null;
  createdAt: string;
  updatedAt: string;
  warranty: Warranty;
};

// ────────────────────────────────────────────────────────────────────────────────
// File claim dialog
// ────────────────────────────────────────────────────────────────────────────────

function FileClaimDialog({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [warrantyId, setWarrantyId] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const { data, isLoading } = useApi<{ warranties: Warranty[] }>(
    ["warranties", "for-claims"],
    open ? "/api/warranties" : null,
    { enabled: open },
  );

  const activeWarranties = useMemo(() => {
    const now = new Date();
    return (data?.warranties ?? []).filter(
      (w) => w.status === "ACTIVE" && new Date(w.endDate) >= now,
    );
  }, [data]);

  const reset = () => {
    setWarrantyId("");
    setDescription("");
  };

  const submit = async () => {
    if (!warrantyId) {
      toast.error("Please pick an active warranty.");
      return;
    }
    if (description.trim().length < 10) {
      toast.error("Please describe the issue (at least 10 characters).");
      return;
    }
    setSubmitting(true);
    try {
      await apiFetch("/api/warranty-claims", {
        method: "POST",
        body: JSON.stringify({ warrantyId, description: description.trim() }),
      });
      toast.success("Warranty claim filed. We'll be in touch.");
      setOpen(false);
      reset();
      onCreated();
    } catch (e: any) {
      toast.error(e?.message ?? "Could not file claim");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Button onClick={() => setOpen(true)} size="sm">
        <Plus className="h-4 w-4" aria-hidden />
        File a claim
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
              <ShieldCheck className="h-5 w-5 text-emerald-600" aria-hidden />
              File a warranty claim
            </DialogTitle>
            <DialogDescription>
              Pick the warranty that covers the issue and describe what&apos;s wrong.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="claim-warranty">Active warranty</Label>
              <Select value={warrantyId} onValueChange={setWarrantyId}>
                <SelectTrigger id="claim-warranty" className="w-full">
                  <SelectValue
                    placeholder={isLoading ? "Loading warranties…" : "Pick a warranty"}
                  />
                </SelectTrigger>
                <SelectContent>
                  {activeWarranties.length === 0 && !isLoading ? (
                    <SelectItem value="__none" disabled>
                      No active warranties available
                    </SelectItem>
                  ) : (
                    activeWarranties.map((w) => (
                      <SelectItem key={w.id} value={w.id}>
                        {w.job.booking.repairRequest?.problem?.category?.name ?? "Repair"} ·
                        ends {formatDate(w.endDate)}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="claim-desc">What&apos;s wrong?</Label>
              <Textarea
                id="claim-desc"
                rows={5}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe the issue, when it started, and how it relates to the original repair…"
              />
              <p className="text-xs text-muted-foreground">{description.length}/2000</p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={submit} disabled={submitting}>
              {submitting ? "Filing…" : "File claim"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ────────────────────────────────────────────────────────────────────────────────
// Claim card
// ────────────────────────────────────────────────────────────────────────────────

function ClaimCard({ claim }: { claim: WarrantyClaim }) {
  const w = claim.warranty;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-start justify-between gap-2 text-base">
          <div className="flex items-center gap-2">
            <ShieldCheck
              className={`h-4 w-4 ${
                w.status === "ACTIVE" ? "text-emerald-600" : "text-muted-foreground"
              }`}
              aria-hidden
            />
            <div>
              <p className="font-semibold leading-tight">
                {w.job.booking.repairRequest?.problem?.category?.name ?? "Repair"} warranty
              </p>
              <p className="text-xs font-normal text-muted-foreground">
                Filed {formatDate(claim.createdAt)}
              </p>
            </div>
          </div>
          <StatusBadge status={claim.status} />
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="rounded-md bg-muted/40 p-3">
          <p className="text-xs font-medium text-muted-foreground">Your claim</p>
          <p className="mt-1 whitespace-pre-wrap break-words">{claim.description}</p>
        </div>

        <div className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-3">
          <div>
            <p className="text-muted-foreground">Warranty period</p>
            <p className="font-medium">
              {formatDate(w.startDate)} → {formatDate(w.endDate)}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">Duration</p>
            <p className="font-medium">{w.durationMonths} months</p>
          </div>
          <div>
            <p className="text-muted-foreground">Warranty status</p>
            <StatusBadge status={w.status} />
          </div>
        </div>

        <div>
          <p className="text-xs text-muted-foreground">Covered work</p>
          <p className="mt-0.5">{w.coveredWork}</p>
        </div>

        <div className="flex items-start gap-2 rounded-md border border-border p-2.5 text-xs">
          <Wrench className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" aria-hidden />
          <div className="min-w-0">
            <p className="font-medium">
              {w.job.booking.technician.displayName}
              {w.job.booking.technician.verified && (
                <BadgeCheck className="ml-1 inline h-3.5 w-3.5 text-emerald-600" aria-hidden />
              )}
            </p>
            <p className="truncate text-muted-foreground">
              Original job #{w.job.id.slice(-6)}
            </p>
          </div>
        </div>

        {claim.resolution && (
          <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 dark:border-emerald-900 dark:bg-emerald-950/40">
            <p className="text-xs font-medium text-emerald-700 dark:text-emerald-300">
              Resolution
            </p>
            <p className="mt-1 whitespace-pre-wrap break-words text-emerald-900 dark:text-emerald-200">
              {claim.resolution}
            </p>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => navigate(`repair/${w.job.id}`)}
          >
            View original repair
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Button>
          {w.status === "ACTIVE" && (
            <Button size="sm" variant="ghost" onClick={() => navigate("warranties")}>
              View warranty
              <ChevronRight className="h-4 w-4" aria-hidden />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ────────────────────────────────────────────────────────────────────────────────
// Main
// ────────────────────────────────────────────────────────────────────────────────

export function WarrantyClaimsScreen() {
  const { status } = useSession();
  const { data, isLoading, isError, error, refetch } = useApi<{ claims: WarrantyClaim[] }>(
    ["warranty-claims"],
    "/api/warranty-claims",
    { enabled: status === "authenticated" },
  );

  if (status === "loading" || isLoading) {
    return (
      <PageContainer>
        <PageHeader title="Warranty claims" />
        <LoadingState label="Loading claims…" />
      </PageContainer>
    );
  }

  if (isError) {
    return (
      <PageContainer>
        <PageHeader title="Warranty claims" />
        <ErrorState
          title="Could not load claims"
          detail={(error as Error)?.message}
          onRetry={() => refetch()}
        />
      </PageContainer>
    );
  }

  const claims = data?.claims ?? [];
  const open = claims.filter((c) => c.status === "OPEN");
  const closed = claims.filter((c) => c.status !== "OPEN");

  return (
    <PageContainer>
      <PageHeader
        title="Warranty claims"
        description="Claims filed against your active repair warranties."
        actions={<FileClaimDialog onCreated={() => refetch()} />}
      />

      {claims.length === 0 ? (
        <EmptyState
          icon={ShieldCheck}
          title="No warranty claims"
          description="If a covered repair isn't holding up, file a claim against an active warranty."
          action={
            <Button variant="outline" onClick={() => navigate("warranties")}>
              <ClipboardList className="h-4 w-4" aria-hidden />
              View your warranties
            </Button>
          }
        />
      ) : (
        <div className="space-y-6">
          {open.length > 0 && (
            <section>
              <h2 className="mb-3 flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <CalendarClock className="h-4 w-4" aria-hidden />
                Open claims
                <Badge variant="secondary" className="text-xs">
                  {open.length}
                </Badge>
              </h2>
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                {open.map((c) => (
                  <ClaimCard key={c.id} claim={c} />
                ))}
              </div>
            </section>
          )}

          {closed.length > 0 && (
            <section>
              <h2 className="mb-3 flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <ClipboardList className="h-4 w-4" aria-hidden />
                Resolved claims
                <Badge variant="secondary" className="text-xs">
                  {closed.length}
                </Badge>
              </h2>
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                {closed.map((c) => (
                  <ClaimCard key={c.id} claim={c} />
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      <div className="mt-8 rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
        <p className="flex items-center gap-2 font-medium text-foreground">
          <ShieldCheck className="h-4 w-4 text-primary" aria-hidden /> About warranty coverage
        </p>
        <p className="mt-1">
          Each completed repair may include a warranty defining its duration and the work
          covered. Claims are reviewed by the technician and FixIt admins; resolution may
          include a free follow-up visit or partial refund at the technician&apos;s discretion.
        </p>
      </div>
    </PageContainer>
  );
}

export default WarrantyClaimsScreen;
