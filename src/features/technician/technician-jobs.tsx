"use client";

import { useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import {
  CalendarClock,
  ChevronRight,
  MapPin,
  ShieldAlert,
  Wrench,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  EmptyState,
  ErrorState,
  LoadingState,
  PageContainer,
  PageHeader,
} from "@/components/shared/states";
import { StatusBadge } from "@/components/shared/status-badges";
import { useApi } from "@/hooks/use-api";
import { navigate } from "@/store/router";
import { formatDateTime, timeAgo } from "@/lib/format";

// ────────────────────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────────────────────

type Problem = { id: string; description: string; category?: { slug: string; name: string } | null };
type Customer = { id: string; subCity?: string | null; phone?: string | null; user?: { name?: string | null; email?: string | null } | null };
type Quote = { id: string; totalEstimate: number; status: string };

type Job = {
  id: string;
  status: string;
  startedAt?: string | null;
  completedAt?: string | null;
  createdAt: string;
  booking: {
    id: string;
    scheduledAt: string;
    location: string;
    customer?: Customer | null;
    repairRequest: { problem: Problem };
    quote?: Quote | null;
  };
};

const STATUS_GROUPS: { value: string; label: string }[] = [
  { value: "all", label: "All jobs" },
  { value: "SCHEDULED", label: "Scheduled" },
  { value: "EN_ROUTE", label: "En route" },
  { value: "ARRIVED", label: "Arrived" },
  { value: "INSPECTING", label: "Inspecting" },
  { value: "DIAGNOSING", label: "Diagnosing" },
  { value: "QUOTE_SUBMITTED", label: "Quote submitted" },
  { value: "AWAITING_APPROVAL", label: "Awaiting approval" },
  { value: "REPAIRING", label: "Repairing" },
  { value: "COMPLETED", label: "Completed" },
  { value: "CANCELLED", label: "Cancelled" },
];

function JobRow({ job }: { job: Job }) {
  return (
    <Card className="overflow-hidden transition-shadow hover:shadow-md">
      <button
        onClick={() => navigate(`repair/${job.id}`)}
        className="block w-full text-left"
        aria-label={`Open job ${job.id}`}
      >
        <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={job.status} />
              {job.booking.repairRequest.problem.category && (
                <Badge variant="secondary" className="text-xs">
                  {job.booking.repairRequest.problem.category.name}
                </Badge>
              )}
              <span className="ml-auto text-xs text-muted-foreground">{timeAgo(job.createdAt)}</span>
            </div>
            <p className="mt-1.5 line-clamp-2 text-sm">
              {job.booking.repairRequest.problem.description}
            </p>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
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
          <div className="flex shrink-0 items-center gap-2">
            {job.booking.quote && (
              <span className="text-sm font-medium">{job.booking.quote.totalEstimate.toLocaleString()} ETB</span>
            )}
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </div>
        </CardContent>
      </button>
    </Card>
  );
}

export function TechnicianJobs() {
  const { data: session, status } = useSession();
  const role = session?.user?.role;
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const { data, isLoading, isError, error, refetch } = useApi<{ jobs: Job[] }>(
    ["technician-jobs", "list"],
    "/api/technician/jobs",
  );

  const jobs = useMemo(() => {
    const list = data?.jobs ?? [];
    if (statusFilter === "all") return list;
    return list.filter((j) => j.status === statusFilter);
  }, [data, statusFilter]);

  if (status === "loading" || isLoading) {
    return (
      <PageContainer>
        <PageHeader title="My jobs" />
        <LoadingState label="Loading jobs…" />
      </PageContainer>
    );
  }

  if (role !== "TECHNICIAN" && role !== "ADMIN") {
    return (
      <PageContainer>
        <EmptyState
          icon={ShieldAlert}
          title="Not authorized"
          description="This page is only available to technicians."
          action={<Button onClick={() => navigate("auth/signin")}>Sign in</Button>}
        />
      </PageContainer>
    );
  }

  if (isError) {
    return (
      <PageContainer>
        <PageHeader title="My jobs" />
        <ErrorState title="Could not load jobs" detail={(error as Error)?.message} onRetry={() => refetch()} />
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageHeader
        title="My jobs"
        description="All repair jobs assigned to you, past and present."
        actions={
          <Button variant="outline" size="sm" onClick={() => navigate("technician")}>
            <Wrench className="h-4 w-4" /> Workspace
          </Button>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted-foreground">Filter</span>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="h-8 w-[200px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            {STATUS_GROUPS.map((f) => (
              <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="ml-auto text-xs text-muted-foreground">
          {jobs.length} job{jobs.length === 1 ? "" : "s"}
        </span>
      </div>

      {jobs.length === 0 ? (
        <EmptyState
          icon={Wrench}
          title={statusFilter === "all" ? "No jobs yet" : "No matching jobs"}
          description={statusFilter === "all" ? "Accept an incoming request to start your first job." : "Try a different filter."}
        />
      ) : (
        <div className="space-y-3">
          {jobs.map((j) => <JobRow key={j.id} job={j} />)}
        </div>
      )}
    </PageContainer>
  );
}
