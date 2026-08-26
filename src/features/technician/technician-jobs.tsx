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
import { formatCurrency, formatDateTime, timeAgo } from "@/lib/format";
import { ContextualSearch, type SearchResultItem } from "@/components/search/contextual-search";
import { scoreItem } from "@/lib/search/ranking";

// ────────────────────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────────────────────

type Problem = { id: string; description: string; category?: { slug: string; name: string } | null };
type Customer = { id: string; subCity?: string | null; phone?: string | null; user?: { name?: string | null; email?: string | null } | null };
type Quote = { id: string; totalEstimate: number; status: string };

type Job = {
  id: string; // Booking ID
  status: string; // Booking status
  createdAt: string;
  scheduledAt: string;
  location: string;
  customer?: Customer | null;
  repairRequest: { problem: Problem };
  quote?: Quote | null;
  repairJob?: {
    id: string;
    status: string;
    startedAt?: string | null;
    completedAt?: string | null;
  } | null;
};

const STATUS_GROUPS: { value: string; label: string }[] = [
  { value: "all", label: "All jobs" },
  { value: "REQUESTED", label: "Requested" },
  { value: "ACCEPTED", label: "Accepted" },
  { value: "QUOTE_SUBMITTED", label: "Quote submitted" },
  { value: "AWAITING_PAYMENT", label: "Awaiting payment" },
  { value: "CONFIRMED", label: "Confirmed" },
  { value: "COMPLETED", label: "Completed" },
  { value: "CANCELLED", label: "Cancelled" },
];

function JobRow({ job }: { job: Job }) {
  // If there's a RepairJob, it means the booking is CONFIRMED and the tech is doing the physical work.
  // We can show the physical status (e.g. EN_ROUTE) instead if we want, or just the booking status.
  const displayStatus = job.repairJob && job.status === "CONFIRMED" ? job.repairJob.status : job.status;

  return (
    <Card className="overflow-hidden transition-shadow hover:shadow-md">
      <button
        onClick={() => navigate(`booking/${job.id}`)}
        className="block w-full text-left"
        aria-label={`Open job ${job.id}`}
      >
        <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={displayStatus} />
              {job.repairRequest.problem.category && (
                <Badge variant="secondary" className="text-xs">
                  {job.repairRequest.problem.category.name}
                </Badge>
              )}
              <span className="ml-auto text-xs text-muted-foreground">{timeAgo(job.createdAt)}</span>
            </div>
            <p className="mt-1.5 line-clamp-2 text-sm">
              {job.repairRequest.problem.description}
            </p>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <CalendarClock className="h-3 w-3" /> {formatDateTime(job.scheduledAt)}
              </span>
              <span className="inline-flex items-center gap-1">
                <MapPin className="h-3 w-3" /> {job.location}
              </span>
              {job.customer && (
                <span>{job.customer.user?.name ?? job.customer.user?.email ?? "Customer"}</span>
              )}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {job.quote && (
              <span className="text-sm font-medium">{formatCurrency(job.quote.totalEstimate)}</span>
            )}
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </div>
        </CardContent>
      </button>
    </Card>
  );
}

export function TechnicianJobs() {
  const { status, data: session } = useSession();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const role = session?.user?.role;

  const { data, isLoading, isError, error, refetch } = useApi<{ jobs: Job[] }>(
    ["technician-jobs"],
    "/api/technician/jobs",
    { staleTime: 30_000 }
  );

  const jobs = useMemo(() => {
    let list = data?.jobs ?? [];
    if (statusFilter !== "all") {
      list = list.filter((j) => j.status === statusFilter);
    }
    
    // Filtering logic was moved to ContextualSearch's onSearch
    
    return list;
  }, [data, statusFilter, search]);

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
        <ContextualSearch
          queryKey="jobs-search"
          placeholder="Search jobs..."
          className="w-full sm:w-64"
          onSearch={async (q) => {
            const qLower = q.trim();
            if (!qLower) return [];
            
            const list = data?.jobs ?? [];
            return list.map(job => {
              const score = scoreItem(qLower, [
                { name: "customer", value: job.customer?.user?.name, weight: 10.0 },
                { name: "equipment", value: job.repairRequest.problem?.category?.name, weight: 5.0 },
                { name: "bookingRef", value: job.id?.substring(0, 8), weight: 3.0 },
                { name: "status", value: job.status, weight: 1.0 },
                { name: "date", value: job.createdAt, weight: 0.5 },
              ]);
              return {
                id: job.id,
                title: job.customer?.user?.name || "Job",
                subtitle: job.repairRequest.problem?.category?.name || "Equipment",
                score: score.score,
                job
              };
            }).filter(x => x.score > 0)
              .sort((a, b) => b.score - a.score)
              .slice(0, 5);
          }}
          onSelect={(item) => {
            // @ts-ignore
            const job = item.job;
            if (job.repairJob) navigate(`repair/${job.repairJob.id}`);
            else navigate(`booking/${job.id}`);
          }}
        />
        <span className="text-xs text-muted-foreground ml-2 hidden sm:inline">Filter</span>
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
