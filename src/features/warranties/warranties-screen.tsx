"use client";

import { useMemo } from "react";
import { useSession } from "next-auth/react";
import {
  CalendarClock,
  ChevronRight,
  ClipboardList,
  ShieldCheck,
  Wrench,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { formatDate } from "@/lib/format";

// ────────────────────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────────────────────

type Warranty = {
  id: string;
  startDate: string;
  endDate: string;
  durationMonths: number;
  coveredWork: string;
  status: string;
  job: {
    id: string;
    booking: {
      id: string;
      technician: { id: string; displayName: string; verified: boolean };
      repairRequest: { problem?: { category?: { name: string } | null } | null };
    };
  };
};

function WarrantyCard({ w }: { w: Warranty }) {
  const isExpired = w.status === "EXPIRED" || new Date(w.endDate) < new Date();
  return (
    <Card className="overflow-hidden">
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center justify-between gap-2 text-base">
          <span className="flex items-center gap-2">
            <ShieldCheck className={`h-4 w-4 ${isExpired ? "text-muted-foreground" : "text-emerald-600"}`} />
            {w.job.booking.repairRequest.problem?.category?.name ?? "Repair"} warranty
          </span>
          <StatusBadge status={w.status} />
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-xs text-muted-foreground">Start</p>
            <p className="font-medium">{formatDate(w.startDate)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">End</p>
            <p className="font-medium">{formatDate(w.endDate)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Duration</p>
            <p className="font-medium">{w.durationMonths} months</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Technician</p>
            <p className="flex items-center gap-1 font-medium">
              {w.job.booking.technician.displayName}
              {w.job.booking.technician.verified && <ShieldCheck className="h-3 w-3 text-emerald-600" />}
            </p>
          </div>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Covered work</p>
          <p className="mt-0.5">{w.coveredWork}</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="w-full"
          onClick={() => navigate(`repair/${w.job.id}`)}
        >
          View repair <ChevronRight className="h-4 w-4" />
        </Button>
      </CardContent>
    </Card>
  );
}

// ────────────────────────────────────────────────────────────────────────────────
// Main
// ────────────────────────────────────────────────────────────────────────────────

export function WarrantiesScreen() {
  const { status } = useSession();
  const { data, isLoading, isError, error, refetch } = useApi<{ warranties: Warranty[] }>(
    ["warranties"],
    "/api/warranties",
  );

  const { active, expired } = useMemo(() => {
    const all = data?.warranties ?? [];
    const active = all.filter((w) => w.status === "ACTIVE" && new Date(w.endDate) >= new Date());
    const expired = all.filter((w) => w.status !== "ACTIVE" || new Date(w.endDate) < new Date());
    return { active, expired };
  }, [data]);

  if (status === "loading" || isLoading) {
    return (
      <PageContainer>
        <PageHeader title="Warranties" />
        <LoadingState label="Loading warranties…" />
      </PageContainer>
    );
  }

  if (isError) {
    return (
      <PageContainer>
        <PageHeader title="Warranties" />
        <ErrorState title="Could not load warranties" detail={(error as Error)?.message} onRetry={() => refetch()} />
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageHeader
        title="Warranties"
        description="Active and expired warranties from your completed repairs."
        actions={
          <Button onClick={() => navigate("history")} size="sm" variant="outline">
            <CalendarClock className="h-4 w-4" /> View history
          </Button>
        }
      />

      <Tabs defaultValue="active">
        <TabsList>
          <TabsTrigger value="active">
            Active <Badge variant="secondary" className="ml-1.5">{active.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="expired">
            Expired <Badge variant="secondary" className="ml-1.5">{expired.length}</Badge>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="active" className="mt-4">
          {active.length === 0 ? (
            <EmptyState
              icon={ShieldCheck}
              title="No active warranties"
              description="When you complete a repair with a warranty, it'll appear here."
              action={<Button onClick={() => navigate("history")} variant="outline">View history</Button>}
            />
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {active.map((w) => <WarrantyCard key={w.id} w={w} />)}
            </div>
          )}
        </TabsContent>

        <TabsContent value="expired" className="mt-4">
          {expired.length === 0 ? (
            <EmptyState
              icon={ClipboardList}
              title="No expired warranties"
              description="Expired warranties will be listed here for your records."
            />
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {expired.map((w) => <WarrantyCard key={w.id} w={w} />)}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <div className="mt-8 rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
        <p className="flex items-center gap-2 font-medium text-foreground">
          <Wrench className="h-4 w-4 text-primary" /> Need to file a warranty claim?
        </p>
        <p className="mt-1">
          Open the original repair and contact the technician. Warranty coverage is defined in the original quote.
        </p>
      </div>
    </PageContainer>
  );
}
