"use client";

import { useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import {
  CalendarClock,
  ChevronRight,
  ClipboardList,
  ShieldCheck,
  Wrench,
} from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
  ListSkeleton,
  PageContainer,
  PageHeader,
} from "@/components/shared/states";
import { StatusBadge } from "@/components/shared/status-badges";
import { useApi } from "@/hooks/use-api";
import { navigate } from "@/store/router";
import { formatCurrency, formatDate } from "@/lib/format";
import { ContextualSearch, type SearchResultItem } from "@/components/search/contextual-search";
import { scoreItem } from "@/lib/search/ranking";

// ────────────────────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────────────────────

type Technician = { id: string; displayName: string; avatarUrl?: string | null; verified: boolean };
type Quote = { id: string; totalEstimate: number; warrantyMonths?: number | null };
type RepairJob = { id: string; status: string; warranty?: { id: string; status: string; endDate: string } | null };
type Booking = { id: string; status: string; scheduledAt: string; repairJob?: RepairJob | null };

type RepairRequest = {
  id: string;
  status: string;
  createdAt: string;
  notes?: string | null;
  problem?: { id: string; description: string; category?: { slug: string; name: string } | null };
  technician?: Technician | null;
  quote?: Quote | null;
  booking?: Booking | null;
};

function initials(name: string): string {
  return name.split(" ").filter(Boolean).slice(0, 2).map((s) => s[0]?.toUpperCase()).join("");
}

const STATUS_FILTERS: { value: string; label: string }[] = [
  { value: "all", label: "All statuses" },
  { value: "OPEN", label: "Open" },
  { value: "MATCHED", label: "Matched" },
  { value: "TECHNICIAN_SELECTED", label: "Technician selected" },
  { value: "QUOTED", label: "Quoted" },
  { value: "BOOKED", label: "Booked" },
  { value: "COMPLETED", label: "Completed" },
  { value: "CANCELLED", label: "Cancelled" },
];

// ────────────────────────────────────────────────────────────────────────────────
// History row
// ────────────────────────────────────────────────────────────────────────────────

function HistoryRow({ req }: { req: RepairRequest }) {
  const job = req.booking?.repairJob;
  const booking = req.booking;
  const quote = req.quote;
  const tech = req.technician;

  const onClick = () => {
    if (job) navigate(`repair/${job.id}`);
    else if (booking) navigate(`booking/${booking.id}`);
    else navigate(`technicians?requestId=${req.id}`);
  };

  return (
    <Card className="overflow-hidden transition-shadow hover:shadow-md">
      <button onClick={onClick} className="block w-full text-left" aria-label="Open repair request">
        <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:gap-4">
          <Avatar className="hidden h-10 w-10 shrink-0 border sm:flex">
            {tech?.avatarUrl ? <AvatarImage src={tech.avatarUrl} alt="" /> : null}
            <AvatarFallback>{tech ? initials(tech.displayName) : <Wrench className="h-4 w-4" />}</AvatarFallback>
          </Avatar>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={req.status} />
              {req.problem?.category && (
                <Badge variant="secondary" className="text-xs">{req.problem.category.name}</Badge>
              )}
              {quote?.warrantyMonths && (
                <Badge variant="outline" className="gap-1 text-xs text-emerald-700 dark:text-emerald-300">
                  <ShieldCheck className="h-3 w-3" /> {quote.warrantyMonths}mo warranty
                </Badge>
              )}
            </div>
            <p className="mt-1.5 line-clamp-2 text-sm">
              {req.problem?.description ?? "Repair request"}
            </p>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <CalendarClock className="h-3 w-3" /> {formatDate(req.createdAt)}
              </span>
              {tech && (
                <span className="inline-flex items-center gap-1">
                  {tech.displayName}
                  {tech.verified && <ShieldCheck className="h-3 w-3 text-emerald-600" />}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3 sm:flex-col sm:items-end sm:gap-0.5">
            {quote ? (
              <>
                <span className="text-xs text-muted-foreground">Final cost</span>
                <span className="text-base font-bold text-primary">{formatCurrency(quote.totalEstimate)}</span>
              </>
            ) : (
              <Badge variant="outline" className="text-xs">No quote yet</Badge>
            )}
            <ChevronRight className="hidden h-4 w-4 text-muted-foreground sm:block" />
          </div>
        </CardContent>
      </button>
    </Card>
  );
}

// ────────────────────────────────────────────────────────────────────────────────
// Main screen
// ────────────────────────────────────────────────────────────────────────────────

export function HistoryScreen() {
  const { status } = useSession();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [search, setSearch] = useState("");

  const { data, isLoading, isError, error, refetch } = useApi<{ requests: RepairRequest[] }>(
    ["repair-requests", "history"],
    "/api/repair-requests",
  );

  const requests = useMemo(() => {
    let list = data?.requests ?? [];
    if (statusFilter !== "all") {
      list = list.filter((r) => r.status === statusFilter);
    }
    
    // Filtering logic was moved to ContextualSearch's onSearch
    
    return list;
  }, [data, statusFilter, search]);

  if (status === "loading" || isLoading) {
    return (
      <PageContainer>
        <PageHeader title="History" />
        <ListSkeleton />
      </PageContainer>
    );
  }

  if (isError) {
    return (
      <PageContainer>
        <PageHeader title="History" />
        <ErrorState title="Could not load history" detail={(error as Error)?.message} onRetry={() => refetch()} />
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageHeader
        title="Repair history"
        description="Track every repair request, quote, booking, and warranty in one place."
        actions={
          <Button onClick={() => navigate("diagnose")} size="sm">
            <Wrench className="h-4 w-4" /> New diagnosis
          </Button>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <ContextualSearch
          queryKey="history-search"
          placeholder="Search history..."
          className="w-full sm:w-64"
          onSearch={async (q) => {
            const qLower = q.trim();
            if (!qLower) return [];
            
            const list = data?.requests ?? [];
            return list.map(req => {
              const score = scoreItem(qLower, [
                { name: "technician", value: req.technician?.displayName, weight: 10.0 },
                { name: "equipment", value: req.problem?.category?.name, weight: 5.0 },
                { name: "bookingRef", value: req.booking?.id?.substring(0, 8), weight: 3.0 },
                { name: "status", value: req.status, weight: 1.0 },
                { name: "date", value: req.createdAt, weight: 0.5 },
              ]);
              return {
                id: req.id,
                title: req.technician?.displayName || "Request",
                subtitle: req.problem?.category?.name || "Equipment",
                score: score.score,
                req
              };
            }).filter(x => x.score > 0)
              .sort((a, b) => b.score - a.score)
              .slice(0, 5);
          }}
          onSelect={(item) => {
            // @ts-ignore
            const req = item.req;
            if (req.booking?.repairJob) navigate(`repair/${req.booking.repairJob.id}`);
            else if (req.booking) navigate(`booking/${req.booking.id}`);
            else navigate(`technicians?requestId=${req.id}`);
          }}
        />
        <span className="text-xs text-muted-foreground ml-2 hidden sm:inline">Filter</span>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="h-8 w-[180px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            {STATUS_FILTERS.map((f) => (
              <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="ml-auto text-xs text-muted-foreground">
          {requests.length} request{requests.length === 1 ? "" : "s"}
        </span>
      </div>

      {requests.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title={statusFilter === "all" ? "No repairs yet" : "No matching requests"}
          description={
            statusFilter === "all"
              ? "Run a diagnosis to start your first repair request."
              : "Try a different filter."
          }
          action={
            statusFilter === "all" ? (
              <Button onClick={() => navigate("diagnose")}>Start a diagnosis</Button>
            ) : undefined
          }
        />
      ) : (
        <div className="space-y-3">
          {requests.map((r) => (
            <HistoryRow key={r.id} req={r} />
          ))}
        </div>
      )}
    </PageContainer>
  );
}
