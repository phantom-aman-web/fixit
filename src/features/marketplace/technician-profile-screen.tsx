"use client";

import { useMemo } from "react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import {
  ArrowLeft,
  BadgeCheck,
  Briefcase,
  Calendar,
  ClipboardList,
  MapPin,
  MessageSquare,
  Star,
  Timer,
  Wrench,
} from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  EmptyState,
  ErrorState,
  LoadingState,
  PageContainer,
} from "@/components/shared/states";
import { StatusBadge } from "@/components/shared/status-badges";
import { useApi, useApiMutation } from "@/hooks/use-api";
import { navigate, useRouter } from "@/store/router";
import { formatCurrency, timeAgo } from "@/lib/format";

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
  qualityRating?: number | null;
  professionalismRating?: number | null;
  communicationRating?: number | null;
  valueRating?: number | null;
  createdAt: string;
  customer?: { user?: { name?: string | null; email?: string | null } } | null;
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

type RepairRequest = {
  id: string;
  status: string;
  problem?: { id: string; description: string; category?: { slug: string; name: string } | null };
};

function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase())
    .join("");
}

function proficiencyLabel(p: number): string {
  if (p >= 5) return "Expert";
  if (p >= 4) return "Advanced";
  if (p >= 3) return "Intermediate";
  if (p >= 2) return "Familiar";
  return "Beginner";
}

export function TechnicianProfileScreen({ technicianId }: { technicianId: string }) {
  const { status } = useSession();
  const router = useRouter();
  const requestId = (router.route.query.requestId as string) || undefined;

  const { data, isLoading, isError, error, refetch } = useApi<{ technician: Technician }>(
    ["technician", technicianId],
    `/api/technicians/${technicianId}`,
  );

  const { data: reqData } = useApi<{ requests: RepairRequest[] }>(
    ["repair-requests", "for-profile", requestId ?? ""],
    requestId ? "/api/repair-requests" : null,
    { enabled: !!requestId },
  );

  const contextRequest = useMemo(() => {
    if (!reqData?.requests || !requestId) return undefined;
    return reqData.requests.find((r) => r.id === requestId);
  }, [reqData, requestId]);

  const selectMutation = useApiMutation(
    requestId ? `/api/repair-requests/${requestId}/select` : "/api/repair-requests/_/select",
    "POST",
  );

  const tech = data?.technician;

  const onSelect = async () => {
    if (!requestId || !tech) return;
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
        <LoadingState label="Loading technician profile…" />
      </PageContainer>
    );
  }

  if (isError || !tech) {
    return (
      <PageContainer>
        <ErrorState
          title="Technician not found"
          detail={(error as Error)?.message}
          onRetry={() => refetch()}
        />
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <Button
        variant="ghost"
        size="sm"
        className="mb-3 -ml-2"
        onClick={() => navigate("technicians")}
      >
        <ArrowLeft className="h-4 w-4" /> Back to technicians
      </Button>

      {/* Header */}
      <Card className="mb-5">
        <CardContent className="flex flex-col gap-4 p-4 sm:p-6 md:flex-row md:items-start">
          <Avatar className="h-20 w-20 border">
            {tech.avatarUrl ? <AvatarImage src={tech.avatarUrl} alt="" /> : null}
            <AvatarFallback className="text-xl">{initials(tech.displayName)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight">{tech.displayName}</h1>
              {tech.verified && (
                <Badge variant="outline" className="gap-1 border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300">
                  <BadgeCheck className="h-3.5 w-3.5" /> Verified
                </Badge>
              )}
              <StatusBadge status={tech.availability} />
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                <span className="font-semibold text-foreground">{tech.rating.toFixed(1)}</span>
                <span>({tech.ratingCount} reviews)</span>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Briefcase className="h-4 w-4" /> {tech.completedJobs} jobs completed
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Calendar className="h-4 w-4" /> {tech.yearsExperience} years experience
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Timer className="h-4 w-4" /> ~{tech.responseTimeHours}h response
              </span>
            </div>
            {tech.bio && <p className="mt-3 text-sm text-foreground">{tech.bio}</p>}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {tech.baseCallOutFee != null && (
                <Badge variant="outline" className="font-medium">
                  Call-out fee {formatCurrency(tech.baseCallOutFee)}
                </Badge>
              )}
              {tech.hourlyRate != null && (
                <Badge variant="outline" className="font-medium">
                  {formatCurrency(tech.hourlyRate)}/hr
                </Badge>
              )}
              {tech.phone && (
                <Badge variant="secondary" className="font-medium">{tech.phone}</Badge>
              )}
            </div>
          </div>

          <div className="flex w-full shrink-0 flex-col gap-2 md:w-56">
            {requestId ? (
              <Button onClick={onSelect} disabled={selectMutation.isPending}>
                {selectMutation.isPending ? "Selecting…" : "Request this technician"}
              </Button>
            ) : (
              <Button onClick={() => navigate("diagnose?hint=technician")}>
                <Wrench className="h-4 w-4" /> Start a diagnosis
              </Button>
            )}
            <p className="text-center text-xs text-muted-foreground">
              {requestId
                ? "Selects this technician for your active repair request."
                : "Run a diagnostic first, then we'll match you with the right technician."}
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {/* Left column: skills + areas */}
        <div className="space-y-5 lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Wrench className="h-4 w-4 text-primary" /> Specialties &amp; Skills
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {tech.skills.length === 0 ? (
                <p className="text-sm text-muted-foreground">No skills listed.</p>
              ) : (
                tech.skills.map((s) => (
                  <div key={s.id} className="space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium capitalize">
                        {s.skill.replaceAll("_", " ")}
                      </span>
                      <span className="text-xs text-muted-foreground">{proficiencyLabel(s.proficiency)}</span>
                    </div>
                    <Progress value={(s.proficiency / 5) * 100} className="h-1.5" />
                    {s.equipmentCategory && (
                      <p className="text-xs text-muted-foreground">
                        {s.equipmentCategory.replaceAll("_", " ")}
                      </p>
                    )}
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <MapPin className="h-4 w-4 text-primary" /> Service Areas
              </CardTitle>
            </CardHeader>
            <CardContent>
              {tech.serviceAreas.length === 0 ? (
                <p className="text-sm text-muted-foreground">No service areas listed.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {tech.serviceAreas.map((a) => (
                    <Badge key={a.id} variant="outline" className="gap-1">
                      <MapPin className="h-3 w-3" /> {a.serviceArea.name}
                    </Badge>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {contextRequest && (
            <Card className="border-primary/30 bg-primary/5">
              <CardContent className="p-4 text-sm">
                <p className="font-medium">Active repair request</p>
                <p className="mt-1 text-muted-foreground">
                  {contextRequest.problem?.description ?? "Selected for your problem."}
                </p>
                <Button size="sm" className="mt-3 w-full" onClick={onSelect} disabled={selectMutation.isPending}>
                  {selectMutation.isPending ? "Selecting…" : "Request this technician"}
                </Button>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right column: reviews */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <MessageSquare className="h-4 w-4 text-primary" /> Reviews
                <span className="ml-1 text-sm font-normal text-muted-foreground">
                  ({tech.reviews.length})
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {tech.reviews.length === 0 ? (
                <div className="px-6 pb-6">
                  <EmptyState
                    icon={ClipboardList}
                    title="No reviews yet"
                    description="This technician hasn't received any reviews."
                  />
                </div>
              ) : (
                <ScrollArea className="max-h-[600px]">
                  <div className="divide-y">
                    {tech.reviews.map((r) => (
                      <div key={r.id} className="px-6 py-4">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">
                              {r.customer?.user?.name ?? r.customer?.user?.email ?? "Anonymous"}
                            </span>
                            <span className="inline-flex items-center gap-0.5 text-xs">
                              {Array.from({ length: 5 }).map((_, i) => (
                                <Star
                                  key={i}
                                  className={`h-3.5 w-3.5 ${
                                    i < r.rating
                                      ? "fill-amber-400 text-amber-400"
                                      : "text-muted-foreground/30"
                                  }`}
                                />
                              ))}
                            </span>
                          </div>
                          <span className="text-xs text-muted-foreground">{timeAgo(r.createdAt)}</span>
                        </div>
                        {r.title && <p className="mt-1.5 font-medium">{r.title}</p>}
                        {r.body && <p className="mt-1 text-sm text-muted-foreground">{r.body}</p>}
                        {(r.qualityRating || r.professionalismRating || r.communicationRating || r.valueRating) && (
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {r.qualityRating && (
                              <Badge variant="secondary" className="text-xs">Quality {r.qualityRating}/5</Badge>
                            )}
                            {r.professionalismRating && (
                              <Badge variant="secondary" className="text-xs">Pro {r.professionalismRating}/5</Badge>
                            )}
                            {r.communicationRating && (
                              <Badge variant="secondary" className="text-xs">Comms {r.communicationRating}/5</Badge>
                            )}
                            {r.valueRating && (
                              <Badge variant="secondary" className="text-xs">Value {r.valueRating}/5</Badge>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </PageContainer>
  );
}
