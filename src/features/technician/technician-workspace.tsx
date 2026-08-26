"use client";

import { useMemo } from "react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import {
  Briefcase,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  Clock,
  MapPin,
  ShieldAlert,
  ShieldCheck,
  Star,
  TrendingUp,
  Wallet,
  Wrench,
  XCircle,
  Hourglass,
  CalendarDays,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  EmptyState,
  ErrorState,
  LoadingState,
  PageContainer,
  PageHeader,
  DashboardSkeleton,
} from "@/components/shared/states";
import { StatusBadge } from "@/components/shared/status-badges";
import { useApi, useApiMutation } from "@/hooks/use-api";
import { navigate } from "@/store/router";
import { formatCurrency, formatDateTime, timeAgo } from "@/lib/format";

// ────────────────────────────────────────────────────────────────────────────────
// Types — shape returned by GET /api/technician/dashboard
// ────────────────────────────────────────────────────────────────────────────────

type Category = { id: string; slug: string; name: string };
type Problem = { id: string; description: string; category?: Category | null };
type Customer = {
  id: string;
  subCity?: string | null;
  phone?: string | null;
  user?: { name?: string | null; email?: string | null } | null;
};
type Booking = {
  id: string;
  status: string;
  scheduledAt: string;
  location: string;
  customer?: Customer | null;
  repairRequest: { id: string; problem: Problem };
  appointment?: { id: string; scheduledAt: string; status: string } | null;
};
type Job = {
  id: string;
  status: string;
  startedAt?: string | null;
  completedAt?: string | null;
  createdAt: string;
  booking: Booking;
};

type IncomingRequest = {
  id: string;
  status: string;
  createdAt: string;
  notes?: string | null;
  problem: Problem;
  customer?: Customer | null;
  booking?: { id: string; status: string } | null;
};

type Performance = {
  completedJobs: number;
  rating: number;
  ratingCount: number;
  jobsThisMonth: number;
  responseTimeHours: number;
  cancellationRate: number;
};

type Earnings = {
  totalEarnings: number;
  earningsThisMonth: number;
  jobsThisMonth: number;
  pendingPayouts?: number;
  completedPayouts?: number;
};

type DashboardData = {
  dashboard: {
    status?: string;
    today: Job[];
    requests: IncomingRequest[];
    activeJobs: Job[];
    awaitingApproval: Job[];
    performance: Performance;
    earnings: Earnings;
  };
};

// Job lifecycle advance map (subset relevant for quick-advance).
const JOB_NEXT: Record<string, string | null> = {
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

const JOB_NEXT_LABEL: Record<string, string> = {
  EN_ROUTE: "Mark en route",
  ARRIVED: "Mark arrived",
  INSPECTING: "Begin inspection",
  DIAGNOSING: "Begin diagnosing",
  QUOTE_SUBMITTED: "Mark quote submitted",
  AWAITING_APPROVAL: "Awaiting approval",
  REPAIRING: "Begin repair",
  COMPLETED: "Mark complete",
};

// ────────────────────────────────────────────────────────────────────────────────
// Stat card
// ────────────────────────────────────────────────────────────────────────────────

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  tone = "primary",
}: {
  icon: any;
  label: string;
  value: string;
  sub?: string;
  tone?: "primary" | "amber" | "emerald" | "sky";
}) {
  const toneClass = {
    primary: "bg-primary/10 text-primary",
    amber: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
    emerald: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
    sky: "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300",
  }[tone];
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <div className={`flex h-10 w-10 items-center justify-center rounded-md ${toneClass}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-xl font-bold leading-tight">{value}</p>
          {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

// ────────────────────────────────────────────────────────────────────────────────
// Incoming request card
// ────────────────────────────────────────────────────────────────────────────────

function IncomingRequestCard({ req, onAction, disabled }: { req: IncomingRequest; onAction: () => void; disabled?: boolean }) {
  const acceptBooking = useApiMutation(
    req.booking ? `/api/bookings/${req.booking.id}/transition` : "/api/bookings/_/transition",
    "POST",
    [["technician-dashboard"], ["technician-jobs"]],
    {
      queryKey: ["technician-dashboard"],
      updater: (oldData: any, newVars: any) => {
        if (!oldData || !oldData.dashboard) return oldData;
        return {
          ...oldData,
          dashboard: {
            ...oldData.dashboard,
            requests: oldData.dashboard.requests.filter((r: any) => r.id !== req.id)
          }
        };
      }
    }
  );

  const customer = req.customer;
  const booking = req.booking;

  const accept = async () => {
    if (!booking) {
      toast.info("Customer hasn't created a booking yet. Wait for them to schedule.");
      return;
    }
    try {
      await acceptBooking.mutateAsync({ status: "ACCEPTED", note: "Accepted by technician" });
      toast.success("Booking accepted.");
      onAction();
    } catch (e: any) {
      toast.error(e?.message ?? "Could not accept booking");
    }
  };

  const decline = async () => {
    if (!booking) {
      toast.info("No booking to decline yet.");
      return;
    }
    try {
      await acceptBooking.mutateAsync({ status: "CANCELLED", note: "Declined by technician" });
      toast.success("Booking declined.");
      onAction();
    } catch (e: any) {
      toast.error(e?.message ?? "Could not decline booking");
    }
  };

  return (
    <Card>
      <CardContent className="flex flex-col gap-3 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={req.status} />
          {req.problem.category && <Badge variant="secondary">{req.problem.category.name}</Badge>}
          <span className="ml-auto text-xs text-muted-foreground">{timeAgo(req.createdAt)}</span>
        </div>
        <p className="text-sm">{req.problem.description}</p>
        {req.notes && (
          <p className="rounded-md bg-muted/40 p-2 text-xs text-muted-foreground">{req.notes}</p>
        )}
        {customer && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span>{customer.user?.name ?? customer.user?.email ?? "Customer"}</span>
            {customer.subCity && <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" /> {customer.subCity}</span>}
            {customer.phone && <span>{customer.phone}</span>}
          </div>
        )}
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button onClick={accept} disabled={disabled || acceptBooking.isPending} size="sm" className="flex-1">
            <CheckCircle2 className="h-4 w-4" />
            {booking ? "Accept" : "Awaiting booking"}
          </Button>
          <Button onClick={decline} disabled={disabled || acceptBooking.isPending} size="sm" variant="outline" className="flex-1">
            <XCircle className="h-4 w-4" /> Decline
          </Button>
          {booking?.id && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate(`booking/${booking.id}`)}
            >
              Open <ChevronRight className="h-4 w-4" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ────────────────────────────────────────────────────────────────────────────────
// Active job row with quick-advance
// ────────────────────────────────────────────────────────────────────────────────

function ActiveJobRow({ job, onAction, disabled }: { job: Job; onAction: () => void; disabled?: boolean }) {
  const transition = useApiMutation(`/api/repair-jobs/${job.id}/transition`, "POST", [["technician-dashboard"], ["technician-jobs"]]);
  const next = JOB_NEXT[job.status] ?? null;

  const advance = async () => {
    if (!next) return;
    try {
      await transition.mutateAsync({ status: next });
      toast.success(`Status updated: ${next.replaceAll("_", " ").toLowerCase()}`);
      onAction();
    } catch (e: any) {
      toast.error(e?.message ?? "Could not update status");
    }
  };

  return (
    <Card>
      <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={job.status} />
            {job.booking.repairRequest.problem.category && (
              <Badge variant="secondary" className="text-xs">
                {job.booking.repairRequest.problem.category.name}
              </Badge>
            )}
          </div>
          <p className="mt-1 line-clamp-2 text-sm">{job.booking.repairRequest.problem.description}</p>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <CalendarClock className="h-3 w-3" /> {formatDateTime(job.booking.scheduledAt)}
            </span>
            <span className="inline-flex items-center gap-1">
              <MapPin className="h-3 w-3" /> {job.booking.location}
            </span>
            {job.booking.customer && (
              <span>{job.booking.customer.user?.name ?? job.booking.customer.user?.email ?? "Customer"}</span>
            )}
          </div>
        </div>
        <div className="flex shrink-0 flex-col gap-2 sm:flex-row sm:items-center">
          {next ? (
            <Button onClick={advance} disabled={disabled || transition.isPending} size="sm">
              {JOB_NEXT_LABEL[next]}
            </Button>
          ) : (
            <Badge variant="outline" className="text-emerald-700">Completed</Badge>
          )}
          <Button variant="ghost" size="sm" onClick={() => navigate(`repair/${job.id}`)}>
            Open <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ────────────────────────────────────────────────────────────────────────────────
// Section wrapper
// ────────────────────────────────────────────────────────────────────────────────

function Section({
  icon: Icon,
  title,
  count,
  children,
  empty,
}: {
  icon: any;
  title: string;
  count?: number;
  children?: React.ReactNode;
  empty?: React.ReactNode;
}) {
  const items = (children as any[]) ?? [];
  const hasItems = Array.isArray(items) ? items.length > 0 : !!children;
  return (
    <section aria-label={title}>
      <h2 className="mb-3 flex items-center gap-2 text-base font-semibold sm:text-lg">
        <Icon className="h-4 w-4 text-primary" aria-hidden />
        {title}
        {typeof count === "number" && count > 0 && (
          <Badge variant="default" className="ml-1">{count}</Badge>
        )}
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
// Main
// ────────────────────────────────────────────────────────────────────────────────

export function TechnicianWorkspace() {
  const { data: session, status } = useSession();
  const role = session?.user?.role;

  const { data, isLoading, isError, error, refetch } = useApi<DashboardData>(
    ["technician-dashboard"],
    "/api/technician/dashboard",
    { refetchInterval: 15_000, staleTime: 30_000 }
  );

  const dash = data?.dashboard;

  const todayJobs = dash?.today ?? [];
  const requests = useMemo(() => dash?.requests ?? [], [dash]);
  const activeJobs = useMemo(() => dash?.activeJobs ?? [], [dash]);
  const awaitingApproval = useMemo(() => dash?.awaitingApproval ?? [], [dash]);
  const performance = dash?.performance;
  const earnings = dash?.earnings;
  const isPending = dash?.status === "PENDING";

  if (status === "loading") {
    return (
      <PageContainer>
        <DashboardSkeleton />
      </PageContainer>
    );
  }

  if (role !== "TECHNICIAN" && role !== "ADMIN") {
    return (
      <PageContainer>
        <EmptyState
          icon={ShieldAlert}
          title="Not authorized"
          description="This workspace is for verified technicians. Sign in with a technician account to access it."
          action={<Button onClick={() => navigate("auth/signin")}>Sign in</Button>}
        />
      </PageContainer>
    );
  }

  if (role === "ADMIN") {
    return (
      <PageContainer>
        <EmptyState
          icon={ShieldAlert}
          title="Admin preview"
          description="You're signed in as an admin. Use the Admin tab to manage technicians and diagnostic content."
          action={<Button onClick={() => navigate("admin")}>Go to admin</Button>}
        />
      </PageContainer>
    );
  }

  if (isLoading) {
    return (
      <PageContainer>
        <PageHeader title="Technician workspace" description="Your incoming requests and active jobs at a glance." />
        <DashboardSkeleton />
      </PageContainer>
    );
  }

  if (isError) {
    return (
      <PageContainer>
        <PageHeader title="Technician workspace" />
        <ErrorState
          title="Could not load workspace"
          detail={(error as Error)?.message}
          onRetry={() => refetch()}
        />
      </PageContainer>
    );
  }

  const rating = performance?.rating ?? 0;
  const ratingCount = performance?.ratingCount ?? 0;

  return (
    <PageContainer>
      {isPending && (
        <div className="mb-6 rounded-md bg-amber-500/10 p-4 border border-amber-500/20 text-amber-600 dark:text-amber-400">
          <div className="flex gap-3">
            <ShieldAlert className="h-5 w-5 shrink-0" />
            <div>
              <h3 className="font-semibold text-sm">Account pending approval</h3>
              <p className="text-sm mt-1">
                Your account is currently under review by an administrator. You can explore the workspace, but you will not be able to accept jobs or submit quotes until approved.
              </p>
            </div>
          </div>
        </div>
      )}
      <PageHeader
        title="Technician workspace"
        description="Today's appointments, incoming requests, and your performance at a glance."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => navigate("availability")}>
              <CalendarDays className="h-4 w-4" /> Manage availability
            </Button>
            <Button variant="outline" size="sm" onClick={() => navigate("technician/jobs")}>
              <Briefcase className="h-4 w-4" /> My jobs
            </Button>
          </div>
        }
      />

      {/* Performance + earnings stat band */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        <StatCard icon={CheckCircle2} label="Completed jobs" value={String(performance?.completedJobs ?? 0)} tone="emerald" />
        <StatCard
          icon={Star}
          label="Rating"
          value={rating > 0 ? rating.toFixed(1) : "—"}
          sub={ratingCount > 0 ? `${ratingCount} reviews` : "no reviews yet"}
          tone="amber"
        />
        <StatCard icon={TrendingUp} label="Jobs this month" value={String(performance?.jobsThisMonth ?? 0)} tone="primary" />
        <StatCard
          icon={Hourglass}
          label="Response time"
          value={`${performance?.responseTimeHours ?? 24}h`}
          sub={performance ? `cancel rate ${(performance.cancellationRate * 100).toFixed(0)}%` : undefined}
          tone="sky"
        />
      </div>

      {/* Earnings card */}
      {earnings && (
        <Card className="mb-6">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Wallet className="h-4 w-4 text-primary" /> Earnings
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="rounded-md bg-primary/5 p-3">
              <p className="text-xs text-muted-foreground">Total earnings</p>
              <p className="text-xl font-bold text-primary">{formatCurrency(earnings.totalEarnings)}</p>
            </div>
            <div className="rounded-md bg-emerald-50 p-3 dark:bg-emerald-950/40">
              <p className="text-xs text-muted-foreground">This month</p>
              <p className="text-xl font-bold text-emerald-700 dark:text-emerald-300">{formatCurrency(earnings.earningsThisMonth)}</p>
              <p className="text-xs text-muted-foreground">{earnings.jobsThisMonth} jobs</p>
            </div>
            <div className="rounded-md bg-muted/40 p-3">
              <p className="text-xs text-muted-foreground">Pending payouts</p>
              <p className="text-xl font-bold">{formatCurrency(earnings.pendingPayouts ?? 0)}</p>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="space-y-8">
        {/* Today's appointments */}
        <Section
          icon={CalendarClock}
          title="Today"
          count={todayJobs.length}
          empty={
            <EmptyState
              icon={CalendarClock}
              title="No appointments today"
              description="When a customer books you for today, their job will appear here with a Start button."
            />
          }
        >
          {todayJobs.map((job) => (
            <TodayJobCard key={job.id} job={job} onAction={() => refetch()} disabled={isPending} />
          ))}
        </Section>

        {/* Incoming requests */}
        <Section
          icon={Clock}
          title="Requests"
          count={requests.length}
          empty={
            <EmptyState
              icon={Clock}
              title="No incoming requests"
              description="When a customer selects you, their request will appear here for accept/decline."
            />
          }
        >
          {requests.map((r) => (
            <IncomingRequestCard key={r.id} req={r} onAction={() => refetch()} disabled={isPending} />
          ))}
        </Section>

        {/* Active work */}
        <Section
          icon={Wrench}
          title="Active work"
          count={activeJobs.length}
          empty={
            <EmptyState
              icon={ShieldCheck}
              title="No active jobs"
              description="Once you accept a booking and start work, it'll show up here with a quick-advance button."
            />
          }
        >
          {activeJobs.map((j) => (
            <ActiveJobRow key={j.id} job={j} onAction={() => refetch()} disabled={isPending} />
          ))}
        </Section>

        {/* Awaiting approval */}
        <Section
          icon={Hourglass}
          title="Awaiting approval"
          count={awaitingApproval.length}
          empty={
            <EmptyState
              icon={Hourglass}
              title="Nothing awaiting approval"
              description="When you submit a quote, the job will wait here for the customer's decision."
            />
          }
        >
          {awaitingApproval.map((j) => (
            <AwaitingApprovalCard key={j.id} job={j} />
          ))}
        </Section>
      </div>
    </PageContainer>
  );
}

// ────────────────────────────────────────────────────────────────────────────────
// Today's appointment card
// ────────────────────────────────────────────────────────────────────────────────

function TodayJobCard({ job, onAction, disabled }: { job: Job; onAction: () => void; disabled?: boolean }) {
  const transition = useApiMutation(`/api/repair-jobs/${job.id}/transition`, "POST", [["technician-dashboard"], ["technician-jobs"]]);
  const next = JOB_NEXT[job.status] ?? null;
  const isStarting = job.status === "SCHEDULED";

  const advance = async () => {
    if (!next) return;
    try {
      await transition.mutateAsync({ status: next });
      toast.success(`Status updated: ${next.replaceAll("_", " ").toLowerCase()}`);
      onAction();
    } catch (e: any) {
      toast.error(e?.message ?? "Could not update status");
    }
  };

  return (
    <Card>
      <CardContent className="flex flex-col gap-3 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={job.status} />
          {job.booking.repairRequest.problem.category && (
            <Badge variant="secondary" className="text-xs">
              {job.booking.repairRequest.problem.category.name}
            </Badge>
          )}
          <span className="ml-auto text-xs text-muted-foreground">
            {formatDateTime(job.booking.scheduledAt)}
          </span>
        </div>
        <p className="line-clamp-2 text-sm">{job.booking.repairRequest.problem.description}</p>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          {job.booking.customer && (
            <span>{job.booking.customer.user?.name ?? job.booking.customer.user?.email ?? "Customer"}</span>
          )}
          {job.booking.customer?.phone && <span>{job.booking.customer.phone}</span>}
          <span className="inline-flex items-center gap-1">
            <MapPin className="h-3 w-3" /> {job.booking.location}
          </span>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          {next && (
            <Button onClick={advance} disabled={disabled || transition.isPending} size="sm">
              {isStarting ? "Start job" : JOB_NEXT_LABEL[next]}
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={() => navigate(`repair/${job.id}`)}>
            Open <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ────────────────────────────────────────────────────────────────────────────────
// Awaiting approval card
// ────────────────────────────────────────────────────────────────────────────────

function AwaitingApprovalCard({ job }: { job: Job }) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-3 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={job.status} />
          {job.booking.repairRequest.problem.category && (
            <Badge variant="secondary" className="text-xs">
              {job.booking.repairRequest.problem.category.name}
            </Badge>
          )}
        </div>
        <p className="line-clamp-2 text-sm">{job.booking.repairRequest.problem.description}</p>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <CalendarClock className="h-3 w-3" /> {formatDateTime(job.booking.scheduledAt)}
          </span>
          {job.booking.customer && (
            <span>{job.booking.customer.user?.name ?? job.booking.customer.user?.email ?? "Customer"}</span>
          )}
        </div>
        <div className="flex items-center justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={() => navigate(`repair/${job.id}`)}>
            Open <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default TechnicianWorkspace;
