"use client";

import { useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import {
  BadgeCheck,
  ChevronRight,
  Filter,
  MapPin,
  Search,
  Sparkles,
  Star,
  Timer,
  Wrench,
} from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
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

type Review = {
  id: string;
  rating: number;
  title?: string | null;
  body?: string | null;
  createdAt: string;
};

type Technician = {
  id: string;
  displayName: string;
  bio?: string | null;
  avatarUrl?: string | null;
  phone?: string | null;
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
  reviews: Review[];
};

type Match = {
  id: string;
  technicianId: string;
  score: number;
  rank: number;
  explanationJson: string;
};

type RepairRequest = {
  id: string;
  status: string;
  notes?: string | null;
  problem?: { id: string; description: string; category?: { slug: string; name: string } | null };
  matches: (Match & { technician?: Technician })[];
};

type EquipmentCategory = { id: string; slug: string; name: string };

type Explanation = {
  skillScore: number;
  equipmentScore: number;
  distanceScore: number;
  availabilityScore: number;
  ratingScore: number;
  priceScore: number;
  total: number;
  distanceKm: number | null;
  reasons: string[];
};

// ────────────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────────────

const ADDIS_AREAS = [
  "Bole",
  "Kazanchis",
  "Piazza",
  "Arada",
  "Kirkos",
  "Yeka",
  "Lideta",
  "Nifas Silk-Lafto",
  "Kolfe Keranio",
  "Gulele",
];

function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase())
    .join("");
}

function parseExplanation(json: string): Explanation | null {
  try {
    return JSON.parse(json) as Explanation;
  } catch {
    return null;
  }
}

// ────────────────────────────────────────────────────────────────────────────────
// Technician card
// ────────────────────────────────────────────────────────────────────────────────

function TechnicianCard({
  tech,
  match,
  requestId,
  onSelect,
  isSelecting,
}: {
  tech: Technician;
  match?: Match;
  requestId?: string;
  onSelect: (tech: Technician) => void;
  isSelecting: boolean;
}) {
  const [open, setOpen] = useState(false);
  const explanation = match ? parseExplanation(match.explanationJson) : null;

  return (
    <Card className="overflow-hidden">
      <CardContent className="flex flex-col gap-4 p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <Avatar className="h-12 w-12 border">
            {tech.avatarUrl ? <AvatarImage src={tech.avatarUrl} alt="" /> : null}
            <AvatarFallback>{initials(tech.displayName)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="truncate font-semibold leading-tight">{tech.displayName}</h3>
              {tech.verified && (
                <Badge variant="outline" className="gap-1 border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300">
                  <BadgeCheck className="h-3.5 w-3.5" /> Verified
                </Badge>
              )}
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                <span className="font-medium text-foreground">{tech.rating.toFixed(1)}</span>
                <span>({tech.ratingCount})</span>
              </span>
              <span className="inline-flex items-center gap-1">
                <Wrench className="h-3.5 w-3.5" />
                {tech.completedJobs} jobs
              </span>
              <span className="inline-flex items-center gap-1">
                <Timer className="h-3.5 w-3.5" />
                ~{tech.responseTimeHours}h
              </span>
              <span className="inline-flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5" />
                {tech.yearsExperience}y exp
              </span>
            </div>
          </div>
          {match && (
            <div className="text-right">
              <div className="text-xs text-muted-foreground">Match score</div>
              <div className="text-lg font-bold text-primary">
                {Math.round((match.score ?? explanation?.total ?? 0) * 100)}%
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={tech.availability} />
          {tech.baseCallOutFee != null && (
            <Badge variant="outline" className="font-medium">
              Call-out {formatCurrency(tech.baseCallOutFee)}
            </Badge>
          )}
        </div>

        {tech.skills.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {tech.skills.slice(0, 5).map((s) => (
              <Badge key={s.id} variant="secondary" className="text-xs">
                {s.skill.replaceAll("_", " ")}
              </Badge>
            ))}
            {tech.skills.length > 5 && (
              <Badge variant="secondary" className="text-xs">
                +{tech.skills.length - 5} more
              </Badge>
            )}
          </div>
        )}

        {tech.serviceAreas.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {tech.serviceAreas.slice(0, 4).map((a) => (
              <Badge key={a.id} variant="outline" className="gap-1 text-xs text-muted-foreground">
                <MapPin className="h-3 w-3" /> {a.serviceArea.name}
              </Badge>
            ))}
          </div>
        )}

        {explanation && (
          <Collapsible open={open} onOpenChange={setOpen}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="w-full justify-between text-primary">
                <span className="inline-flex items-center gap-1.5">
                  <Sparkles className="h-4 w-4" />
                  Why this technician?
                </span>
                <ChevronRight
                  className={`h-4 w-4 transition-transform ${open ? "rotate-90" : ""}`}
                />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="mt-2 rounded-md border border-border bg-muted/30 p-3 text-sm">
                {explanation.reasons.length > 0 ? (
                  <ul className="space-y-1.5">
                    {explanation.reasons.map((r, i) => (
                      <li key={i} className="flex items-start gap-2 text-muted-foreground">
                        <BadgeCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />
                        <span className="text-foreground">{r}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-muted-foreground">No detailed explanation available.</p>
                )}
                {explanation.distanceKm != null && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    ~{Math.round(explanation.distanceKm)} km from you
                  </p>
                )}
                {match && <AIMatchExplanation matchId={match.id} />}
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}

        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            variant="outline"
            size="sm"
            className="flex-1"
            onClick={() => navigate(`technicians/${tech.id}${requestId ? `?requestId=${requestId}` : ""}`)}
          >
            View profile
          </Button>
          {requestId ? (
            <Button
              size="sm"
              className="flex-1"
              onClick={() => onSelect(tech)}
              disabled={isSelecting}
            >
              {isSelecting ? "Selecting…" : "Request this technician"}
            </Button>
          ) : (
            <Button
              size="sm"
              className="flex-1"
              onClick={() => navigate("diagnose?hint=technician")}
            >
              Start a diagnosis
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ────────────────────────────────────────────────────────────────────────────────
// Main screen
// ────────────────────────────────────────────────────────────────────────────────

export function TechniciansScreen() {
  const { status } = useSession();
  const router = useRouter();
  const requestId = (router.route.query.requestId as string) || undefined;

  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string>("all");
  const [minRating, setMinRating] = useState<string>("0");
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [area, setArea] = useState<string>("all");

  // Build the API URL with query params for server-side filtering.
  const techQuery = useMemo(() => {
    const params = new URLSearchParams();
    if (category !== "all") params.set("category", category);
    if (minRating !== "0") params.set("minRating", minRating);
    if (verifiedOnly) params.set("verified", "1");
    if (area !== "all") params.set("area", area);
    const qs = params.toString();
    return qs ? `/api/technicians?${qs}` : "/api/technicians";
  }, [category, minRating, verifiedOnly, area]);

  const { data: techData, isLoading, isError, refetch, error } = useApi<{ technicians: Technician[] }>(
    ["technicians", techQuery],
    techQuery,
  );

  const { data: catData } = useApi<{ categories: EquipmentCategory[] }>(
    ["equipment-categories"],
    "/api/equipment-categories",
  );

  // Repair request context (only when requestId is present).
  const {
    data: reqData,
    isLoading: reqLoading,
  } = useApi<{ requests: RepairRequest[] }>(
    ["repair-requests", "for-marketplace", requestId ?? ""],
    requestId ? "/api/repair-requests" : null,
    { enabled: !!requestId },
  );

  const contextRequest = useMemo(() => {
    if (!reqData?.requests || !requestId) return undefined;
    return reqData.requests.find((r) => r.id === requestId);
  }, [reqData, requestId]);

  // Index matches by technicianId for quick lookup.
  const matchByTech = useMemo(() => {
    const map = new Map<string, Match>();
    contextRequest?.matches?.forEach((m) => {
      if (m.technicianId) map.set(m.technicianId, m);
    });
    return map;
  }, [contextRequest]);

  const selectMutation = useApiMutation<{ request: RepairRequest }>(
    requestId ? `/api/repair-requests/${requestId}/select` : "/api/repair-requests/_/select",
    "POST",
  );

  const technicians = useMemo(() => {
    const list = techData?.technicians ?? [];
    // If we have a context request, sort by match rank.
    if (contextRequest) {
      return [...list].sort((a, b) => {
        const ma = matchByTech.get(a.id)?.score ?? 0;
        const mb = matchByTech.get(b.id)?.score ?? 0;
        return mb - ma;
      });
    }
    return list;
  }, [techData, contextRequest, matchByTech]);

  const filtered = useMemo(() => {
    if (!search.trim()) return technicians;
    const q = search.trim().toLowerCase();
    return technicians.filter(
      (t) =>
        t.displayName.toLowerCase().includes(q) ||
        t.skills.some((s) => s.skill.toLowerCase().includes(q)),
    );
  }, [technicians, search]);

  const onSelect = async (tech: Technician) => {
    if (!requestId) {
      navigate("diagnose?hint=technician");
      return;
    }
    try {
      await selectMutation.mutateAsync({ technicianId: tech.id });
      toast.success(`Selected ${tech.displayName}. You can now book the repair.`);
      navigate(`booking/new?requestId=${requestId}`);
    } catch (e: any) {
      toast.error(e?.message ?? "Could not select technician");
    }
  };

  if (status === "loading" || isLoading) {
    return (
      <PageContainer>
        <PageHeader title="Find a Technician" description="Browse verified technicians in Addis Ababa." />
        <LoadingState label="Loading technicians…" />
      </PageContainer>
    );
  }

  if (isError) {
    return (
      <PageContainer>
        <PageHeader title="Find a Technician" />
        <ErrorState
          title="Could not load technicians"
          detail={(error as Error)?.message}
          onRetry={() => refetch()}
        />
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageHeader
        title="Find a Technician"
        description="Browse verified technicians across Addis Ababa."
      />

      {requestId && (
        <div className="mb-5 rounded-lg border border-primary/30 bg-primary/5 p-4">
          {reqLoading ? (
            <p className="text-sm text-muted-foreground">Loading your repair request…</p>
          ) : contextRequest ? (
            <div className="flex flex-col gap-1">
              <div className="flex flex-wrap items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                <span className="font-medium">
                  Matched technicians for your{" "}
                  <span className="text-primary">
                    {contextRequest.problem?.category?.name ?? "equipment"}
                  </span>{" "}
                  problem
                </span>
                <StatusBadge status={contextRequest.status} />
              </div>
              {contextRequest.problem && (
                <p className="text-sm text-muted-foreground">
                  &ldquo;{contextRequest.problem.description}&rdquo;
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                Ranked by skills, distance, availability, rating, and price. Select one to book.
              </p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Repair request not found.</p>
          )}
        </div>
      )}

      {/* Filters */}
      <Card className="mb-5">
        <CardContent className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1.5">
            <Label htmlFor="search" className="text-xs">Search</Label>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="search"
                placeholder="Name or skill…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Equipment category</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="w-full"><SelectValue placeholder="All categories" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All categories</SelectItem>
                {catData?.categories?.map((c) => (
                  <SelectItem key={c.id} value={c.slug}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Minimum rating</Label>
            <Select value={minRating} onValueChange={setMinRating}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="0">Any rating</SelectItem>
                <SelectItem value="3">3.0+ ★</SelectItem>
                <SelectItem value="4">4.0+ ★</SelectItem>
                <SelectItem value="4.5">4.5+ ★</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Service area</Label>
            <Select value={area} onValueChange={setArea}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All areas</SelectItem>
                {ADDIS_AREAS.map((a) => (
                  <SelectItem key={a} value={a}>{a}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2 sm:col-span-2 lg:col-span-4">
            <Switch id="verified" checked={verifiedOnly} onCheckedChange={setVerifiedOnly} />
            <Label htmlFor="verified" className="text-sm">Verified technicians only</Label>
            <span className="ml-auto inline-flex items-center gap-1 text-xs text-muted-foreground">
              <Filter className="h-3 w-3" />
              {filtered.length} result{filtered.length === 1 ? "" : "s"}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={Wrench}
          title="No technicians match your filters"
          description="Try removing some filters or broadening your search."
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((tech) => (
            <TechnicianCard
              key={tech.id}
              tech={tech}
              match={matchByTech.get(tech.id)}
              requestId={requestId}
              onSelect={onSelect}
              isSelecting={selectMutation.isPending}
            />
          ))}
        </div>
      )}
    </PageContainer>
  );
}

// AI-powered natural-language match explanation, grounded in actual scoring data.
function AIMatchExplanation({ matchId }: { matchId: string }) {
  const [explanation, setExplanation] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [show, setShow] = useState(false);

  async function fetchExplanation() {
    if (explanation) { setShow(!show); return; }
    setLoading(true);
    try {
      const res = await apiFetch<{ explanation: any; fellBack: boolean }>("/api/ai/match-explain", {
        method: "POST",
        body: JSON.stringify({ matchId }),
      });
      if (res.explanation) { setExplanation(res.explanation); setShow(true); }
      else toast.info("AI explanation unavailable.");
    } catch (e: any) { toast.error(e.message); }
    finally { setLoading(false); }
  }

  return (
    <div className="mt-3 border-t border-border pt-2">
      <button
        onClick={fetchExplanation}
        disabled={loading}
        className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline disabled:opacity-50"
      >
        <Sparkles className="h-3 w-3" />
        {loading ? "Analyzing fit…" : show ? "Hide AI summary" : "Get AI summary"}
      </button>
      {show && explanation && (
        <div className="mt-2 space-y-2 rounded-md bg-primary/5 p-2 text-xs">
          <p className="font-medium">{explanation.summary}</p>
          {explanation.keyStrengths?.length > 0 && (
            <div>
              <p className="font-semibold text-primary">Key strengths</p>
              <ul className="list-disc pl-4">{explanation.keyStrengths.map((s: string, i: number) => (<li key={i}>{s}</li>))}</ul>
            </div>
          )}
          {explanation.caveats?.length > 0 && (
            <div>
              <p className="font-semibold text-muted-foreground">Caveats</p>
              <ul className="list-disc pl-4 text-muted-foreground">{explanation.caveats.map((s: string, i: number) => (<li key={i}>{s}</li>))}</ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
