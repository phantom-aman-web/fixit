"use client";

import { useEffect, useMemo } from "react";
import { useSession } from "next-auth/react";
import {
  Stethoscope,
  Search,
  Plus,
  Wrench,
  ArrowRight,
  ShieldCheck,
  Clock,
  History,
  CalendarClock,
  CreditCard,
  ClipboardList,
  FileText,
  ChevronRight,
  AlertCircle,
  Cpu,
} from "lucide-react";

import {
  PageContainer,
  PageHeader,
  LoadingState,
  ErrorState,
  EmptyState,
  DashboardSkeleton,
} from "@/components/shared/states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { StatusBadge } from "@/components/shared/status-badges";
import { useApi } from "@/hooks/use-api";
import { navigate } from "@/store/router";
import { formatCurrency, formatDateTime, formatDate, timeAgo } from "@/lib/format";

// ────────────────────────────────────────────────────────────────────────────────
// Types — shape returned by GET /api/customer/dashboard
// ────────────────────────────────────────────────────────────────────────────────

type Category = { id: string; slug: string; name: string };
type Problem = { id: string; description: string; category?: Category | null };
type Technician = { id: string; displayName: string; verified: boolean } | null;

type RepairJob = { id: string; status: string } | null;
type Appointment = { id: string; scheduledAt: string; endsAt?: string | null; status: string } | null;

type ActiveBooking = {
  id: string;
  status: string;
  scheduledAt: string;
  location: string;
  technician: Technician;
  repairRequest: { id: string; problem: Problem };
  repairJob: RepairJob;
  appointment: Appointment;
};

type PendingQuote = {
  id: string;
  totalEstimate: number;
  currency: string;
  status: string;
  createdAt: string;
  repairRequest: { id: string; problem: Problem };
  technician: Technician;
};

type PendingPayment = {
  id: string;
  amount: number;
  currency: string;
  status: string;
  booking: {
    id: string;
    technician: Technician;
    repairRequest: { id: string; problem: Problem };
  };
};

type ActiveWarranty = {
  id: string;
  endDate: string;
  status: string;
  coveredWork: string;
  job: {
    id: string;
    booking: {
      id: string;
      technician: Technician;
    };
  };
};

type RecentEquipment = {
  id: string;
  nickname?: string | null;
  brand?: string | null;
  model?: string | null;
  category: Category;
};

type RecentSession = {
  id: string;
  status: string;
  startedAt: string;
  categoryId?: string;
  category?: Category;
  problem?: { id: string; description: string } | null;
};

type DashboardData = {
  dashboard: {
    activeBookings: ActiveBooking[];
    pendingQuotes: PendingQuote[];
    pendingPayments: PendingPayment[];
    activeWarranties: ActiveWarranty[];
    recentEquipment: RecentEquipment[];
    recentSessions: RecentSession[];
    counts: {
      activeBookings: number;
      pendingQuotes: number;
      pendingPayments: number;
      activeWarranties: number;
    };
  };
};

// Job lifecycle (subset relevant to mini status timeline).
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

function JobMiniTimeline({ status }: { status: string }) {
  const current = JOB_STEPS.indexOf(status);
  if (status === "CANCELLED") {
    return (
      <p className="text-xs font-medium text-destructive">Cancelled</p>
    );
  }
  if (current < 0) {
    return <StatusBadge status={status} />;
  }
  return (
    <div className="flex items-center gap-1 overflow-x-auto pb-0.5" aria-label={`Job status: ${status}`}>
      {JOB_STEPS.map((s, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <div
            key={s}
            className={`h-1.5 w-6 shrink-0 rounded-full ${
              active ? "bg-primary" : done ? "bg-primary/40" : "bg-muted"
            }`}
            title={s.replaceAll("_", " ").toLowerCase()}
          />
        );
      })}
    </div>
  );
}

export function DashboardScreen() {
  const { data: session, status } = useSession();

  // Role-aware redirect: technicians and admins go to their workspaces.
  useEffect(() => {
    if (status !== "authenticated") return;
    const role = (session?.user as any)?.role;
    if (role === "TECHNICIAN") navigate("technician");
    else if (role === "ADMIN") navigate("admin");
  }, [status, session]);

  if (status === "loading") {
    return (
      <PageContainer>
        <DashboardSkeleton />
      </PageContainer>
    );
  }

  if (status !== "authenticated") {
    return (
      <PageContainer>
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Wrench className="h-6 w-6" aria-hidden />
            </div>
            <div>
              <h2 className="text-lg font-semibold">Sign in to view your dashboard</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Track equipment, diagnoses, repair requests, and warranties in
                one place.
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button onClick={() => navigate("auth/signin")}>Sign in</Button>
              <Button
                variant="outline"
                onClick={() => navigate("auth/signup")}
              >
                Create account
              </Button>
            </div>
          </CardContent>
        </Card>
      </PageContainer>
    );
  }

  const role = (session?.user as any)?.role;
  if (role !== "CUSTOMER") {
    // Brief redirect card in case the effect hasn't run.
    return (
      <PageContainer>
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <p className="text-sm text-muted-foreground">
              Redirecting to your workspace…
            </p>
            <Button onClick={() => navigate(role === "ADMIN" ? "admin" : "technician")}>
              Open workspace
            </Button>
          </CardContent>
        </Card>
      </PageContainer>
    );
  }

  return <CustomerDashboard name={session.user?.name || session.user?.email || ""} />;
}

function CustomerDashboard({ name }: { name: string }) {
  const { data, isLoading, error, refetch } = useApi<DashboardData>(
    ["customer-dashboard"],
    "/api/customer/dashboard"
  );

  const dash = data?.dashboard;

  // Cross-reference: build a repairRequestId → bookingId map from activeBookings
  // so the pending-quotes card can deep-link to booking/[bookingId] (the booking
  // screen matches by booking.id, not by repairRequestId).
  const bookingIdByRequestId = useMemo(() => {
    const map = new Map<string, string>();
    for (const b of dash?.activeBookings ?? []) {
      if (b.repairRequest?.id) map.set(b.repairRequest.id, b.id);
    }
    return map;
  }, [dash]);

  const activeRepairs = useMemo(() => {
    return (dash?.activeBookings ?? []).filter(
      (b) =>
        b.repairJob &&
        b.repairJob.status !== "COMPLETED" &&
        b.repairJob.status !== "CANCELLED",
    );
  }, [dash]);

  const upcomingAppointments = useMemo(() => {
    return (dash?.activeBookings ?? []).filter((b) => !b.repairJob);
  }, [dash]);

  return (
    <PageContainer>
      <PageHeader
        title={`Welcome, ${name.split(" ")[0]}`}
        description="Here's what needs your attention right now."
        actions={
          <Button variant="outline" onClick={() => navigate("history")}>
            <History className="h-4 w-4" aria-hidden />
            History
          </Button>
        }
      />

      {isLoading ? (
        <DashboardSkeleton />
      ) : error ? (
        <ErrorState
          title="Could not load your dashboard"
          detail={error.message}
          onRetry={() => refetch()}
        />
      ) : !dash ? null : (
        <>
          {/* Count badges */}
          <section
            className="grid grid-cols-2 gap-2 sm:grid-cols-4"
            aria-label="Summary counts"
          >
            <CountBadge
              icon={Wrench}
              label="Active repairs"
              count={activeRepairs.length}
              tone="primary"
            />
            <CountBadge
              icon={CalendarClock}
              label="Appointments"
              count={upcomingAppointments.length}
              tone="sky"
            />
            <CountBadge
              icon={FileText}
              label="Pending quotes"
              count={dash.counts.pendingQuotes}
              tone="amber"
            />
            <CountBadge
              icon={CreditCard}
              label="Payments due"
              count={dash.counts.pendingPayments}
              tone="destructive"
            />
          </section>

          {/* Prioritized "needs attention" stack */}
          <div className="mt-6 space-y-4">
            {/* Active repairs */}
            <AttentionSection
              icon={Wrench}
              title="Active repairs"
              empty={
                <EmptyState
                  icon={Wrench}
                  title="No active repairs"
                  description="When you book a technician, your repair will appear here with live status tracking."
                />
              }
            >
              {activeRepairs.map((b) => (
                <ActiveRepairCard key={b.id} booking={b} />
              ))}
            </AttentionSection>

            {/* Upcoming appointments */}
            <AttentionSection
              icon={CalendarClock}
              title="Upcoming appointments"
              empty={
                <EmptyState
                  icon={CalendarClock}
                  title="No appointments scheduled"
                  description="After a technician accepts your request, you'll see the scheduled time here."
                />
              }
            >
              {upcomingAppointments.map((b) => (
                <AppointmentCard key={b.id} booking={b} />
              ))}
            </AttentionSection>

            {/* Pending quotes */}
            <AttentionSection
              icon={FileText}
              title="Pending quotes"
              empty={
                <EmptyState
                  icon={FileText}
                  title="No pending quotes"
                  description="When a technician submits a quote, you'll review and approve it here."
                />
              }
            >
              {dash.pendingQuotes.map((q) => (
                <PendingQuoteCard
                  key={q.id}
                  quote={q}
                  bookingId={bookingIdByRequestId.get(q.repairRequest.id)}
                />
              ))}
            </AttentionSection>

            {/* Payment required */}
            <AttentionSection
              icon={CreditCard}
              title="Payment required"
              empty={
                <EmptyState
                  icon={CreditCard}
                  title="No payments due"
                  description="Once a quote is approved and a booking confirmed, payment will appear here."
                />
              }
            >
              {dash.pendingPayments.map((p) => (
                <PaymentCard key={p.id} payment={p} />
              ))}
            </AttentionSection>

            {/* Active warranties */}
            <AttentionSection
              icon={ShieldCheck}
              title="Active warranties"
              empty={
                <EmptyState
                  icon={ShieldCheck}
                  title="No active warranties"
                  description="Completed repairs with a warranty will appear here."
                />
              }
            >
              {dash.activeWarranties.map((w) => (
                <WarrantyCard key={w.id} warranty={w} />
              ))}
            </AttentionSection>

            {/* Recent equipment */}
            <AttentionSection
              icon={Cpu}
              title="Your equipment"
              empty={
                <EmptyState
                  icon={Cpu}
                  title="No equipment added yet"
                  description="Register your appliances to get faster, more accurate diagnoses."
                  action={
                    <Button size="sm" onClick={() => navigate("equipment")}>
                      <Plus className="h-4 w-4" aria-hidden />
                      Add equipment
                    </Button>
                  }
                />
              }
            >
              {dash.recentEquipment.map((eq) => (
                <EquipmentCard key={eq.id} equipment={eq} />
              ))}
            </AttentionSection>

            {/* In-progress diagnostic sessions */}
            <AttentionSection
              icon={Stethoscope}
              title="In-progress diagnoses"
              empty={
                <EmptyState
                  icon={Stethoscope}
                  title="No active diagnoses"
                  description="Walk through symptoms to identify the issue before booking a technician."
                  action={
                    <Button size="sm" onClick={() => navigate("diagnose")}>
                      <Stethoscope className="h-4 w-4" aria-hidden />
                      Diagnose a problem
                    </Button>
                  }
                />
              }
            >
              {dash.recentSessions.map((s) => (
                <SessionCard key={s.id} session={s} />
              ))}
            </AttentionSection>
          </div>

          {/* Quick actions footer */}
          <section
            className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
            aria-label="Quick actions"
          >
            <QuickAction
              icon={Stethoscope}
              label="Diagnose a problem"
              description="Walk through the symptoms"
              onClick={() => navigate("diagnose")}
            />
            <QuickAction
              icon={Search}
              label="Find a technician"
              description="Browse verified pros"
              onClick={() => navigate("technicians")}
            />
            <QuickAction
              icon={Plus}
              label="Add equipment"
              description="Register an appliance"
              onClick={() => navigate("equipment")}
            />
            <QuickAction
              icon={History}
              label="View history"
              description="Past bookings & repairs"
              onClick={() => navigate("history")}
            />
          </section>
        </>
      )}
    </PageContainer>
  );
}

// ────────────────────────────────────────────────────────────────────────────────
// Section wrapper that shows a title with a count + children, or empty state.
// ────────────────────────────────────────────────────────────────────────────────

function AttentionSection({
  icon: Icon,
  title,
  children,
  empty,
}: {
  icon: typeof Stethoscope;
  title: string;
  children?: React.ReactNode;
  empty?: React.ReactNode;
}) {
  const items = (children as any[]) ?? [];
  const hasItems = Array.isArray(items) ? items.length > 0 : !!children;
  return (
    <section aria-label={title}>
      <h2 className="mb-2 flex items-center gap-2 text-base font-semibold sm:text-lg">
        <Icon className="h-4 w-4 text-primary" aria-hidden />
        {title}
      </h2>
      {hasItems ? (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">{children}</div>
      ) : (
        empty
      )}
    </section>
  );
}

// ────────────────────────────────────────────────────────────────────────────────
// Cards
// ────────────────────────────────────────────────────────────────────────────────

function ActiveRepairCard({ booking }: { booking: ActiveBooking }) {
  const job = booking.repairJob!;
  const category = booking.repairRequest.problem.category?.name ?? "Repair";
  return (
    <Card>
      <CardContent className="flex flex-col gap-3 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">{category}</Badge>
          <StatusBadge status={booking.status} />
          <StatusBadge status={job.status} />
          <span className="ml-auto text-xs text-muted-foreground">
            <Clock className="mr-1 inline h-3 w-3" aria-hidden />
            {timeAgo(booking.scheduledAt)}
          </span>
        </div>
        <p className="line-clamp-2 text-sm text-muted-foreground">
          {booking.repairRequest.problem.description}
        </p>
        {booking.technician && (
          <p className="text-xs text-muted-foreground">
            Technician: <span className="font-medium text-foreground">{booking.technician.displayName}</span>
            {booking.technician.verified && (
              <Badge variant="outline" className="ml-1 gap-1 border-emerald-200 bg-emerald-50 text-xs text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300">
                <ShieldCheck className="h-3 w-3" /> Verified
              </Badge>
            )}
          </p>
        )}
        <div className="rounded-md bg-muted/30 p-2">
          <JobMiniTimeline status={job.status} />
        </div>
        <div className="flex items-center justify-end gap-2">
          <Button size="sm" onClick={() => navigate(`repair/${job.id}`)}>
            Track repair
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function AppointmentCard({ booking }: { booking: ActiveBooking }) {
  const category = booking.repairRequest.problem.category?.name ?? "Appointment";
  return (
    <Card>
      <CardContent className="flex flex-col gap-3 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">{category}</Badge>
          <StatusBadge status={booking.status} />
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
          <span className="inline-flex items-center gap-1 text-foreground">
            <CalendarClock className="h-4 w-4 text-primary" aria-hidden />
            {formatDateTime(booking.scheduledAt)}
          </span>
        </div>
        <p className="line-clamp-2 text-sm text-muted-foreground">
          {booking.repairRequest.problem.description}
        </p>
        {booking.technician && (
          <p className="text-xs text-muted-foreground">
            Technician: <span className="font-medium text-foreground">{booking.technician.displayName}</span>
          </p>
        )}
        <div className="flex items-center justify-end gap-2">
          <Button size="sm" variant="outline" onClick={() => navigate(`booking/${booking.id}`)}>
            View booking
            <ChevronRight className="h-4 w-4" aria-hidden />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function PendingQuoteCard({ quote, bookingId }: { quote: PendingQuote; bookingId?: string }) {
  const category = quote.repairRequest.problem.category?.name ?? "Repair";
  return (
    <Card>
      <CardContent className="flex flex-col gap-3 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">{category}</Badge>
          <StatusBadge status={quote.status} />
          <span className="ml-auto text-xs text-muted-foreground">{timeAgo(quote.createdAt)}</span>
        </div>
        <p className="line-clamp-2 text-sm text-muted-foreground">
          {quote.repairRequest.problem.description}
        </p>
        <div className="flex items-center justify-between rounded-md bg-primary/5 px-3 py-2">
          <span className="text-xs text-muted-foreground">Quote total</span>
          <span className="text-lg font-bold text-primary">{formatCurrency(quote.totalEstimate, quote.currency)}</span>
        </div>
        {quote.technician && (
          <p className="text-xs text-muted-foreground">
            From: <span className="font-medium text-foreground">{quote.technician.displayName}</span>
          </p>
        )}
        <div className="flex items-center justify-end gap-2">
          <Button
            size="sm"
            onClick={() => navigate(`booking/${bookingId ?? quote.repairRequest.id}`)}
          >
            Review quote
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function PaymentCard({ payment }: { payment: PendingPayment }) {
  const category = payment.booking.repairRequest.problem.category?.name ?? "Repair";
  return (
    <Card>
      <CardContent className="flex flex-col gap-3 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">{category}</Badge>
          <StatusBadge status={payment.status} />
          <span className="ml-auto inline-flex items-center gap-1 text-xs text-destructive">
            <AlertCircle className="h-3 w-3" aria-hidden />
            Payment due
          </span>
        </div>
        <p className="line-clamp-2 text-sm text-muted-foreground">
          {payment.booking.repairRequest.problem.description}
        </p>
        <div className="flex items-center justify-between rounded-md bg-destructive/5 px-3 py-2">
          <span className="text-xs text-muted-foreground">Amount due</span>
          <span className="text-lg font-bold text-destructive">{formatCurrency(payment.amount, payment.currency)}</span>
        </div>
        {payment.booking.technician && (
          <p className="text-xs text-muted-foreground">
            Technician: <span className="font-medium text-foreground">{payment.booking.technician.displayName}</span>
          </p>
        )}
        <div className="flex items-center justify-end gap-2">
          <Button size="sm" onClick={() => navigate(`booking/${payment.booking.id}`)}>
            <CreditCard className="h-4 w-4" aria-hidden />
            Pay now
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function WarrantyCard({ warranty }: { warranty: ActiveWarranty }) {
  const expired = new Date(warranty.endDate) < new Date();
  return (
    <Card>
      <CardContent className="flex flex-col gap-3 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="gap-1 border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300">
            <ShieldCheck className="h-3 w-3" /> Active
          </Badge>
          <StatusBadge status={warranty.status} />
        </div>
        <p className="line-clamp-2 text-sm text-muted-foreground">{warranty.coveredWork}</p>
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Expires</span>
          <span className={expired ? "font-medium text-destructive" : "font-medium"}>
            {formatDate(warranty.endDate)}
          </span>
        </div>
        {warranty.job.booking.technician && (
          <p className="text-xs text-muted-foreground">
            Covered by: <span className="font-medium text-foreground">{warranty.job.booking.technician.displayName}</span>
          </p>
        )}
        <div className="flex items-center justify-end gap-2">
          <Button size="sm" variant="outline" onClick={() => navigate("warranty-claims")}>
            File claim
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function EquipmentCard({ equipment }: { equipment: RecentEquipment }) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-3 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">{equipment.category.name}</Badge>
        </div>
        <div>
          <p className="font-medium">
            {equipment.nickname || [equipment.brand, equipment.model].filter(Boolean).join(" ") || "Unnamed equipment"}
          </p>
          {(equipment.brand || equipment.model) && equipment.nickname && (
            <p className="text-xs text-muted-foreground">
              {[equipment.brand, equipment.model].filter(Boolean).join(" · ")}
            </p>
          )}
        </div>
        <div className="flex items-center justify-end gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => navigate(`diagnose?equipmentId=${equipment.id}&categoryId=${equipment.category.id}`)}
          >
            <Stethoscope className="h-4 w-4" aria-hidden />
            Diagnose issue
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function SessionCard({ session }: { session: RecentSession }) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-3 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">{session.category?.name || "Diagnostic Session"}</Badge>
          <StatusBadge status={session.status} />
          <span className="ml-auto text-xs text-muted-foreground">{timeAgo(session.startedAt)}</span>
        </div>
        {session.problem?.description && (
          <p className="line-clamp-2 text-sm text-muted-foreground">{session.problem.description}</p>
        )}
        <div className="flex items-center justify-end gap-2">
          <Button size="sm" onClick={() => navigate(`diagnose/session/${session.id}`)}>
            Continue
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ────────────────────────────────────────────────────────────────────────────────
// Small UI atoms
// ────────────────────────────────────────────────────────────────────────────────

const TONE_STYLES: Record<string, string> = {
  primary: "bg-primary/10 text-primary",
  sky: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300",
  amber: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  destructive: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
};

function CountBadge({
  icon: Icon,
  label,
  count,
  tone = "primary",
}: {
  icon: typeof Stethoscope;
  label: string;
  count: number;
  tone?: keyof typeof TONE_STYLES;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <div className={`flex h-10 w-10 items-center justify-center rounded-md ${TONE_STYLES[tone]}`}>
          <Icon className="h-5 w-5" aria-hidden />
        </div>
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-xl font-bold leading-tight">{count}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function QuickAction({
  icon: Icon,
  label,
  description,
  onClick,
}: {
  icon: typeof Stethoscope;
  label: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <Button
      variant="outline"
      onClick={onClick}
      className="h-auto justify-start gap-3 py-4 text-left"
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Icon className="h-5 w-5" aria-hidden />
      </span>
      <span className="flex min-w-0 flex-col">
        <span className="truncate text-sm font-medium text-foreground">
          {label}
        </span>
        <span className="truncate text-xs text-muted-foreground">
          {description}
        </span>
      </span>
    </Button>
  );
}

export default DashboardScreen;
