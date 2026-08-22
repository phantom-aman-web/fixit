"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import {
  AlertTriangle,
  ArrowLeft,
  BadgeCheck,
  Calendar,
  CheckCircle2,
  CreditCard,
  MapPin,
  MessageSquare,
  Receipt,
  ShieldCheck,
  Timer,
  Wrench,
  XCircle,
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
  PageHeader,
} from "@/components/shared/states";
import { StatusBadge } from "@/components/shared/status-badges";
import { useApi, useApiMutation, apiFetch } from "@/hooks/use-api";
import { navigate, useRouter } from "@/store/router";
import { formatCurrency, formatDateTime } from "@/lib/format";

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
  baseCallOutFee?: number | null;
};

type QuoteItem = {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
};

type Quote = {
  id: string;
  status: string;
  inspectionFee: number;
  labor: number;
  partsTotal: number;
  taxesFees: number;
  totalEstimate: number;
  currency: string;
  notes?: string | null;
  estimatedDurationHours?: number | null;
  expiresAt?: string | null;
  warrantyMonths?: number | null;
  items: QuoteItem[];
};

type RepairRequest = {
  id: string;
  status: string;
  notes?: string | null;
  preferredDate?: string | null;
  problem?: { id: string; description: string; category?: { slug: string; name: string } | null };
  technician?: Technician | null;
  quote?: Quote | null;
  booking?: Booking | null;
};

type RepairJob = { id: string; status: string };

type Payment = {
  id: string;
  amount: number;
  status: string;
  provider: string;
  createdAt: string;
  paidAt?: string | null;
};

type Booking = {
  id: string;
  status: string;
  scheduledAt: string;
  location: string;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
  technician: Technician;
  repairRequest: RepairRequest;
  quote?: Quote | null;
  repairJob?: RepairJob | null;
  payment?: Payment | null;
};

// Booking status lifecycle, in order.
const BOOKING_STEPS = ["REQUESTED", "ACCEPTED", "SCHEDULED", "CONFIRMED", "COMPLETED"];

function stepIndex(status: string): number {
  const i = BOOKING_STEPS.indexOf(status);
  return i === -1 ? -1 : i;
}

function initials(name: string): string {
  return name.split(" ").filter(Boolean).slice(0, 2).map((s) => s[0]?.toUpperCase()).join("");
}

// ────────────────────────────────────────────────────────────────────────────────
// Booking status timeline (stepper)
// ────────────────────────────────────────────────────────────────────────────────

function BookingTimeline({ status }: { status: string }) {
  const current = stepIndex(status);
  if (status === "CANCELLED") {
    return (
      <div className="rounded-md border border-destructive/30 bg-destructive/5 p-4 text-sm">
        <p className="flex items-center gap-2 font-medium text-destructive">
          <XCircle className="h-4 w-4" /> This booking was cancelled
        </p>
      </div>
    );
  }
  return (
    <div className="flex items-center justify-between gap-1 overflow-x-auto">
      {BOOKING_STEPS.map((s, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <div key={s} className="flex flex-1 flex-col items-center gap-1 text-center">
            <div className="flex w-full items-center">
              <div className={`h-0.5 flex-1 ${i === 0 ? "opacity-0" : done || active ? "bg-primary" : "bg-border"}`} />
              <div
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                  active
                    ? "bg-primary text-primary-foreground"
                    : done
                    ? "bg-primary/20 text-primary"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {done ? <CheckCircle2 className="h-4 w-4" /> : i + 1}
              </div>
              <div className={`h-0.5 flex-1 ${i === BOOKING_STEPS.length - 1 ? "opacity-0" : done ? "bg-primary" : "bg-border"}`} />
            </div>
            <span className={`text-[10px] sm:text-xs ${active ? "font-medium text-primary" : "text-muted-foreground"}`}>
              {s.replaceAll("_", " ").toLowerCase()}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────────
// Quote summary card
// ────────────────────────────────────────────────────────────────────────────────

function QuoteSummary({ quote }: { quote: Quote }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-2 text-base">
          <span className="flex items-center gap-2"><Receipt className="h-4 w-4 text-primary" /> Quote</span>
          <StatusBadge status={quote.status} />
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {quote.items.length > 0 && (
          <div>
            <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">Parts &amp; materials</p>
            <div className="divide-y rounded-md border">
              {quote.items.map((it) => (
                <div key={it.id} className="flex items-center justify-between px-3 py-2">
                  <div className="min-w-0 pr-2">
                    <p className="truncate text-sm">{it.description}</p>
                    <p className="text-xs text-muted-foreground">x{it.quantity} · {formatCurrency(it.unitPrice)}</p>
                  </div>
                  <span className="font-medium">{formatCurrency(it.total)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        <div className="space-y-1.5">
          <Row label="Inspection fee" value={formatCurrency(quote.inspectionFee)} />
          <Row label="Labor" value={formatCurrency(quote.labor)} />
          {quote.partsTotal > 0 && <Row label="Parts total" value={formatCurrency(quote.partsTotal)} />}
          <Row label="Taxes &amp; fees" value={formatCurrency(quote.taxesFees)} />
          <Separator className="my-1" />
          <Row label="Total estimate" value={formatCurrency(quote.totalEstimate)} strong />
        </div>
        {(quote.estimatedDurationHours != null || quote.warrantyMonths != null || quote.expiresAt) && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {quote.estimatedDurationHours != null && (
              <Badge variant="secondary" className="gap-1"><Timer className="h-3 w-3" /> ~{quote.estimatedDurationHours}h</Badge>
            )}
            {quote.warrantyMonths != null && (
              <Badge variant="secondary" className="gap-1"><ShieldCheck className="h-3 w-3" /> {quote.warrantyMonths}mo warranty</Badge>
            )}
            {quote.expiresAt && (
              <Badge variant="outline" className="gap-1"><Calendar className="h-3 w-3" /> Expires {formatDateTime(quote.expiresAt)}</Badge>
            )}
          </div>
        )}
        {quote.notes && (
          <div className="rounded-md bg-muted/40 p-3 text-sm text-muted-foreground">
            <p className="mb-0.5 font-medium text-foreground">Note from technician</p>
            {quote.notes}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className={strong ? "font-medium" : "text-muted-foreground"}>{label}</span>
      <span className={strong ? "text-base font-bold text-primary" : ""}>{value}</span>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────────
// New booking form (bookingId === "new")
// ────────────────────────────────────────────────────────────────────────────────

function NewBookingForm({ requestId }: { requestId: string }) {
  const router = useRouter();
  const { data, isLoading, isError, error, refetch } = useApi<{ requests: RepairRequest[] }>(
    ["repair-requests", "for-booking", requestId],
    "/api/repair-requests",
  );

  const request = useMemo(() => data?.requests.find((r) => r.id === requestId), [data, requestId]);

  const [scheduledAt, setScheduledAt] = useState("");
  const [location, setLocation] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Prefill preferredDate from the request, if any.
  useEffect(() => {
    if (request?.preferredDate && !scheduledAt) {
      const d = new Date(request.preferredDate);
      // datetime-local format: YYYY-MM-DDTHH:mm
      const pad = (n: number) => String(n).padStart(2, "0");
      setScheduledAt(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`);
    }
  }, [request, scheduledAt]);

  const createMutation = useApiMutation<{ booking: Booking }>("/api/bookings", "POST");

  const submit = async () => {
    if (!request) return;
    if (!scheduledAt || !location.trim()) {
      toast.error("Please pick a date and enter a location.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await createMutation.mutateAsync({
        repairRequestId: request.id,
        quoteId: request.quote?.id,
        scheduledAt: new Date(scheduledAt).toISOString(),
        location: location.trim(),
        notes: notes.trim() || undefined,
      });
      toast.success("Booking created. We'll notify the technician.");
      navigate(`booking/${res.booking.id}`);
    } catch (e: any) {
      toast.error(e?.message ?? "Could not create booking");
    } finally {
      setSubmitting(false);
    }
  };

  if (isLoading) return <LoadingState label="Loading your repair request…" />;
  if (isError) {
    return <ErrorState title="Could not load repair request" detail={(error as Error)?.message} onRetry={() => refetch()} />;
  }
  if (!request) {
    return (
      <EmptyState
        icon={AlertTriangle}
        title="Repair request not found"
        description="We couldn't find the repair request to book."
        action={<Button onClick={() => navigate("history")}>Go to history</Button>}
      />
    );
  }
  if (!request.technician) {
    return (
      <EmptyState
        icon={Wrench}
        title="No technician selected"
        description="You need to select a technician before booking."
        action={<Button onClick={() => navigate(`technicians?requestId=${requestId}`)}>Find a technician</Button>}
      />
    );
  }

  const tech = request.technician;

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
      <div className="lg:col-span-2 space-y-5">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Schedule your repair</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="scheduledAt">Preferred date &amp; time</Label>
              <Input
                id="scheduledAt"
                type="datetime-local"
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="location">Service location</Label>
              <Input
                id="location"
                placeholder="e.g. Bole, Friendship Building, Apt 4B"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">Addis Ababa sub-city / landmark / apartment.</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="notes">Notes for the technician (optional)</Label>
              <Textarea
                id="notes"
                rows={3}
                placeholder="Access instructions, gate code, parking…"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
            {request.quote && (
              <div className="rounded-md border border-primary/30 bg-primary/5 p-3 text-sm">
                <p className="font-medium">Quote summary</p>
                <p className="mt-1 text-muted-foreground">
                  Total estimate: <span className="font-semibold text-foreground">{formatCurrency(request.quote.totalEstimate)}</span>
                  {request.quote.warrantyMonths ? ` · ${request.quote.warrantyMonths}mo warranty` : ""}
                </p>
              </div>
            )}
            <Button onClick={submit} disabled={submitting} className="w-full sm:w-auto">
              {submitting ? "Creating booking…" : "Confirm booking"}
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="lg:col-span-1">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Your technician</CardTitle>
          </CardHeader>
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
                <p className="text-xs text-muted-foreground">
                  ★ {tech.rating.toFixed(1)} ({tech.ratingCount})
                </p>
              </div>
            </div>
            {tech.baseCallOutFee != null && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Call-out fee</span>
                <span className="font-medium">{formatCurrency(tech.baseCallOutFee)}</span>
              </div>
            )}
            <Button variant="outline" size="sm" className="w-full" onClick={() => navigate(`technicians/${tech.id}`)}>
              View profile
            </Button>
          </CardContent>
        </Card>

        {request.problem && (
          <Card className="mt-5">
            <CardHeader>
              <CardTitle className="text-base">Problem</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {request.problem.category && (
                <Badge variant="secondary">{request.problem.category.name}</Badge>
              )}
              <p className="text-muted-foreground">{request.problem.description}</p>
              {request.notes && (
                <div className="rounded-md bg-muted/40 p-2 text-xs">
                  <p className="font-medium">Your notes</p>
                  {request.notes}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────────
// Existing booking view
// ────────────────────────────────────────────────────────────────────────────────

function ExistingBooking({ bookingId }: { bookingId: string }) {
  const { refetch, ...rest } = useApi<{ bookings: Booking[] }>(
    ["bookings"],
    "/api/bookings",
    { refetchInterval: 15_000 },
  );
  const data = rest.data;
  const booking = useMemo(() => data?.bookings.find((b) => b.id === bookingId), [data, bookingId]);

  const quoteDecisionMutation = useApiMutation(
    booking?.quote ? `/api/quotes/${booking.quote.id}/decision` : "/api/quotes/_/decision",
    "POST",
  );

  const [paying, setPaying] = useState(false);

  const onQuoteDecision = async (decision: "APPROVED" | "REJECTED") => {
    if (!booking?.quote) return;
    try {
      await quoteDecisionMutation.mutateAsync({ decision });
      toast.success(decision === "APPROVED" ? "Quote approved. You can now book the repair." : "Quote rejected.");
      await refetch();
    } catch (e: any) {
      toast.error(e?.message ?? "Could not update quote");
    }
  };

  const onPay = async () => {
    if (!booking?.quote) return;
    setPaying(true);
    try {
      // 1. Create mock payment intent.
      const intent = await apiFetch<{ payment: Payment }>(`/api/bookings/${booking.id}/payment`, {
        method: "POST",
        body: JSON.stringify({ amount: booking.quote.totalEstimate }),
      });
      // 2. Capture mock payment.
      await apiFetch<{ payment: Payment }>(`/api/payments/${intent.payment.id}/capture`, { method: "POST" });
      toast.success("Payment captured (mock). Your repair is now complete!");
      await refetch();
    } catch (e: any) {
      toast.error(e?.message ?? "Payment failed");
    } finally {
      setPaying(false);
    }
  };

  if (rest.isLoading) return <LoadingState label="Loading booking…" />;
  if (rest.isError) {
    return (
      <ErrorState
        title="Could not load booking"
        detail={(rest.error as Error)?.message}
        onRetry={() => refetch()}
      />
    );
  }
  if (!booking) {
    return (
      <EmptyState
        icon={AlertTriangle}
        title="Booking not found"
        description="This booking may have been removed or doesn't belong to you."
        action={<Button onClick={() => navigate("history")}>Go to history</Button>}
      />
    );
  }

  const tech = booking.technician;
  const quote = booking.quote;
  const job = booking.repairJob;
  const payment = booking.payment;
  const needsQuoteDecision = quote && quote.status === "SUBMITTED";
  const canBook = quote && quote.status === "APPROVED" && booking.status === "REQUESTED";
  const canPay = booking.status === "CONFIRMED" && !payment;
  const showPayButton = canPay && quote;

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
      <div className="lg:col-span-2 space-y-5">
        <Card>
          <CardHeader>
            <CardTitle className="flex flex-wrap items-center justify-between gap-2 text-base">
              <span>Booking details</span>
              <StatusBadge status={booking.status} />
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <BookingTimeline status={booking.status} />
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
                <p className="mb-0.5 flex items-center gap-1.5 font-medium"><MessageSquare className="h-3.5 w-3.5" /> Notes</p>
                <p className="text-muted-foreground">{booking.notes}</p>
              </div>
            )}
            {booking.repairRequest.problem && (
              <div className="rounded-md border p-3 text-sm">
                <p className="mb-1 text-xs text-muted-foreground">Problem</p>
                {booking.repairRequest.problem.category && (
                  <Badge variant="secondary" className="mb-1.5">{booking.repairRequest.problem.category.name}</Badge>
                )}
                <p className="text-muted-foreground">{booking.repairRequest.problem.description}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {quote && <QuoteSummary quote={quote} />}

        {needsQuoteDecision && (
          <Card className="border-primary/30">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <CheckCircle2 className="h-4 w-4 text-primary" /> Review &amp; decide on quote
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Your technician submitted a quote for {formatCurrency(quote.totalEstimate)}. Approve to continue, or reject if you'd like changes.
              </p>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button onClick={() => onQuoteDecision("APPROVED")} disabled={quoteDecisionMutation.isPending} className="flex-1">
                  Approve quote
                </Button>
                <Button onClick={() => onQuoteDecision("REJECTED")} disabled={quoteDecisionMutation.isPending} variant="outline" className="flex-1">
                  Reject
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {canBook && (
          <Card className="border-emerald-300 bg-emerald-50/50 dark:border-emerald-900 dark:bg-emerald-950/30">
            <CardContent className="flex flex-col items-start gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-medium">Quote approved</p>
                <p className="text-sm text-muted-foreground">Confirm your booking so the technician can begin.</p>
              </div>
              <Button onClick={() => navigate(`booking/new?requestId=${booking.repairRequest.id}`)}>Book this repair</Button>
            </CardContent>
          </Card>
        )}

        {showPayButton && (
          <Card className="border-primary/40">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <CreditCard className="h-4 w-4 text-primary" /> Payment
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between rounded-md bg-muted/40 p-3">
                <div>
                  <p className="text-xs text-muted-foreground">Amount due</p>
                  <p className="text-xl font-bold text-primary">{formatCurrency(quote!.totalEstimate)}</p>
                </div>
                <Badge variant="outline" className="gap-1 border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300">
                  <AlertTriangle className="h-3 w-3" /> Sandbox / mock
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                This is a demo payment. No real money will be charged. Clicking pay will simulate a successful card capture and complete your booking.
              </p>
              <Button onClick={onPay} disabled={paying} className="w-full sm:w-auto">
                {paying ? "Processing…" : <>Pay {formatCurrency(quote!.totalEstimate)} (mock)</>}
              </Button>
            </CardContent>
          </Card>
        )}

        {payment && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <CreditCard className="h-4 w-4 text-primary" /> Payment record
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <Row label="Amount" value={formatCurrency(payment.amount)} />
              <Row label="Status" value={payment.status.replaceAll("_", " ").toLowerCase()} />
              <Row label="Provider" value={payment.provider} />
              {payment.paidAt && <Row label="Paid at" value={formatDateTime(payment.paidAt)} />}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Right column: technician + actions */}
      <div className="lg:col-span-1 space-y-5">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Technician</CardTitle>
          </CardHeader>
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
            {tech.phone && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Phone</span>
                <span className="font-medium">{tech.phone}</span>
              </div>
            )}
            <Button variant="outline" size="sm" className="w-full" onClick={() => navigate(`technicians/${tech.id}`)}>
              View profile
            </Button>
          </CardContent>
        </Card>

        {job && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Repair job</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Status</span>
                <StatusBadge status={job.status} />
              </div>
              <Button onClick={() => navigate(`repair/${job.id}`)} className="w-full">
                Track repair
              </Button>
            </CardContent>
          </Card>
        )}

        <Button variant="ghost" size="sm" className="w-full" onClick={() => navigate("history")}>
          <ArrowLeft className="h-4 w-4" /> Back to history
        </Button>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────────
// Main export
// ────────────────────────────────────────────────────────────────────────────────

export function BookingScreen({ bookingId }: { bookingId: string }) {
  const { status } = useSession();
  const router = useRouter();
  const requestId = (router.route.query.requestId as string) || undefined;

  if (status === "loading") {
    return (
      <PageContainer>
        <LoadingState label="Loading…" />
      </PageContainer>
    );
  }

  // The "new" route means we are creating a new booking — requestId is required.
  if (bookingId === "new") {
    if (!requestId) {
      return (
        <PageContainer>
          <PageHeader title="New booking" />
          <EmptyState
            icon={AlertTriangle}
            title="No repair request selected"
            description="Start from a repair request or technician profile to book."
            action={<Button onClick={() => navigate("history")}>Go to history</Button>}
          />
        </PageContainer>
      );
    }
    return (
      <PageContainer>
        <Button variant="ghost" size="sm" className="mb-3 -ml-2" onClick={() => navigate(`technicians?requestId=${requestId}`)}>
          <ArrowLeft className="h-4 w-4" /> Back to technicians
        </Button>
        <PageHeader title="Book your repair" description="Pick a time, share your location, and we'll dispatch your technician." />
        <NewBookingForm requestId={requestId} />
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <Button variant="ghost" size="sm" className="mb-3 -ml-2" onClick={() => navigate("history")}>
        <ArrowLeft className="h-4 w-4" /> Back to history
      </Button>
      <PageHeader title="Booking" description="Review your quote, confirm, and pay." />
      <ExistingBooking bookingId={bookingId} />
    </PageContainer>
  );
}
