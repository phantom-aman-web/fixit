"use client";

import { useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import {
  CalendarClock,
  ChevronRight,
  ClipboardList,
  ShieldCheck,
  Wrench,
  Plus,
  FileText,
} from "lucide-react";

import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MediaUploader } from "@/components/shared/media-uploader";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  PageContainer,
  PageHeader,
  ListSkeleton,
  ErrorState,
  EmptyState,
} from "@/components/shared/states";
import { StatusBadge } from "@/components/shared/status-badges";
import { useApi, useApiMutation } from "@/hooks/use-api";
import { navigate } from "@/store/router";
import { formatDate } from "@/lib/format";
import { ContextualSearch, type SearchResultItem } from "@/components/search/contextual-search";
import { scoreItem } from "@/lib/search/ranking";

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
  documentUrl?: string | null;
  job: {
    id: string;
    booking: {
      id: string;
      technician: { id: string; displayName: string; verified: boolean };
      repairRequest: { problem?: { category?: { name: string } | null } | null };
    };
  };
};

type EquipmentWarranty = {
  id: string;
  equipmentId: string;
  equipment: {
    nickname?: string | null;
    brand?: string | null;
    model?: string | null;
    category: { name: string };
  };
  provider: string;
  startDate: string;
  endDate: string;
  notes?: string | null;
  receiptUrl?: string | null;
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
        <div className="flex items-center gap-2 pt-2">
          <Button
            variant="outline"
            size="sm"
            className="flex-1"
            onClick={() => navigate(`repair/${w.job.id}`)}
          >
            View repair <ChevronRight className="h-4 w-4" />
          </Button>
          {w.documentUrl && (
            <Button variant="secondary" size="sm" asChild className="flex-1">
              <a href={`/api/uploads/${w.documentUrl}`} target="_blank" rel="noopener noreferrer">
                View Document
              </a>
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function EquipmentWarrantyCard({ w }: { w: EquipmentWarranty }) {
  const isExpired = new Date(w.endDate) < new Date();
  const eqName = w.equipment.nickname || `${w.equipment.brand || ""} ${w.equipment.model || ""} ${w.equipment.category.name}`.trim();
  
  return (
    <Card className="overflow-hidden">
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center justify-between gap-2 text-base">
          <span className="flex items-center gap-2">
            <ShieldCheck className={`h-4 w-4 ${isExpired ? "text-muted-foreground" : "text-emerald-600"}`} />
            {eqName}
          </span>
          <StatusBadge status={isExpired ? "EXPIRED" : "ACTIVE"} />
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-xs text-muted-foreground">Provider</p>
            <p className="font-medium">{w.provider}</p>
          </div>
          <div></div>
          <div>
            <p className="text-xs text-muted-foreground">Start</p>
            <p className="font-medium">{formatDate(w.startDate)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">End</p>
            <p className="font-medium">{formatDate(w.endDate)}</p>
          </div>
        </div>
        {w.notes && (
          <div>
            <p className="text-xs text-muted-foreground">Notes</p>
            <p className="mt-0.5">{w.notes}</p>
          </div>
        )}
        <div className="flex items-center gap-2 pt-2">
          <Button
            variant="outline"
            size="sm"
            className="flex-1"
            onClick={() => navigate(`equipment/${w.equipmentId}`)}
          >
            View equipment <ChevronRight className="h-4 w-4" />
          </Button>
          {w.receiptUrl && (
            <Button variant="secondary" size="sm" asChild className="flex-1">
              <a href={`/api/uploads/${w.receiptUrl}`} target="_blank" rel="noopener noreferrer">
                View Receipt
              </a>
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ────────────────────────────────────────────────────────────────────────────────
// Main
// ────────────────────────────────────────────────────────────────────────────────

export function WarrantiesScreen() {
  const { status } = useSession();
  const { data, isLoading, isError, error, refetch } = useApi<{ warranties: Warranty[], equipmentWarranties: EquipmentWarranty[] }>(
    ["warranties"],
    "/api/warranties",
  );

  const { data: eqData } = useApi<{ equipment: any[] }>(
    ["customer", "equipment"],
    "/api/customer/equipment",
    { enabled: status === "authenticated" }
  );

  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [equipmentId, setEquipmentId] = useState("");
  const [provider, setProvider] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [notes, setNotes] = useState("");
  const [receiptUrl, setReceiptUrl] = useState("");
  const [search, setSearch] = useState("");

  const addMutation = useApiMutation(
    "/api/warranties/equipment", 
    "POST",
    [["warranties"]],
    {
      queryKey: ["warranties"],
      updater: (oldData: any, newVars: any) => {
        if (!oldData) return oldData;
        const tempWarranty = {
          id: `temp-${Date.now()}`,
          equipmentId: newVars.equipmentId,
          provider: newVars.provider,
          startDate: newVars.startDate,
          endDate: newVars.endDate,
          notes: newVars.notes,
          receiptUrl: newVars.receiptUrl,
          status: "ACTIVE",
          equipment: eqData?.equipment?.find((e: any) => e.id === newVars.equipmentId)
        };
        return {
          ...oldData,
          equipmentWarranties: [tempWarranty, ...(oldData.equipmentWarranties || [])]
        };
      }
    }
  );

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!equipmentId || !provider || !startDate || !endDate) return;
    setSubmitting(true);
    try {
      await addMutation.mutateAsync({
        equipmentId,
        provider,
        startDate,
        endDate,
        notes: notes || undefined,
        receiptUrl: receiptUrl || undefined,
      });
      toast.success("Warranty added");
      setOpen(false);
      // useApiMutation handles invalidation
    } catch (err: any) {
      toast.error(err.message || "Failed to add warranty");
    } finally {
      setSubmitting(false);
    }
  };

  const { active, expired } = useMemo(() => {
    let jobAll = data?.warranties ?? [];
    let eqAll = data?.equipmentWarranties ?? [];
    
    if (search.trim()) {
      const q = search.trim();
      
      jobAll = jobAll.map(w => {
        const score = scoreItem(q, [
          { name: "equipment", value: w.job.booking.repairRequest.problem?.category?.name, weight: 2.0 },
          { name: "provider", value: "FixIt Platform", weight: 1.0 },
          { name: "status", value: w.status, weight: 1.0 },
        ]);
        return { w, score: score.score };
      }).filter(x => x.score > 0).sort((a, b) => b.score - a.score).map(x => x.w);
      
      eqAll = eqAll.map(w => {
        const score = scoreItem(q, [
          { name: "equipment", value: w.equipment.nickname || w.equipment.category.name, weight: 2.0 },
          { name: "brandModel", value: `${w.equipment.brand || ""} ${w.equipment.model || ""}`, weight: 1.5 },
          { name: "provider", value: w.provider, weight: 1.2 },
        ]);
        return { w, score: score.score };
      }).filter(x => x.score > 0).sort((a, b) => b.score - a.score).map(x => x.w);
    }
    
    const activeJobs = jobAll.filter((w) => w.status === "ACTIVE" && new Date(w.endDate) >= new Date());
    const expiredJobs = jobAll.filter((w) => w.status !== "ACTIVE" || new Date(w.endDate) < new Date());
    
    const activeEq = eqAll.filter((w) => new Date(w.endDate) >= new Date());
    const expiredEq = eqAll.filter((w) => new Date(w.endDate) < new Date());
    
    return { 
      active: { jobs: activeJobs, eq: activeEq }, 
      expired: { jobs: expiredJobs, eq: expiredEq } 
    };
  }, [data, search]);

  if (status === "loading" || isLoading) {
    return (
      <PageContainer>
        <PageHeader title="Warranties" />
        <ListSkeleton />
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
        description="Active and expired warranties for your equipment and repairs."
        actions={
          <div className="flex items-center gap-2">
            <ContextualSearch
              queryKey="warranty-search"
              placeholder="Search warranties..."
              className="w-64"
              onSearch={async (q) => {
                const qLower = q.trim();
                if (!qLower) return [];
                
                const jobAll = data?.warranties ?? [];
                const eqAll = data?.equipmentWarranties ?? [];
                const results: SearchResultItem[] = [];
                
                jobAll.forEach(w => {
                  const score = scoreItem(qLower, [
                    { name: "equipment", value: w.job.booking.repairRequest.problem?.category?.name, weight: 10.0 },
                    { name: "provider", value: "FixIt Platform", weight: 3.0 },
                    { name: "status", value: w.status, weight: 1.0 },
                  ]);
                  if (score.score > 0) {
                    results.push({
                      id: `job-${w.id}`,
                      title: `Repair: ${w.job.booking.repairRequest.problem?.category?.name || "Equipment"}`,
                      subtitle: "FixIt Platform Warranty",
                      score: score.score
                    });
                  }
                });
                
                eqAll.forEach(w => {
                  const score = scoreItem(qLower, [
                    { name: "equipment", value: w.equipment.nickname || w.equipment.category.name, weight: 10.0 },
                    { name: "brandModel", value: `${w.equipment.brand || ""} ${w.equipment.model || ""}`, weight: 5.0 },
                    { name: "provider", value: w.provider, weight: 3.0 },
                  ]);
                  if (score.score > 0) {
                    results.push({
                      id: `eq-${w.id}`,
                      title: w.equipment.nickname || `${w.equipment.brand || ""} ${w.equipment.model || ""}`.trim() || w.equipment.category.name,
                      subtitle: w.provider,
                      score: score.score
                    });
                  }
                });
                
                return results.sort((a, b) => (b.score || 0) - (a.score || 0)).slice(0, 5);
              }}
              onSelect={(item) => setSearch(item.title)}
            />
            <Button onClick={() => navigate("history")} size="sm" variant="outline">
              <CalendarClock className="h-4 w-4" /> View history
            </Button>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button size="sm"><Plus className="h-4 w-4 mr-1"/> Add Warranty</Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[425px]">
                <form onSubmit={submit}>
                  <DialogHeader>
                    <DialogTitle>Add External Warranty</DialogTitle>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="equipment">Equipment</Label>
                      <Select value={equipmentId} onValueChange={setEquipmentId}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select equipment" />
                        </SelectTrigger>
                        <SelectContent>
                          {eqData?.equipment?.map((eq) => (
                            <SelectItem key={eq.id} value={eq.id}>
                              {eq.nickname || `${eq.brand || ""} ${eq.model || ""} ${eq.category.name}`.trim()}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="provider">Provider / Retailer</Label>
                      <Input id="provider" required value={provider} onChange={e => setProvider(e.target.value)} />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label htmlFor="startDate">Start Date</Label>
                        <Input id="startDate" type="date" required value={startDate} onChange={e => setStartDate(e.target.value)} />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="endDate">End Date</Label>
                        <Input id="endDate" type="date" required value={endDate} onChange={e => setEndDate(e.target.value)} />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="notes">Notes</Label>
                      <Textarea id="notes" value={notes} onChange={e => setNotes(e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Receipt</Label>
                      <MediaUploader
                        value={receiptUrl ? [receiptUrl] : []}
                        onChange={(urls) => setReceiptUrl(urls[0] || "")}
                        maxFiles={1}
                      />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" type="button" onClick={() => setOpen(false)}>Cancel</Button>
                    <Button type="submit" disabled={submitting}>
                      {submitting ? "Saving..." : "Save"}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        }
      />

      <Tabs defaultValue="active">
        <TabsList>
          <TabsTrigger value="active">
            Active <Badge variant="secondary" className="ml-1.5">{active.jobs.length + active.eq.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="expired">
            Expired <Badge variant="secondary" className="ml-1.5">{expired.jobs.length + expired.eq.length}</Badge>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="active" className="mt-4">
          {(active.jobs.length + active.eq.length) === 0 ? (
            <EmptyState
              icon={ShieldCheck}
              title="No active warranties"
              description="Add an external warranty or complete a repair to see them here."
              action={<Button onClick={() => setOpen(true)} variant="outline"><Plus className="mr-2 h-4 w-4" /> Add Warranty</Button>}
            />
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {active.eq.map((w) => <EquipmentWarrantyCard key={w.id} w={w} />)}
              {active.jobs.map((w) => <WarrantyCard key={w.id} w={w} />)}
            </div>
          )}
        </TabsContent>

        <TabsContent value="expired" className="mt-4">
          {(expired.jobs.length + expired.eq.length) === 0 ? (
            <EmptyState
              icon={ClipboardList}
              title="No expired warranties"
              description="Expired warranties will be listed here for your records."
            />
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {expired.eq.map((w) => <EquipmentWarrantyCard key={w.id} w={w} />)}
              {expired.jobs.map((w) => <WarrantyCard key={w.id} w={w} />)}
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
