"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowLeft,
  BadgeCheck,
  Calendar,
  CheckCircle2,
  ClipboardList,
  CreditCard,
  MapPin,
  MessageSquare,
  Plus,
  Receipt,
  ShieldCheck,
  Timer,
  Trash2,
  Wrench,
  XCircle,
} from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TechnicianProfileDialog } from "@/features/marketplace/technician-profile-dialog";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
  EmptyState,
  ErrorState,
  LoadingState,
  PageContainer,
  PageHeader,
  FormSkeleton,
  DetailSkeleton,
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
  customer?: { id: string; phone?: string | null; user?: { name?: string | null; email?: string | null } | null } | null;
  repairRequest: RepairRequest;
  quote?: Quote | null;
  repairJob?: RepairJob | null;
  payment?: Payment | null;
};

// Booking status lifecycle, in order.
const BOOKING_STEPS = ["REQUESTED", "ACCEPTED", "QUOTE_SUBMITTED", "AWAITING_PAYMENT", "CONFIRMED", "COMPLETED"];

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

  const createMutation = useApiMutation<{ booking: Booking }>("/api/bookings", "POST", [["bookings"], ["history"]]);

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

  if (isLoading) return <FormSkeleton />;
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
            <div className="flex gap-2">
              <TechnicianProfileDialog technicianId={tech.id}>
                <Button variant="outline" size="sm" className="flex-1">
                  View profile
                </Button>
              </TechnicianProfileDialog>
              <Button 
                variant="outline" 
                size="sm" 
                className="flex-1"
                onClick={() => navigate(`messages/new?technicianId=${tech.id}`)}
                title="Message technician"
              >
                <MessageSquare className="h-4 w-4 mr-2" /> Message
              </Button>
            </div>
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
  const { data: session } = useSession();
  const role = (session as any)?.user?.role;
  const isTech = role === "TECHNICIAN" || role === "ADMIN";

  const qc = useQueryClient();
  const cached = qc.getQueryData<{ bookings: Booking[] }>(["bookings"]);
  const cachedBooking = cached?.bookings.find((b) => b.id === bookingId);
  const isActive = cachedBooking ? !["COMPLETED", "CANCELLED"].includes(cachedBooking.status) : true;

  const { refetch, ...rest } = useApi<{ bookings: Booking[] }>(
    ["bookings"],
    "/api/bookings",
    { refetchInterval: isActive ? 10_000 : false },
  );
  const data = rest.data;
  const booking = useMemo(() => data?.bookings.find((b) => b.id === bookingId), [data, bookingId]);

  const quoteDecisionMutation = useApiMutation(
    booking?.quote ? `/api/quotes/${booking.quote.id}/decision` : "/api/quotes/_/decision",
    "POST",
    [["bookings"], ["history"], ["technician-dashboard"]],
    {
      queryKey: ["bookings"],
      updater: (oldData: any, newVars: any) => {
        if (!oldData || !oldData.bookings) return oldData;
        return {
          ...oldData,
          bookings: oldData.bookings.map((b: any) => {
            if (b.id === bookingId && b.quote) {
              return { 
                ...b, 
                quote: { ...b.quote, status: newVars.action === "approve" ? "ACCEPTED" : "REJECTED" },
                status: newVars.action === "approve" ? "AWAITING_PAYMENT" : b.status 
              };
            }
            return b;
          })
        };
      }
    }
  );
  
  const acceptBookingMutation = useApiMutation(
    `/api/bookings/${bookingId}/transition`, 
    "POST",
    [["bookings"], ["history"], ["technician-dashboard"]],
    {
      queryKey: ["bookings"],
      updater: (oldData: any, newVars: any) => {
        if (!oldData || !oldData.bookings) return oldData;
        return {
          ...oldData,
          bookings: oldData.bookings.map((b: any) => {
            if (b.id === bookingId) {
              return { ...b, status: newVars.status };
            }
            return b;
          })
        };
      }
    }
  );
  
  const { route } = useRouter();

  useEffect(() => {
    const { payment_success, session_id } = route.query;
    if (payment_success === "true" && session_id) {
      // Clear the query from the URL so we don't trigger again
      const cleanHash = window.location.hash.split("?")[0];
      window.location.hash = cleanHash;

      // Simulate webhook for mock provider
      apiFetch("/api/webhooks/payment", {
        method: "POST",
        body: JSON.stringify({
          type: "checkout.session.completed",
          data: { object: { id: session_id } }
        })
      }).then(() => {
        toast.success("Mock payment confirmed!");
        refetch();
      }).catch(() => {
        toast.error("Could not confirm mock payment");
      });
    }
  }, [route.query, refetch]);

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
      const successUrl = `${window.location.origin}/#/booking/${booking.id}?payment_success=true`;
      const cancelUrl = `${window.location.origin}/#/booking/${booking.id}?payment_cancel=true`;
      
      const res = await apiFetch<{ checkoutUrl: string }>(`/api/payments/create`, {
        method: "POST",
        body: JSON.stringify({ bookingId: booking.id, successUrl, cancelUrl }),
      });
      
      if (res.checkoutUrl) {
        window.location.href = res.checkoutUrl;
        return;
      }
    } catch (e: any) {
      toast.error(e?.message ?? "Payment failed");
    } finally {
      setPaying(false);
    }
  };

  const onAcceptBooking = async () => {
    try {
      await acceptBookingMutation.mutateAsync({ status: "ACCEPTED" });
      toast.success("Request accepted! You can now create a quote.");
      await refetch();
    } catch (e: any) {
      toast.error(e?.message ?? "Could not accept request");
    }
  };

  if (rest.isLoading) return <DetailSkeleton />;
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
  const cust = booking.customer;
  const quote = booking.quote;
  const job = booking.repairJob;
  const payment = booking.payment;
  const needsQuoteDecision = !isTech && quote && quote.status === "SUBMITTED";
  const canBook = !isTech && quote && quote.status === "APPROVED" && booking.status === "REQUESTED";
  const canPay = !isTech && (booking.status === "AWAITING_PAYMENT" || booking.status === "CONFIRMED") && (!payment || payment.status === "PENDING" || payment.status === "FAILED");
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

        {isTech && booking.status === "REQUESTED" && (
          <Card className="border-primary/40">
            <CardHeader>
              <CardTitle className="text-base">Accept booking request</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">Accept this request to create and send a quote.</p>
              <Button onClick={onAcceptBooking} disabled={acceptBookingMutation.isPending} className="w-full">
                {acceptBookingMutation.isPending ? "Accepting..." : "Accept request"}
              </Button>
            </CardContent>
          </Card>
        )}

        {isTech && booking.status === "ACCEPTED" && (
          <QuoteForm
            repairRequestId={booking.repairRequest.id}
            existingQuote={quote}
            enabled={true}
            onSaved={() => refetch()}
          />
        )}

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
        {!isTech && tech && (
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
              <div className="flex gap-2">
                <TechnicianProfileDialog technicianId={tech.id}>
                  <Button variant="outline" size="sm" className="flex-1">
                    View profile
                  </Button>
                </TechnicianProfileDialog>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="flex-1"
                  onClick={() => navigate(`messages/new?technicianId=${tech.id}`)}
                  title="Message technician"
                >
                  <MessageSquare className="h-4 w-4 mr-2" /> Message
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {isTech && cust && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Customer</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-3">
                <Avatar className="h-12 w-12 border">
                  <AvatarFallback>{initials(cust.user?.name || "Customer")}</AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="flex items-center gap-1.5 font-medium">
                    {cust.user?.name || "Customer"}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">{cust.user?.email}</p>
                </div>
              </div>
              {cust.phone && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Phone</span>
                  <span className="font-medium">{cust.phone}</span>
                </div>
              )}
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="flex-1"
                  onClick={() => navigate(`messages/new?customerId=${cust.id}`)}
                  title="Message customer"
                >
                  <MessageSquare className="h-4 w-4 mr-2" /> Message
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

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
                {isTech ? "Begin now" : "Track repair"}
              </Button>
            </CardContent>
          </Card>
        )}

        <Button variant="ghost" size="sm" className="w-full" onClick={() => navigate(isTech ? "technician/jobs" : "history")}>
          <ArrowLeft className="h-4 w-4" /> {isTech ? "Back to jobs" : "Back to history"}
        </Button>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────────
// Quote Form (for Technicians)
// ────────────────────────────────────────────────────────────────────────────────

type ItemInput = { description: string; quantity: string; unitPrice: string };

export function QuoteForm({
  repairRequestId,
  existingQuote,
  onSaved,
  enabled,
}: {
  repairRequestId: string;
  existingQuote?: Quote | null;
  onSaved: () => void;
  enabled: boolean;
}) {
  const [items, setItems] = useState<ItemInput[]>(
    existingQuote?.items.length
      ? existingQuote.items.map((i) => ({
          description: i.description,
          quantity: String(i.quantity),
          unitPrice: String(i.unitPrice / 100),
        }))
      : [{ description: "", quantity: "1", unitPrice: "" }],
  );
  const [inspectionFee, setInspectionFee] = useState(
    existingQuote?.inspectionFee ? String(existingQuote.inspectionFee / 100) : "",
  );
  const [labor, setLabor] = useState(existingQuote?.labor ? String(existingQuote.labor / 100) : "");
  const [taxesFees, setTaxesFees] = useState(
    existingQuote?.taxesFees ? String(existingQuote.taxesFees / 100) : "",
  );
  const [warrantyMonths, setWarrantyMonths] = useState(
    existingQuote?.warrantyMonths ? String(existingQuote.warrantyMonths) : "",
  );
  const [estimatedDurationHours, setEstimatedDurationHours] = useState(
    existingQuote?.estimatedDurationHours ? String(existingQuote.estimatedDurationHours) : "",
  );
  const [notes, setNotes] = useState(existingQuote?.notes ?? "");
  const [submitting, setSubmitting] = useState(false);

  const mutation = useApiMutation(`/api/quotes`, "POST", [["bookings"], ["history"], ["technician-dashboard"]]);

  const addItem = () => setItems([...items, { description: "", quantity: "1", unitPrice: "" }]);
  const removeItem = (i: number) => setItems(items.filter((_, idx) => idx !== i));
  const updateItem = (i: number, field: "description" | "quantity" | "unitPrice", value: string) =>
    setItems(items.map((it, idx) => (idx === i ? { ...it, [field]: value } : it)));

  const total = useMemo(() => {
    const itemsTotal = items.reduce((s, it) => {
      const qty = parseFloat(it.quantity || "0") || 0;
      const price = Math.round((parseFloat(it.unitPrice || "0") || 0) * 100);
      return s + qty * price;
    }, 0);
    const insp = Math.round((parseFloat(inspectionFee || "0") || 0) * 100);
    const lab = Math.round((parseFloat(labor || "0") || 0) * 100);
    const tax = Math.round((parseFloat(taxesFees || "0") || 0) * 100);
    return itemsTotal + insp + lab + tax;
  }, [items, inspectionFee, labor, taxesFees]);

  const submit = async () => {
    if (!repairRequestId) {
      toast.error("Missing repair request context.");
      return;
    }
    const cleanItems = items
      .filter((it) => it.description.trim() && parseFloat(it.unitPrice || "0") > 0)
      .map((it) => ({
        description: it.description.trim(),
        quantity: parseInt(it.quantity || "1", 10) || 1,
        unitPrice: Math.round((parseFloat(it.unitPrice || "0") || 0) * 100),
      }));
    setSubmitting(true);
    try {
      await mutation.mutateAsync({
        repairRequestId,
        inspectionFee: Math.round((parseFloat(inspectionFee || "0") || 0) * 100),
        labor: Math.round((parseFloat(labor || "0") || 0) * 100),
        taxesFees: Math.round((parseFloat(taxesFees || "0") || 0) * 100),
        warrantyMonths: warrantyMonths ? parseInt(warrantyMonths, 10) : undefined,
        estimatedDurationHours: estimatedDurationHours ? parseFloat(estimatedDurationHours) : undefined,
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
    <Card className="mt-5 border-primary/30">
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-2 text-base">
          <span className="flex items-center gap-2"><ClipboardList className="h-4 w-4 text-primary" /> Create Quote</span>
          {existingQuote && <StatusBadge status={existingQuote.status} />}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-3">
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
                type="text"
                inputMode="numeric"
                placeholder="Qty"
                value={it.quantity}
                onChange={(e) => updateItem(i, "quantity", e.target.value.replace(/[^0-9]/g, ""))}
              />
              <Input
                className="col-span-7 sm:col-span-3"
                type="text"
                inputMode="decimal"
                placeholder="Unit price (ETB)"
                value={it.unitPrice}
                onChange={(e) => updateItem(i, "unitPrice", e.target.value.replace(/[^0-9.]/g, ""))}
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

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="q-insp">Inspection fee (ETB)</Label>
            <Input id="q-insp" type="text" inputMode="decimal" value={inspectionFee} onChange={(e) => setInspectionFee(e.target.value.replace(/[^0-9.]/g, ""))} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="q-labor">Labor (ETB)</Label>
            <Input id="q-labor" type="text" inputMode="decimal" value={labor} onChange={(e) => setLabor(e.target.value.replace(/[^0-9.]/g, ""))} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="q-tax">Taxes &amp; fees (ETB)</Label>
            <Input id="q-tax" type="text" inputMode="decimal" value={taxesFees} onChange={(e) => setTaxesFees(e.target.value.replace(/[^0-9.]/g, ""))} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="q-warranty">Warranty months (optional)</Label>
            <Input id="q-warranty" type="text" inputMode="numeric" value={warrantyMonths} onChange={(e) => setWarrantyMonths(e.target.value.replace(/[^0-9]/g, ""))} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="q-duration">Est. duration hours (optional)</Label>
            <Input id="q-duration" type="text" inputMode="decimal" value={estimatedDurationHours} onChange={(e) => setEstimatedDurationHours(e.target.value.replace(/[^0-9.]/g, ""))} />
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

// ────────────────────────────────────────────────────────────────────────────────
// Main export
// ────────────────────────────────────────────────────────────────────────────────

export function BookingScreen({ bookingId }: { bookingId: string }) {
  const { status, data: sessionData } = useSession();
  const router = useRouter();
  const requestId = (router.route.query.requestId as string) || undefined;

  const role = (sessionData as any)?.user?.role;
  const isTech = role === "TECHNICIAN" || role === "ADMIN";

  if (status === "loading") {
    return (
      <PageContainer>
        <FormSkeleton />
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
      <Button variant="ghost" size="sm" className="mb-3 -ml-2" onClick={() => navigate(isTech ? "technician/jobs" : "history")}>
        <ArrowLeft className="h-4 w-4" /> {isTech ? "Back to jobs" : "Back to history"}
      </Button>
      <PageHeader 
        title="Booking" 
        description={isTech ? "Manage this booking request and quote." : "Review your quote, confirm, and pay."} 
      />
      <ExistingBooking bookingId={bookingId} />
    </PageContainer>
  );
}
