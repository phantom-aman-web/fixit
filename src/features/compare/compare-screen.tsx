"use client";

import { useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import {
  ArrowRight,
  BadgeCheck,
  Check,
  Clock,
  GitCompareArrows,
  MapPin,
  Plus,
  Sparkles,
  Star,
  Timer,
  Wrench,
  X,
} from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { formatCurrency } from "@/lib/format";

// ────────────────────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────────────────────

type Skill = {
  id: string;
  skill: string;
  equipmentCategory?: string | null;
  proficiency: number;
};

type ServiceArea = { id: string; name: string; city: string };

type Technician = {
  id: string;
  displayName: string;
  avatarUrl?: string | null;
  yearsExperience: number;
  completedJobs: number;
  rating: number;
  ratingCount: number;
  responseTimeHours: number;
  baseCallOutFee?: number | null;
  hourlyRate?: number | null;
  verified: boolean;
  status: string;
  availability: string;
  skills: Skill[];
  serviceAreas: { id: string; serviceArea: ServiceArea }[];
};

// ────────────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────────────

function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase())
    .join("");
}

const MAX_COMPARE = 3;

// ────────────────────────────────────────────────────────────────────────────────
// Selector (technician picker)
// ────────────────────────────────────────────────────────────────────────────────

function TechnicianPicker({
  technicians,
  selected,
  onToggle,
}: {
  technicians: Technician[];
  selected: Technician[];
  onToggle: (t: Technician) => void;
}) {
  const available = useMemo(
    () => technicians.filter((t) => !selected.some((s) => s.id === t.id)),
    [technicians, selected],
  );

  if (available.length === 0) {
    return (
      <p className="rounded-md border border-dashed border-border p-3 text-center text-sm text-muted-foreground">
        All technicians are selected. Remove one to add another.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
      {available.slice(0, 9).map((t) => (
        <button
          key={t.id}
          onClick={() => onToggle(t)}
          className="flex items-center gap-2 rounded-md border border-border bg-background p-2 text-left text-sm transition-colors hover:border-primary hover:bg-accent"
        >
          <Avatar className="h-8 w-8 border">
            {t.avatarUrl ? <AvatarImage src={t.avatarUrl} alt="" /> : null}
            <AvatarFallback className="text-[10px]">{initials(t.displayName)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-medium">{t.displayName}</p>
            <p className="flex items-center gap-1 text-[10px] text-muted-foreground">
              <Star className="h-3 w-3 fill-amber-400 text-amber-400" aria-hidden />
              {t.rating.toFixed(1)} · {t.completedJobs} jobs
            </p>
          </div>
          <Plus className="h-4 w-4 text-primary" aria-hidden />
        </button>
      ))}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────────
// Comparison desktop table
// ────────────────────────────────────────────────────────────────────────────────

type RowDef = {
  label: string;
  // returns the value to display, plus optional best-wins info.
  value: (t: Technician) => string;
  // higher = larger-is-better, lower = smaller-is-better, null = neutral
  best?: (t: Technician) => number | null;
  bestDirection?: "higher" | "lower";
};

const ROWS: RowDef[] = [
  {
    label: "Rating",
    value: (t) => `${t.rating.toFixed(1)} ★ (${t.ratingCount})`,
    best: (t) => t.rating,
    bestDirection: "higher",
  },
  {
    label: "Completed jobs",
    value: (t) => `${t.completedJobs}`,
    best: (t) => t.completedJobs,
    bestDirection: "higher",
  },
  {
    label: "Years experience",
    value: (t) => `${t.yearsExperience} yrs`,
    best: (t) => t.yearsExperience,
    bestDirection: "higher",
  },
  {
    label: "Response time",
    value: (t) => `~${t.responseTimeHours}h`,
    best: (t) => t.responseTimeHours,
    bestDirection: "lower",
  },
  {
    label: "Call-out fee",
    value: (t) => (t.baseCallOutFee != null ? formatCurrency(t.baseCallOutFee) : "—"),
    best: (t) => (t.baseCallOutFee != null ? t.baseCallOutFee : null),
    bestDirection: "lower",
  },
  {
    label: "Hourly rate",
    value: (t) => (t.hourlyRate != null ? formatCurrency(t.hourlyRate) : "—"),
    best: (t) => (t.hourlyRate != null ? t.hourlyRate : null),
    bestDirection: "lower",
  },
  {
    label: "Verified",
    value: (t) => (t.verified ? "Yes" : "No"),
    best: (t) => (t.verified ? 1 : 0),
    bestDirection: "higher",
  },
  {
    label: "Availability",
    value: (t) => t.availability.replaceAll("_", " ").toLowerCase(),
  },
  {
    label: "Skills count",
    value: (t) => `${t.skills.length}`,
    best: (t) => t.skills.length,
    bestDirection: "higher",
  },
  {
    label: "Service areas",
    value: (t) =>
      t.serviceAreas.length === 0
        ? "—"
        : t.serviceAreas.map((a) => a.serviceArea.name).join(", "),
  },
];

function bestIdsForRow(row: RowDef, techs: Technician[]): Set<string> {
  if (!row.best || !row.bestDirection) return new Set();
  const valued = techs
    .map((t) => ({ id: t.id, v: row.best!(t) }))
    .filter((x) => x.v != null) as { id: string; v: number }[];
  if (valued.length === 0) return new Set();
  const target = row.bestDirection === "higher"
    ? Math.max(...valued.map((x) => x.v))
    : Math.min(...valued.map((x) => x.v));
  return new Set(valued.filter((x) => x.v === target).map((x) => x.id));
}

function ComparisonTable({
  techs,
  onRemove,
}: {
  techs: Technician[];
  onRemove: (id: string) => void;
}) {
  return (
    <Card className="overflow-hidden">
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-32 bg-muted/40 text-xs uppercase text-muted-foreground">
                  Attribute
                </TableHead>
                {techs.map((t) => (
                  <TableHead key={t.id} className="bg-muted/40">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex min-w-0 items-center gap-2">
                          <Avatar className="h-7 w-7 border">
                            {t.avatarUrl ? <AvatarImage src={t.avatarUrl} alt="" /> : null}
                            <AvatarFallback className="text-[10px]">
                              {initials(t.displayName)}
                            </AvatarFallback>
                          </Avatar>
                          <span className="truncate text-sm font-semibold">
                            {t.displayName}
                          </span>
                        </div>
                        <button
                          onClick={() => onRemove(t.id)}
                          aria-label={`Remove ${t.displayName}`}
                          className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                        >
                          <X className="h-3.5 w-3.5" aria-hidden />
                        </button>
                      </div>
                      {t.verified && (
                        <Badge
                          variant="outline"
                          className="w-fit gap-1 border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300"
                        >
                          <BadgeCheck className="h-3 w-3" aria-hidden /> Verified
                        </Badge>
                      )}
                    </div>
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {ROWS.map((row) => {
                const bestIds = bestIdsForRow(row, techs);
                return (
                  <TableRow key={row.label}>
                    <TableCell className="bg-muted/20 text-xs font-medium uppercase text-muted-foreground">
                      {row.label}
                    </TableCell>
                    {techs.map((t) => {
                      const isBest = bestIds.has(t.id);
                      return (
                        <TableCell
                          key={t.id}
                          className={`relative align-top text-sm ${
                            isBest ? "bg-emerald-50 font-medium dark:bg-emerald-950/40" : ""
                          }`}
                        >
                          <div className="flex items-center gap-1.5">
                            <span>{row.value(t)}</span>
                            {isBest && (
                              <Sparkles
                                className="h-3.5 w-3.5 text-emerald-600"
                                aria-label="Best value"
                              />
                            )}
                          </div>
                        </TableCell>
                      );
                    })}
                  </TableRow>
                );
              })}
              <TableRow>
                <TableCell className="bg-muted/20 text-xs font-medium uppercase text-muted-foreground">
                  Action
                </TableCell>
                {techs.map((t) => (
                  <TableCell key={t.id}>
                    <Button
                      size="sm"
                      className="w-full"
                      onClick={() => navigate(`technicians/${t.id}`)}
                    >
                      Book this technician
                      <ArrowRight className="h-4 w-4" aria-hidden />
                    </Button>
                  </TableCell>
                ))}
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

// ────────────────────────────────────────────────────────────────────────────────
// Mobile: stacked cards
// ────────────────────────────────────────────────────────────────────────────────

function ComparisonCards({
  techs,
  onRemove,
}: {
  techs: Technician[];
  onRemove: (id: string) => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {techs.map((t) => {
        const bestForRow = (row: RowDef) => bestIdsForRow(row, techs).has(t.id);
        return (
          <Card key={t.id}>
            <CardContent className="space-y-3 p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Avatar className="h-10 w-10 border">
                    {t.avatarUrl ? <AvatarImage src={t.avatarUrl} alt="" /> : null}
                    <AvatarFallback className="text-xs">{initials(t.displayName)}</AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-semibold leading-tight">{t.displayName}</p>
                    {t.verified && (
                      <Badge
                        variant="outline"
                        className="mt-0.5 gap-1 border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300"
                      >
                        <BadgeCheck className="h-3 w-3" aria-hidden /> Verified
                      </Badge>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => onRemove(t.id)}
                  aria-label={`Remove ${t.displayName}`}
                  className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <X className="h-4 w-4" aria-hidden />
                </button>
              </div>

              <dl className="grid grid-cols-1 gap-1.5 text-sm">
                {ROWS.map((row) => {
                  const isBest = bestForRow(row);
                  return (
                    <div
                      key={row.label}
                      className={`flex items-start justify-between gap-2 rounded-md px-2 py-1 ${
                        isBest ? "bg-emerald-50 dark:bg-emerald-950/40" : ""
                      }`}
                    >
                      <dt className="flex items-center gap-1 text-xs text-muted-foreground">
                        {isBest && <Sparkles className="h-3 w-3 text-emerald-600" aria-hidden />}
                        {row.label}
                      </dt>
                      <dd className="text-right text-sm font-medium">{row.value(t)}</dd>
                    </div>
                  );
                })}
              </dl>

              <Button
                size="sm"
                className="w-full"
                onClick={() => navigate(`technicians/${t.id}`)}
              >
                Book this technician
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Button>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────────
// Main
// ────────────────────────────────────────────────────────────────────────────────

export function CompareScreen() {
  const { status } = useSession();
  const { data, isLoading, isError, error, refetch } = useApi<{ technicians: Technician[] }>(
    ["technicians", "for-compare"],
    "/api/technicians",
  );

  const [selected, setSelected] = useState<Technician[]>([]);

  const toggle = (t: Technician) => {
    setSelected((prev) => {
      if (prev.some((p) => p.id === t.id)) {
        return prev.filter((p) => p.id !== t.id);
      }
      if (prev.length >= MAX_COMPARE) {
        toast.info(`You can compare up to ${MAX_COMPARE} technicians at a time.`);
        return prev;
      }
      return [...prev, t];
    });
  };

  const remove = (id: string) => {
    setSelected((prev) => prev.filter((p) => p.id !== id));
  };

  if (status === "loading" || isLoading) {
    return (
      <PageContainer>
        <PageHeader title="Compare technicians" />
        <LoadingState label="Loading technicians…" />
      </PageContainer>
    );
  }

  if (isError) {
    return (
      <PageContainer>
        <PageHeader title="Compare technicians" />
        <ErrorState
          title="Could not load technicians"
          detail={(error as Error)?.message}
          onRetry={() => refetch()}
        />
      </PageContainer>
    );
  }

  const technicians = data?.technicians ?? [];

  return (
    <PageContainer>
      <PageHeader
        title="Compare technicians"
        description="Pick up to 3 technicians to compare side-by-side. Best value per row is highlighted."
      />

      {selected.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground">
            Comparing {selected.length}/{MAX_COMPARE}:
          </span>
          {selected.map((t) => (
            <Badge
              key={t.id}
              variant="secondary"
              className="gap-1 py-1 pl-2 pr-1 text-xs"
            >
              {t.displayName}
              <button
                onClick={() => remove(t.id)}
                aria-label={`Remove ${t.displayName}`}
                className="rounded p-0.5 hover:bg-muted"
              >
                <X className="h-3 w-3" aria-hidden />
              </button>
            </Badge>
          ))}
        </div>
      )}

      {selected.length === 0 ? (
        technicians.length === 0 ? (
          <EmptyState
            icon={Wrench}
            title="No technicians available"
            description="There are no active technicians to compare right now."
          />
        ) : (
          <Card>
            <CardContent className="space-y-3 p-4">
              <p className="flex items-center gap-2 text-sm font-medium">
                <GitCompareArrows className="h-4 w-4 text-primary" aria-hidden />
                Select technicians to compare
              </p>
              <p className="text-xs text-muted-foreground">
                Add 2–3 technicians to see a side-by-side comparison of rating, fees,
                experience, availability, and more.
              </p>
              <TechnicianPicker
                technicians={technicians}
                selected={selected}
                onToggle={toggle}
              />
            </CardContent>
          </Card>
        )
      ) : (
        <div className="space-y-4">
          {/* Desktop: table; Mobile: cards */}
          <div className="hidden md:block">
            <ComparisonTable techs={selected} onRemove={remove} />
          </div>
          <div className="md:hidden">
            <ComparisonCards techs={selected} onRemove={remove} />
          </div>

          {selected.length < MAX_COMPARE && (
            <Card>
              <CardContent className="space-y-3 p-4">
                <p className="flex items-center gap-2 text-sm font-medium">
                  <Plus className="h-4 w-4 text-primary" aria-hidden />
                  Add another technician
                </p>
                <TechnicianPicker
                  technicians={technicians}
                  selected={selected}
                  onToggle={toggle}
                />
              </CardContent>
            </Card>
          )}
        </div>
      )}

      <div className="mt-8 rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
        <p className="flex items-center gap-2 font-medium text-foreground">
          <Sparkles className="h-4 w-4 text-primary" aria-hidden /> How to read this
        </p>
        <p className="mt-1">
          The highlighted cell in each row marks the best value (highest rating, lowest fee,
          fastest response, etc.). For verified status, only verified technicians are
          eligible. Where every selected technician ties, all are highlighted.
        </p>
        <div className="mt-2 flex flex-wrap gap-3 text-xs">
          <span className="inline-flex items-center gap-1">
            <Star className="h-3 w-3 fill-amber-400 text-amber-400" aria-hidden /> Rating
          </span>
          <span className="inline-flex items-center gap-1">
            <Timer className="h-3 w-3" aria-hidden /> Response time
          </span>
          <span className="inline-flex items-center gap-1">
            <Clock className="h-3 w-3" aria-hidden /> Hours
          </span>
          <span className="inline-flex items-center gap-1">
            <MapPin className="h-3 w-3" aria-hidden /> Service areas
          </span>
          <span className="inline-flex items-center gap-1">
            <Check className="h-3 w-3 text-emerald-600" aria-hidden /> Best value
          </span>
        </div>
      </div>
    </PageContainer>
  );
}

export default CompareScreen;
