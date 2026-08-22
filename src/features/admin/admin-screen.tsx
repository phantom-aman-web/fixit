"use client";

import { useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import {
  Activity,
  BadgeCheck,
  Ban,
  BarChart3,
  Briefcase,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  DollarSign,
  FileText,
  Gavel,
  HelpCircle,
  Hourglass,
  Lightbulb,
  ListTree,
  MapPin,
  MessageSquare,
  Package,
  ScrollText,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Star,
  Stethoscope,
  Users,
  Wrench,
  X,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  EmptyState,
  ErrorState,
  LoadingState,
  PageContainer,
  PageHeader,
} from "@/components/shared/states";
import { StatusBadge } from "@/components/shared/status-badges";
import { useApi, useApiMutation, apiFetch } from "@/hooks/use-api";
import { navigate } from "@/store/router";
import { formatCurrency, formatDateTime, timeAgo } from "@/lib/format";

// ────────────────────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────────────────────

type Stats = {
  users: number;
  technicians: number;
  jobs: number;
  sessions: number;
  reviews: number;
};

type RecentJob = {
  id: string;
  status: string;
  createdAt: string;
  booking?: {
    id: string;
    customer?: { user?: { name?: string | null; email?: string | null } | null } | null;
    technician?: { id: string; displayName: string } | null;
    repairRequest?: { problem?: { category?: { name: string } | null } | null } | null;
  } | null;
};

type TechnicianRow = {
  id: string;
  displayName: string;
  status: string;
  verified: boolean;
  rating: number;
  ratingCount: number;
  completedJobs: number;
  availability: string;
  user: { email: string; name?: string | null };
  skills: { id: string; skill: string }[];
  serviceAreas: { id: string; serviceArea: { name: string } }[];
};

type DiagnosticOption = { id: string; value: string; label: string };
type DiagnosticQuestion = {
  id: string;
  key: string;
  text: string;
  inputType: string;
  required: boolean;
  options: DiagnosticOption[];
};
type DiagnosticSymptom = { id: string; slug: string; name: string; questions: DiagnosticQuestion[] };
type TroubleshootingStep = { id: string; title: string; description: string; difficulty: string; safetyLevel: string; estimatedMinutes: number };
type PossibleCause = { id: string; slug: string; name: string; description?: string | null; riskLevel: string; troubleshootingSteps: TroubleshootingStep[] };
type DiagnosticCategory = {
  id: string;
  slug: string;
  name: string;
  symptoms: DiagnosticSymptom[];
  possibleCauses: PossibleCause[];
};

// ────────────────────────────────────────────────────────────────────────────────
// Stat card
// ────────────────────────────────────────────────────────────────────────────────

function StatCard({ icon: Icon, label, value }: { icon: any; label: string; value: number }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary">
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-2xl font-bold leading-tight">{value.toLocaleString()}</p>
        </div>
      </CardContent>
    </Card>
  );
}

// ────────────────────────────────────────────────────────────────────────────────
// Recent jobs table
// ────────────────────────────────────────────────────────────────────────────────

function RecentJobsTable({ jobs }: { jobs: RecentJob[] }) {
  if (jobs.length === 0) {
    return <EmptyState icon={Briefcase} title="No jobs yet" description="Recent jobs will appear here." />;
  }
  return (
    <Card>
      <CardContent className="p-0">
        <ScrollArea className="max-h-[480px]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Job</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Technician</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {jobs.map((j) => (
                <TableRow key={j.id}>
                  <TableCell className="font-mono text-xs">{j.id.slice(-6).toUpperCase()}</TableCell>
                  <TableCell className="text-sm">{j.booking?.customer?.user?.name ?? j.booking?.customer?.user?.email ?? "—"}</TableCell>
                  <TableCell className="text-sm">{j.booking?.technician?.displayName ?? "—"}</TableCell>
                  <TableCell className="text-sm">{j.booking?.repairRequest?.problem?.category?.name ?? "—"}</TableCell>
                  <TableCell><StatusBadge status={j.status} /></TableCell>
                  <TableCell className="text-xs text-muted-foreground">{timeAgo(j.createdAt)}</TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="ghost" onClick={() => navigate(`repair/${j.id}`)}>
                      Open
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

// ────────────────────────────────────────────────────────────────────────────────
// Technicians tab
// ────────────────────────────────────────────────────────────────────────────────

function TechnicianAdminRow({ tech, onAction }: { tech: TechnicianRow; onAction: () => void }) {
  const patch = useApiMutation(`/api/admin/technicians/${tech.id}`, "PATCH");

  const setStatus = async (status: "ACTIVE" | "SUSPENDED") => {
    try {
      await patch.mutateAsync({ status });
      toast.success(`${tech.displayName} is now ${status.toLowerCase()}.`);
      onAction();
    } catch (e: any) {
      toast.error(e?.message ?? "Could not update technician");
    }
  };

  return (
    <Card>
      <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium">{tech.displayName}</span>
            {tech.verified && (
              <Badge variant="outline" className="gap-1 border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300">
                <BadgeCheck className="h-3 w-3" /> Verified
              </Badge>
            )}
            <StatusBadge status={tech.status} />
            <StatusBadge status={tech.availability} />
          </div>
          <p className="mt-1 text-xs text-muted-foreground">{tech.user.email}</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span>★ {tech.rating.toFixed(1)} ({tech.ratingCount})</span>
            <span>{tech.completedJobs} jobs</span>
            {tech.skills.length > 0 && (
              <span>{tech.skills.length} skills</span>
            )}
          </div>
          {tech.serviceAreas.length > 0 && (
            <div className="mt-1.5 flex flex-wrap items-center gap-1">
              {tech.serviceAreas.slice(0, 5).map((a) => (
                <Badge key={a.id} variant="secondary" className="gap-1 text-[10px]">
                  <MapPin className="h-2.5 w-2.5" /> {a.serviceArea.name}
                </Badge>
              ))}
            </div>
          )}
        </div>
        <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
          {tech.status !== "ACTIVE" ? (
            <Button onClick={() => setStatus("ACTIVE")} disabled={patch.isPending} size="sm" variant="outline">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" /> Activate
            </Button>
          ) : (
            <Button onClick={() => setStatus("SUSPENDED")} disabled={patch.isPending} size="sm" variant="outline">
              <Ban className="h-4 w-4 text-destructive" /> Suspend
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function AdminTechniciansTab() {
  const { data, isLoading, isError, error, refetch } = useApi<{ technicians: TechnicianRow[] }>(
    ["admin-technicians"],
    "/api/admin/technicians",
  );

  if (isLoading) return <LoadingState label="Loading technicians…" />;
  if (isError) {
    return (
      <ErrorState
        title="Could not load technicians"
        detail={(error as Error)?.message}
        onRetry={() => refetch()}
      />
    );
  }

  const techs = data?.technicians ?? [];
  if (techs.length === 0) {
    return <EmptyState icon={Users} title="No technicians" description="No technician profiles have been created yet." />;
  }

  return (
    <div className="space-y-3">
      {techs.map((t) => <TechnicianAdminRow key={t.id} tech={t} onAction={() => refetch()} />)}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────────
// Diagnostics tab — read-only tree
// ────────────────────────────────────────────────────────────────────────────────

function DiagnosticsTree({ categories }: { categories: DiagnosticCategory[] }) {
  if (categories.length === 0) {
    return <EmptyState icon={Stethoscope} title="No diagnostic content" description="Seed the diagnostic content to populate this tree." />;
  }
  return (
    <div className="space-y-2">
      {categories.map((c) => (
        <CategoryNode key={c.id} category={c} />
      ))}
    </div>
  );
}

function CategoryNode({ category }: { category: DiagnosticCategory }) {
  const [open, setOpen] = useState(false);
  return (
    <Card>
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger asChild>
          <button className="flex w-full items-center justify-between gap-2 p-4 text-left">
            <div className="flex items-center gap-2">
              {open ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
              <ListTree className="h-4 w-4 text-primary" />
              <span className="font-medium">{category.name}</span>
              <Badge variant="secondary" className="text-[10px]">{category.slug}</Badge>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Badge variant="outline">{category.symptoms.length} symptoms</Badge>
              <Badge variant="outline">{category.possibleCauses.length} causes</Badge>
            </div>
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="border-t px-4 py-3">
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {/* Symptoms → Questions */}
              <div>
                <p className="mb-2 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  <Stethoscope className="h-3.5 w-3.5" /> Symptoms
                </p>
                {category.symptoms.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No symptoms.</p>
                ) : (
                  <div className="space-y-2">
                    {category.symptoms.map((s) => (
                      <div key={s.id} className="rounded-md border p-2 text-sm">
                        <p className="font-medium">{s.name}</p>
                        <p className="text-xs text-muted-foreground">{s.slug}</p>
                        {s.questions.length > 0 && (
                          <ul className="mt-1.5 space-y-1.5">
                            {s.questions.map((q) => (
                              <li key={q.id} className="rounded bg-muted/30 p-2 text-xs">
                                <p className="flex items-center gap-1.5">
                                  <HelpCircle className="h-3 w-3 text-primary" />
                                  <span className="font-medium">{q.text}</span>
                                </p>
                                <p className="mt-0.5 text-muted-foreground">
                                  {q.inputType} · {q.required ? "required" : "optional"} · key: <code className="rounded bg-muted px-1">{q.key}</code>
                                </p>
                                {q.options.length > 0 && (
                                  <div className="mt-1 flex flex-wrap gap-1">
                                    {q.options.map((o) => (
                                      <Badge key={o.id} variant="outline" className="text-[10px]">{o.label}</Badge>
                                    ))}
                                  </div>
                                )}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Possible causes → Troubleshooting steps */}
              <div>
                <p className="mb-2 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  <Lightbulb className="h-3.5 w-3.5" /> Possible causes
                </p>
                {category.possibleCauses.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No causes.</p>
                ) : (
                  <div className="space-y-2">
                    {category.possibleCauses.map((c) => (
                      <div key={c.id} className="rounded-md border p-2 text-sm">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-medium">{c.name}</p>
                          <StatusBadge status={c.riskLevel} />
                        </div>
                        {c.description && <p className="mt-0.5 text-xs text-muted-foreground">{c.description}</p>}
                        {c.troubleshootingSteps.length > 0 && (
                          <ul className="mt-1.5 space-y-1">
                            {c.troubleshootingSteps.map((s) => (
                              <li key={s.id} className="rounded bg-muted/30 p-2 text-xs">
                                <p className="flex items-center gap-1.5">
                                  <ClipboardList className="h-3 w-3 text-primary" />
                                  <span className="font-medium">{s.title}</span>
                                </p>
                                <p className="mt-0.5 text-muted-foreground">{s.description}</p>
                                <p className="mt-0.5 text-muted-foreground">
                                  {s.difficulty} · {s.safetyLevel} · ~{s.estimatedMinutes}m
                                </p>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}

function AdminDiagnosticsTab() {
  const { data, isLoading, isError, error, refetch } = useApi<{ categories: DiagnosticCategory[] }>(
    ["admin-diagnostics"],
    "/api/admin/diagnostics",
  );

  if (isLoading) return <LoadingState label="Loading diagnostic content…" />;
  if (isError) {
    return (
      <ErrorState
        title="Could not load diagnostics"
        detail={(error as Error)?.message}
        onRetry={() => refetch()}
      />
    );
  }
  return <DiagnosticsTree categories={data?.categories ?? []} />;
}

// ────────────────────────────────────────────────────────────────────────────────
// Admin jobs tab
// ────────────────────────────────────────────────────────────────────────────────

function AdminJobsTab({ jobs }: { jobs: RecentJob[] }) {
  if (jobs.length === 0) {
    return <EmptyState icon={Briefcase} title="No jobs" description="No jobs have been created yet." />;
  }
  return (
    <Card>
      <CardContent className="p-0">
        <ScrollArea className="max-h-[640px]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Job</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Technician</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {jobs.map((j) => (
                <TableRow key={j.id}>
                  <TableCell className="font-mono text-xs">{j.id.slice(-6).toUpperCase()}</TableCell>
                  <TableCell className="text-sm">{j.booking?.customer?.user?.name ?? j.booking?.customer?.user?.email ?? "—"}</TableCell>
                  <TableCell className="text-sm">{j.booking?.technician?.displayName ?? "—"}</TableCell>
                  <TableCell><StatusBadge status={j.status} /></TableCell>
                  <TableCell className="text-xs text-muted-foreground">{formatDateTime(j.createdAt)}</TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="ghost" onClick={() => navigate(`repair/${j.id}`)}>
                      Open
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

// ────────────────────────────────────────────────────────────────────────────────
// Main
// ────────────────────────────────────────────────────────────────────────────────

export function AdminScreen() {
  const { data: session, status } = useSession();
  const role = session?.user?.role;

  const { data, isLoading, isError, error, refetch } = useApi<{
    stats: Stats;
    recentJobs: RecentJob[];
  }>(["admin-stats"], "/api/admin/stats");

  if (status === "loading") {
    return (
      <PageContainer>
        <LoadingState label="Loading admin…" />
      </PageContainer>
    );
  }

  if (role !== "ADMIN") {
    return (
      <PageContainer>
        <EmptyState
          icon={ShieldAlert}
          title="Not authorized"
          description="This screen is for administrators only."
          action={<Button onClick={() => navigate("auth/signin")}>Sign in</Button>}
        />
      </PageContainer>
    );
  }

  if (isLoading) {
    return (
      <PageContainer>
        <PageHeader title="Admin" description="Manage technicians, jobs, and diagnostic content." />
        <LoadingState label="Loading admin stats…" />
      </PageContainer>
    );
  }

  if (isError) {
    return (
      <PageContainer>
        <PageHeader title="Admin" />
        <ErrorState title="Could not load admin data" detail={(error as Error)?.message} onRetry={() => refetch()} />
      </PageContainer>
    );
  }

  const stats = data?.stats ?? { users: 0, technicians: 0, jobs: 0, sessions: 0, reviews: 0 };
  const recentJobs = data?.recentJobs ?? [];

  return (
    <PageContainer>
      <PageHeader
        title="Admin"
        description="Manage technicians, jobs, and diagnostic content across FixIt."
      />

      {/* Stats */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <StatCard icon={Users} label="Users" value={stats.users} />
        <StatCard icon={Wrench} label="Technicians" value={stats.technicians} />
        <StatCard icon={Briefcase} label="Repair jobs" value={stats.jobs} />
        <StatCard icon={Activity} label="Diag. sessions" value={stats.sessions} />
        <StatCard icon={FileText} label="Reviews" value={stats.reviews} />
      </div>

      <Tabs defaultValue="overview">
        <TabsList className="w-full justify-start overflow-x-auto">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="technicians">Technicians</TabsTrigger>
          <TabsTrigger value="verification">Verification</TabsTrigger>
          <TabsTrigger value="diagnostics">Diagnostic content</TabsTrigger>
          <TabsTrigger value="jobs">Jobs</TabsTrigger>
          <TabsTrigger value="disputes">Disputes</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          <TabsTrigger value="audit">Audit log</TabsTrigger>
          <TabsTrigger value="ai">AI analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4">
          <div className="space-y-4">
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <Activity className="h-5 w-5 text-primary" /> Recent jobs
            </h2>
            <RecentJobsTable jobs={recentJobs} />
          </div>
        </TabsContent>

        <TabsContent value="technicians" className="mt-4">
          <div className="space-y-3">
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <Wrench className="h-5 w-5 text-primary" /> Technicians
            </h2>
            <AdminTechniciansTab />
          </div>
        </TabsContent>

        <TabsContent value="verification" className="mt-4">
          <div className="space-y-3">
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <ShieldCheck className="h-5 w-5 text-primary" /> Verification
            </h2>
            <p className="text-sm text-muted-foreground">
              Review pending technician documents and approve or reject new technician accounts.
            </p>
            <AdminVerificationTab />
          </div>
        </TabsContent>

        <TabsContent value="diagnostics" className="mt-4">
          <div className="space-y-3">
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <Stethoscope className="h-5 w-5 text-primary" /> Diagnostic content
            </h2>
            <p className="text-sm text-muted-foreground">
              Read-only view of categories, symptoms, questions, possible causes, and troubleshooting steps.
            </p>
            <AdminDiagnosticsTab />
          </div>
        </TabsContent>

        <TabsContent value="jobs" className="mt-4">
          <div className="space-y-3">
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <Package className="h-5 w-5 text-primary" /> Jobs
            </h2>
            <AdminJobsTab jobs={recentJobs} />
          </div>
        </TabsContent>

        <TabsContent value="disputes" className="mt-4">
          <div className="space-y-3">
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <Gavel className="h-5 w-5 text-primary" /> Disputes
            </h2>
            <p className="text-sm text-muted-foreground">
              All customer-raised disputes across the platform. Resolve or reject with optional refund.
            </p>
            <AdminDisputesTab />
          </div>
        </TabsContent>

        <TabsContent value="analytics" className="mt-4">
          <div className="space-y-3">
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <BarChart3 className="h-5 w-5 text-primary" /> Platform analytics
            </h2>
            <p className="text-sm text-muted-foreground">
              Operational metrics, revenue, AI usage, and recent audit activity.
            </p>
            <AdminAnalyticsTab />
          </div>
        </TabsContent>

        <TabsContent value="audit" className="mt-4">
          <div className="space-y-3">
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <ScrollText className="h-5 w-5 text-primary" /> Audit log
            </h2>
            <p className="text-sm text-muted-foreground">
              Full audit trail with filters by entity type and action.
            </p>
            <AdminAuditLogTab />
          </div>
        </TabsContent>

        <TabsContent value="ai" className="mt-4">
          <div className="space-y-3">
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <Sparkles className="h-5 w-5 text-primary" /> AI analytics
            </h2>
            <AdminAITab />
          </div>
        </TabsContent>
      </Tabs>
    </PageContainer>
  );
}

// AI analytics tab — shows aggregate AI usage stats.
function AdminAITab() {
  const { data, isLoading, isError, refetch } = useApi<{ stats: any }>(["ai-stats"], "/api/ai/admin/stats");

  if (isLoading) return <LoadingState label="Loading AI analytics…" />;
  if (isError) return <ErrorState onRetry={refetch} />;

  const s = data?.stats;
  if (!s) return <p className="text-muted-foreground">No data.</p>;

  const successRate = s.total > 0 ? Math.round((s.successCount / s.total) * 100) : 0;
  const fallbackRate = s.total > 0 ? Math.round((s.fallbackCount / s.total) * 100) : 0;

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Total AI requests</p><p className="mt-1 text-2xl font-bold">{s.total}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Success rate</p><p className="mt-1 text-2xl font-bold text-emerald-600">{successRate}%</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Fallback rate</p><p className="mt-1 text-2xl font-bold text-amber-600">{fallbackRate}%</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Avg latency</p><p className="mt-1 text-2xl font-bold">{s.avgLatencyMs}ms</p></CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Requests by type</CardTitle></CardHeader>
        <CardContent>
          {s.byType.length === 0 ? (
            <p className="text-sm text-muted-foreground">No AI requests yet.</p>
          ) : (
            <div className="space-y-2">
              {s.byType.map((t: any) => (
                <div key={t.type} className="flex items-center justify-between text-sm">
                  <span className="font-mono">{t.type}</span>
                  <Badge variant="secondary">{t.count}</Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Recent AI activity</CardTitle></CardHeader>
        <CardContent>
          {s.recent.length === 0 ? (
            <p className="text-sm text-muted-foreground">No recent activity.</p>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto scroll-thin">
              {s.recent.map((r: any) => (
                <div key={r.id} className="flex items-center justify-between rounded-md border p-2 text-xs">
                  <div>
                    <p className="font-mono font-medium">{r.requestType}</p>
                    <p className="text-muted-foreground">{r.provider} · {r.status}</p>
                  </div>
                  <div className="text-right">
                    <p>{r.latencyMs}ms</p>
                    <p className="text-muted-foreground">{timeAgo(r.createdAt)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────────
// Verification tab — approve/reject documents + pending technician accounts
// ────────────────────────────────────────────────────────────────────────────────

type TechSkill = { id: string; skill: string; equipmentCategory?: string | null; proficiency: number };
type TechServiceArea = { id: string; serviceArea: { name: string } };

type VerificationTech = {
  id: string;
  displayName: string;
  status: string;
  verified: boolean;
  yearsExperience?: number;
  phone?: string | null;
  user: { id: string; email: string; name?: string | null };
  skills: TechSkill[];
  serviceAreas: TechServiceArea[];
};

type VerificationDocument = {
  id: string;
  type: string;
  fileName: string;
  storageKey: string;
  status: string;
  reviewNote?: string | null;
  createdAt: string;
  technician: VerificationTech;
};

type PendingTech = VerificationTech & {
  documents: VerificationDocument[];
};

type VerificationData = {
  documents: VerificationDocument[];
  pendingTechs: PendingTech[];
};

function SkillBadges({ skills }: { skills: TechSkill[] }) {
  if (skills.length === 0) {
    return <span className="text-xs text-muted-foreground">No skills listed</span>;
  }
  return (
    <div className="flex flex-wrap gap-1">
      {skills.map((s) => (
        <Badge key={s.id} variant="secondary" className="text-[10px]">
          {s.skill}
          {s.equipmentCategory ? ` · ${s.equipmentCategory}` : ""}
          {s.proficiency ? ` · L${s.proficiency}` : ""}
        </Badge>
      ))}
    </div>
  );
}

function ServiceAreaBadges({ areas }: { areas: TechServiceArea[] }) {
  if (areas.length === 0) {
    return <span className="text-xs text-muted-foreground">No service areas</span>;
  }
  return (
    <div className="flex flex-wrap gap-1">
      {areas.map((a) => (
        <Badge key={a.id} variant="outline" className="gap-1 text-[10px]">
          <MapPin className="h-2.5 w-2.5" /> {a.serviceArea.name}
        </Badge>
      ))}
    </div>
  );
}

function DocumentRow({ doc, onAction }: { doc: VerificationDocument; onAction: () => void }) {
  const [submitting, setSubmitting] = useState<null | "ACTIVE" | "SUSPENDED">(null);
  const tech = doc.technician;

  const review = async (status: "ACTIVE" | "SUSPENDED") => {
    setSubmitting(status);
    try {
      await apiFetch(`/api/admin/verification?documentId=${doc.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      toast.success(
        status === "ACTIVE"
          ? `Document approved for ${tech.displayName}.`
          : `Document rejected for ${tech.displayName}.`,
      );
      onAction();
    } catch (e: any) {
      toast.error(e?.message ?? "Could not update document");
    } finally {
      setSubmitting(null);
    }
  };

  return (
    <Card>
      <CardContent className="flex flex-col gap-3 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary" className="text-xs">{doc.type}</Badge>
          <StatusBadge status={doc.status} />
          <span className="ml-auto text-xs text-muted-foreground">{timeAgo(doc.createdAt)}</span>
        </div>
        <div>
          <p className="text-sm font-medium">{tech.displayName}</p>
          <p className="text-xs text-muted-foreground">{tech.user.email}</p>
        </div>
        <div className="rounded-md bg-muted/30 p-2 text-xs">
          <p className="font-mono">{doc.fileName}</p>
          <p className="mt-0.5 text-muted-foreground">storage: {doc.storageKey.slice(0, 24)}…</p>
        </div>
        <div className="space-y-1.5">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Skills</p>
          <SkillBadges skills={tech.skills} />
        </div>
        <div className="space-y-1.5">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Service areas</p>
          <ServiceAreaBadges areas={tech.serviceAreas} />
        </div>
        {doc.status === "PENDING" && (
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              size="sm"
              onClick={() => review("ACTIVE")}
              disabled={submitting !== null}
              className="flex-1"
            >
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              {submitting === "ACTIVE" ? "Approving…" : "Approve"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => review("SUSPENDED")}
              disabled={submitting !== null}
              className="flex-1"
            >
              <X className="h-4 w-4 text-destructive" />
              {submitting === "SUSPENDED" ? "Rejecting…" : "Reject"}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function PendingTechRow({ tech, onAction }: { tech: PendingTech; onAction: () => void }) {
  const [submitting, setSubmitting] = useState<null | "ACTIVE" | "SUSPENDED">(null);

  const review = async (status: "ACTIVE" | "SUSPENDED") => {
    setSubmitting(status);
    try {
      await apiFetch(`/api/admin/verification?technicianId=${tech.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status, verified: status === "ACTIVE" }),
      });
      toast.success(
        status === "ACTIVE"
          ? `${tech.displayName} approved and verified.`
          : `${tech.displayName} rejected.`,
      );
      onAction();
    } catch (e: any) {
      toast.error(e?.message ?? "Could not update technician");
    } finally {
      setSubmitting(null);
    }
  };

  return (
    <Card>
      <CardContent className="flex flex-col gap-3 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={tech.status} />
          {tech.verified && (
            <Badge variant="outline" className="gap-1 border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300">
              <BadgeCheck className="h-3 w-3" /> Verified
            </Badge>
          )}
        </div>
        <div>
          <p className="text-sm font-medium">{tech.displayName}</p>
          <p className="text-xs text-muted-foreground">{tech.user.email}</p>
          {tech.phone && <p className="text-xs text-muted-foreground">{tech.phone}</p>}
        </div>
        <div className="space-y-1.5">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Skills</p>
          <SkillBadges skills={tech.skills} />
        </div>
        <div className="space-y-1.5">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Service areas</p>
          <ServiceAreaBadges areas={tech.serviceAreas} />
        </div>
        {tech.documents.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Documents ({tech.documents.length})
            </p>
            <ul className="space-y-1">
              {tech.documents.map((d) => (
                <li key={d.id} className="flex items-center justify-between rounded-md bg-muted/30 px-2 py-1 text-xs">
                  <span className="truncate font-mono">{d.fileName}</span>
                  <StatusBadge status={d.status} />
                </li>
              ))}
            </ul>
          </div>
        )}
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            size="sm"
            onClick={() => review("ACTIVE")}
            disabled={submitting !== null}
            className="flex-1"
          >
            <ShieldCheck className="h-4 w-4" />
            {submitting === "ACTIVE" ? "Approving…" : "Approve & verify"}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => review("SUSPENDED")}
            disabled={submitting !== null}
            className="flex-1"
          >
            <Ban className="h-4 w-4 text-destructive" />
            {submitting === "SUSPENDED" ? "Rejecting…" : "Reject"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function AdminVerificationTab() {
  const { data, isLoading, isError, error, refetch } = useApi<VerificationData>(
    ["admin-verification"],
    "/api/admin/verification",
  );

  if (isLoading) return <LoadingState label="Loading verification queue…" />;
  if (isError) {
    return (
      <ErrorState
        title="Could not load verification queue"
        detail={(error as Error)?.message}
        onRetry={() => refetch()}
      />
    );
  }

  const documents = data?.documents ?? [];
  const pendingTechs = data?.pendingTechs ?? [];

  if (documents.length === 0 && pendingTechs.length === 0) {
    return (
      <EmptyState
        icon={ShieldCheck}
        title="Nothing to verify"
        description="All documents have been reviewed and all technicians are approved."
      />
    );
  }

  return (
    <div className="space-y-6">
      {pendingTechs.length > 0 && (
        <section>
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
            <Users className="h-4 w-4 text-primary" />
            Pending technicians
            <Badge variant="default">{pendingTechs.length}</Badge>
          </h3>
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {pendingTechs.map((t) => (
              <PendingTechRow key={t.id} tech={t} onAction={() => refetch()} />
            ))}
          </div>
        </section>
      )}
      {documents.length > 0 && (
        <section>
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
            <FileText className="h-4 w-4 text-primary" />
            Pending documents
            <Badge variant="default">{documents.length}</Badge>
          </h3>
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {documents.map((d) => (
              <DocumentRow key={d.id} doc={d} onAction={() => refetch()} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────────
// Disputes tab — list all disputes, expand messages, resolve via dialog
// ────────────────────────────────────────────────────────────────────────────────

type DisputeMessage = {
  id: string;
  authorId: string;
  authorRole: string;
  message: string;
  createdAt: string;
};

type Dispute = {
  id: string;
  reason: string;
  description: string;
  status: string;
  resolution?: string | null;
  refundAmount?: number | null;
  createdAt: string;
  updatedAt: string;
  job: {
    id: string;
    booking: {
      id: string;
      technician?: { id: string; displayName: string; verified: boolean } | null;
      customer?: { user?: { name?: string | null; email?: string | null } | null } | null;
    };
  };
  messages: DisputeMessage[];
};

function ResolveDisputeDialog({ dispute, onResolved }: { dispute: Dispute; onResolved: () => void }) {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<"RESOLVED" | "REJECTED">("RESOLVED");
  const [resolution, setResolution] = useState("");
  const [refundAmount, setRefundAmount] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    setSubmitting(true);
    try {
      await apiFetch(`/api/disputes/${dispute.id}/resolve`, {
        method: "POST",
        body: JSON.stringify({
          status,
          resolution: resolution.trim() || undefined,
          refundAmount: refundAmount ? Math.round(parseFloat(refundAmount) * 100) : undefined,
        }),
      });
      toast.success(`Dispute ${status === "RESOLVED" ? "resolved" : "rejected"}.`);
      setOpen(false);
      onResolved();
    } catch (e: any) {
      toast.error(e?.message ?? "Could not resolve dispute");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Gavel className="h-4 w-4" /> Resolve
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Resolve dispute</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Decision</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as "RESOLVED" | "REJECTED")}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="RESOLVED">Resolved (in customer's favor)</SelectItem>
                <SelectItem value="REJECTED">Rejected (in technician's favor)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="d-resolution">Resolution note (optional)</Label>
            <Textarea
              id="d-resolution"
              rows={4}
              value={resolution}
              onChange={(e) => setResolution(e.target.value)}
              placeholder="Explain the decision to both parties…"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="d-refund">Refund amount in ETB (optional)</Label>
            <Input
              id="d-refund"
              type="number"
              min={0}
              step="0.01"
              value={refundAmount}
              onChange={(e) => setRefundAmount(e.target.value)}
              placeholder="0.00"
            />
            <p className="text-xs text-muted-foreground">
              If non-zero and a succeeded payment exists, a refund will be attempted via the payment provider.
            </p>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button onClick={submit} disabled={submitting}>
              {submitting ? "Submitting…" : "Submit decision"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function DisputeCard({ dispute, onResolved }: { dispute: Dispute; onResolved: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const customerName = dispute.job.booking.customer?.user?.name ?? dispute.job.booking.customer?.user?.email ?? "Customer";
  const techName = dispute.job.booking.technician?.displayName ?? "Technician";
  const isClosed = dispute.status === "RESOLVED" || dispute.status === "REJECTED";

  return (
    <Card>
      <CardContent className="flex flex-col gap-3 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary" className="text-xs">{dispute.reason.replaceAll("_", " ")}</Badge>
          <StatusBadge status={dispute.status} />
          <span className="ml-auto text-xs text-muted-foreground">{timeAgo(dispute.createdAt)}</span>
        </div>
        <p className="line-clamp-3 text-sm">{dispute.description}</p>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span>Customer: <span className="font-medium text-foreground">{customerName}</span></span>
          <span>Tech: <span className="font-medium text-foreground">{techName}</span></span>
        </div>
        {dispute.resolution && (
          <div className="rounded-md bg-muted/40 p-2 text-xs">
            <p className="font-medium">Resolution</p>
            <p className="mt-0.5 text-muted-foreground">{dispute.resolution}</p>
            {dispute.refundAmount ? (
              <p className="mt-1 font-medium text-emerald-700 dark:text-emerald-300">
                Refund: {formatCurrency(dispute.refundAmount)}
              </p>
            ) : null}
          </div>
        )}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setExpanded((v) => !v)}
          >
            <MessageSquare className="h-4 w-4" />
            {dispute.messages.length} message{dispute.messages.length === 1 ? "" : "s"}
            {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </Button>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => navigate(`repair/${dispute.job.id}`)}>
              Open job
            </Button>
            {!isClosed && <ResolveDisputeDialog dispute={dispute} onResolved={onResolved} />}
          </div>
        </div>
        {expanded && (
          <div className="max-h-64 space-y-2 overflow-y-auto rounded-md border border-border bg-muted/20 p-3">
            {dispute.messages.length === 0 ? (
              <p className="text-xs text-muted-foreground">No messages yet.</p>
            ) : (
              dispute.messages.map((m) => (
                <div key={m.id} className="rounded-md bg-background p-2 text-xs shadow-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-medium capitalize">{m.authorRole}</span>
                    <span className="text-muted-foreground">{timeAgo(m.createdAt)}</span>
                  </div>
                  <p className="mt-1 text-foreground">{m.message}</p>
                </div>
              ))
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function AdminDisputesTab() {
  const { data, isLoading, isError, error, refetch } = useApi<{ disputes: Dispute[] }>(
    ["admin-disputes"],
    "/api/disputes",
    { refetchInterval: 30_000 },
  );

  if (isLoading) return <LoadingState label="Loading disputes…" />;
  if (isError) {
    return (
      <ErrorState
        title="Could not load disputes"
        detail={(error as Error)?.message}
        onRetry={() => refetch()}
      />
    );
  }

  const disputes = data?.disputes ?? [];
  if (disputes.length === 0) {
    return (
      <EmptyState
        icon={Gavel}
        title="No disputes"
        description="When customers raise disputes on completed jobs, they'll appear here."
      />
    );
  }

  const open = disputes.filter((d) => d.status === "OPEN" || d.status === "UNDER_REVIEW");
  const closed = disputes.filter((d) => d.status === "RESOLVED" || d.status === "REJECTED");

  return (
    <div className="space-y-6">
      {open.length > 0 && (
        <section>
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
            <Hourglass className="h-4 w-4 text-amber-600" />
            Open disputes
            <Badge variant="default">{open.length}</Badge>
          </h3>
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {open.map((d) => (
              <DisputeCard key={d.id} dispute={d} onResolved={() => refetch()} />
            ))}
          </div>
        </section>
      )}
      {closed.length > 0 && (
        <section>
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            Closed disputes
            <Badge variant="secondary">{closed.length}</Badge>
          </h3>
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {closed.map((d) => (
              <DisputeCard key={d.id} dispute={d} onResolved={() => refetch()} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────────
// Analytics tab — platform-wide metrics + AI stats + recent audit
// ────────────────────────────────────────────────────────────────────────────────

type AnalyticsData = {
  analytics: {
    users: { total: number; customers: number; technicians: number };
    bookings: { total: number; completed: number; cancelled: number };
    revenue: { totalMinorUnits: number; currency: string };
    disputes: { active: number };
    warranties: { openClaims: number };
    verification: { pending: number };
    reviews: { total: number; avgRating: number };
    ai: {
      total: number;
      successCount: number;
      fallbackCount: number;
      avgLatencyMs: number;
      byType?: { type: string; count: number }[];
    };
    recentAudit: {
      id: string;
      actorId?: string | null;
      actorRole?: string | null;
      action: string;
      entityType: string;
      entityId?: string | null;
      metadataJson?: string | null;
      createdAt: string;
    }[];
  };
};

function MetricCard({
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
  tone?: "primary" | "emerald" | "amber" | "destructive" | "sky";
}) {
  const toneClass = {
    primary: "bg-primary/10 text-primary",
    emerald: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
    amber: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
    destructive: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
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

function AdminAnalyticsTab() {
  const { data, isLoading, isError, error, refetch } = useApi<AnalyticsData>(
    ["admin-analytics"],
    "/api/admin/analytics",
  );

  if (isLoading) return <LoadingState label="Loading analytics…" />;
  if (isError) {
    return (
      <ErrorState
        title="Could not load analytics"
        detail={(error as Error)?.message}
        onRetry={() => refetch()}
      />
    );
  }

  const a = data?.analytics;
  if (!a) return <p className="text-muted-foreground">No data.</p>;

  const aiSuccessRate = a.ai.total > 0 ? Math.round((a.ai.successCount / a.ai.total) * 100) : 0;
  const aiFallbackRate = a.ai.total > 0 ? Math.round((a.ai.fallbackCount / a.ai.total) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Users */}
      <section>
        <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
          <Users className="h-4 w-4 text-primary" /> Users
        </h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <MetricCard icon={Users} label="Total users" value={a.users.total.toLocaleString()} />
          <MetricCard icon={Users} label="Customers" value={a.users.customers.toLocaleString()} tone="sky" />
          <MetricCard icon={Wrench} label="Technicians" value={a.users.technicians.toLocaleString()} tone="emerald" />
        </div>
      </section>

      {/* Bookings & revenue */}
      <section>
        <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
          <Briefcase className="h-4 w-4 text-primary" /> Bookings & revenue
        </h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          <MetricCard icon={Briefcase} label="Total bookings" value={a.bookings.total.toLocaleString()} />
          <MetricCard icon={CheckCircle2} label="Completed" value={a.bookings.completed.toLocaleString()} tone="emerald" />
          <MetricCard icon={X} label="Cancelled" value={a.bookings.cancelled.toLocaleString()} tone="destructive" />
          <MetricCard
            icon={DollarSign}
            label="Revenue"
            value={formatCurrency(a.revenue.totalMinorUnits, a.revenue.currency)}
            tone="emerald"
          />
        </div>
      </section>

      {/* Operational */}
      <section>
        <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
          <Activity className="h-4 w-4 text-primary" /> Operations
        </h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          <MetricCard icon={Gavel} label="Active disputes" value={a.disputes.active.toLocaleString()} tone="amber" />
          <MetricCard icon={ShieldCheck} label="Open warranty claims" value={a.warranties.openClaims.toLocaleString()} tone="amber" />
          <MetricCard icon={FileText} label="Pending verifications" value={a.verification.pending.toLocaleString()} tone="amber" />
          <MetricCard
            icon={Star}
            label="Avg rating"
            value={a.reviews.avgRating > 0 ? a.reviews.avgRating.toFixed(1) : "—"}
            sub={`${a.reviews.total} reviews`}
            tone="amber"
          />
        </div>
      </section>

      {/* AI usage */}
      <section>
        <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
          <Sparkles className="h-4 w-4 text-primary" /> AI usage
        </h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <MetricCard icon={Sparkles} label="Total requests" value={a.ai.total.toLocaleString()} />
          <MetricCard icon={CheckCircle2} label="Success rate" value={`${aiSuccessRate}%`} tone="emerald" />
          <MetricCard icon={X} label="Fallback rate" value={`${aiFallbackRate}%`} tone="amber" />
          <MetricCard icon={Activity} label="Avg latency" value={`${a.ai.avgLatencyMs}ms`} tone="sky" />
        </div>
      </section>

      {/* Recent audit */}
      <section>
        <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
          <ScrollText className="h-4 w-4 text-primary" /> Recent audit log
        </h3>
        <Card>
          <CardContent className="p-0">
            <ScrollArea className="max-h-[480px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Action</TableHead>
                    <TableHead>Entity</TableHead>
                    <TableHead>Actor</TableHead>
                    <TableHead>When</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {a.recentAudit.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="py-6 text-center text-sm text-muted-foreground">
                        No audit entries yet.
                      </TableCell>
                    </TableRow>
                  ) : (
                    a.recentAudit.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell className="font-mono text-xs">{log.action}</TableCell>
                        <TableCell className="text-xs">
                          {log.entityType}
                          {log.entityId && (
                            <span className="ml-1 text-muted-foreground">· {log.entityId.slice(-6).toUpperCase()}</span>
                          )}
                        </TableCell>
                        <TableCell className="text-xs">
                          <span className="font-medium">{log.actorRole ?? "system"}</span>
                          {log.actorId && (
                            <span className="ml-1 text-muted-foreground">{log.actorId.slice(-6).toUpperCase()}</span>
                          )}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">{timeAgo(log.createdAt)}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </ScrollArea>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────────
// Audit log tab — full log with filters
// ────────────────────────────────────────────────────────────────────────────────

type AuditLog = {
  id: string;
  actorId?: string | null;
  actorRole?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  metadataJson?: string | null;
  createdAt: string;
};

const ENTITY_TYPES = [
  "booking",
  "repair_job",
  "quote",
  "payment",
  "dispute",
  "technician",
  "technician_document",
  "user",
  "warranty",
  "warranty_claim",
  "review",
  "notification",
  "audit_log",
];

const ACTIONS = [
  "technician_verified",
  "document_reviewed",
  "dispute_created",
  "dispute_resolved",
  "payment_captured",
  "booking_transitioned",
  "quote_submitted",
  "quote_approved",
  "quote_rejected",
  "warranty_claimed",
  "warranty_resolved",
  "review_submitted",
];

function AdminAuditLogTab() {
  const [entityType, setEntityType] = useState<string>("");
  const [action, setAction] = useState<string>("");

  const query = useMemo(() => {
    const params = new URLSearchParams();
    if (entityType) params.set("entityType", entityType);
    if (action) params.set("action", action);
    const qs = params.toString();
    return qs ? `/api/admin/audit-log?${qs}` : "/api/admin/audit-log";
  }, [entityType, action]);

  const { data, isLoading, isError, error, refetch } = useApi<{ logs: AuditLog[] }>(
    ["admin-audit-log", entityType, action],
    query,
  );

  const logs = data?.logs ?? [];

  return (
    <div className="space-y-4">
      {/* Filters */}
      <Card>
        <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-end">
          <div className="flex-1 space-y-1.5">
            <Label className="text-xs">Entity type</Label>
            <Select value={entityType} onValueChange={(v) => setEntityType(v === "all" ? "" : v)}>
              <SelectTrigger>
                <SelectValue placeholder="All entity types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All entity types</SelectItem>
                {ENTITY_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex-1 space-y-1.5">
            <Label className="text-xs">Action</Label>
            <Select value={action} onValueChange={(v) => setAction(v === "all" ? "" : v)}>
              <SelectTrigger>
                <SelectValue placeholder="All actions" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All actions</SelectItem>
                {ACTIONS.map((a) => (
                  <SelectItem key={a} value={a}>{a}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            Refresh
          </Button>
        </CardContent>
      </Card>

      {isLoading ? (
        <LoadingState label="Loading audit log…" />
      ) : isError ? (
        <ErrorState
          title="Could not load audit log"
          detail={(error as Error)?.message}
          onRetry={() => refetch()}
        />
      ) : logs.length === 0 ? (
        <EmptyState
          icon={ScrollText}
          title="No audit entries match"
          description="Try clearing the filters or check back later."
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <ScrollArea className="max-h-[640px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>When</TableHead>
                    <TableHead>Actor</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Entity</TableHead>
                    <TableHead>Details</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((log) => {
                    let details: string | null = null;
                    if (log.metadataJson) {
                      try {
                        details = JSON.stringify(JSON.parse(log.metadataJson));
                      } catch {
                        details = log.metadataJson;
                      }
                    }
                    return (
                      <TableRow key={log.id}>
                        <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                          {formatDateTime(log.createdAt)}
                        </TableCell>
                        <TableCell className="text-xs">
                          <span className="font-medium">{log.actorRole ?? "system"}</span>
                          {log.actorId && (
                            <span className="ml-1 text-muted-foreground">{log.actorId.slice(-6).toUpperCase()}</span>
                          )}
                        </TableCell>
                        <TableCell className="font-mono text-xs">{log.action}</TableCell>
                        <TableCell className="text-xs">
                          {log.entityType}
                          {log.entityId && (
                            <span className="ml-1 text-muted-foreground">· {log.entityId.slice(-6).toUpperCase()}</span>
                          )}
                        </TableCell>
                        <TableCell className="max-w-xs truncate text-xs text-muted-foreground" title={details ?? ""}>
                          {details ?? "—"}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </ScrollArea>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
