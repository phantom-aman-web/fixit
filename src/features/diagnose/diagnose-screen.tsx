"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "sonner";
import {
  ArrowLeft,
  ArrowRight,
  Camera,
  CheckCircle2,
  Cpu,
  Fan,
  Laptop,
  Loader2,
  Microwave,
  Printer,
  Refrigerator,
  Shirt,
  Smartphone,
  Snowflake,
  Tv,
  Utensils,
  WashingMachine,
  Waves,
  Wrench,
  Coffee,
  AlertTriangle,
  Bot
} from "lucide-react";

import {
  ErrorState,
  LoadingState,
  PageContainer,
  PageHeader,
  FormSkeleton,
} from "@/components/shared/states";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { useApi, useApiMutation } from "@/hooks/use-api";
import { navigate, useRouter } from "@/store/router";
import { ContextualSearch, type SearchResultItem } from "@/components/search/contextual-search";
import { scoreItem } from "@/lib/search/ranking";

// ───────────────────────────── Types ─────────────────────────────

type Symptom = {
  id: string;
  slug: string;
  name: string;
  description?: string | null;
};

type Category = {
  id: string;
  slug: string;
  name: string;
  icon?: string | null;
  description?: string | null;
  symptoms: Symptom[];
};

type StartSessionResponse = { state: unknown; sessionId: string };

type InterpretationResult = {
  interpretation: {
    equipment: {
      category: string | null;
      type?: string | null;
      brand?: string | null;
      model?: string | null;
    } | null;
    symptoms: string[];
    observations: string[];
    summary: string;
    escalationRequired: boolean;
    knowledgeCoverage?: string;
  } | null;
  safety: {
    decision: string;
    finalSafetyLevel: string;
    reason?: string;
  };
  fellBack: boolean;
  analysisId: string;
};

// ───────────────────────────── Helpers ─────────────────────────────

function categoryIcon(icon?: string | null) {
  switch ((icon ?? "").toLowerCase().replace(/[-\s]/g, "_")) {
    case "washing_machine":
    case "washer": return WashingMachine;
    case "refrigerator":
    case "fridge":
    case "freezer": return Refrigerator;
    case "dishwasher": return Utensils;
    case "microwave": return Microwave;
    case "air_conditioner":
    case "ac":
    case "aircon": return Fan;
    case "tv":
    case "television": return Tv;
    case "laptop": return Laptop;
    case "computer":
    case "desktop": return Cpu;
    case "smartphone":
    case "phone": return Smartphone;
    case "printer": return Printer;
    case "camera": return Camera;
    case "coffee_maker":
    case "coffeemaker": return Coffee;
    case "shirt":
    case "clothing": return Shirt;
    case "waves": return Waves;
    case "snowflake": return Snowflake;
    default: return Wrench;
  }
}

// ───────────────────────────── Screen ─────────────────────────────

export function DiagnoseScreen() {
  const { status } = useSession();
  const isAuthed = status === "authenticated";
  
  const [step, setStep] = useState<"intake" | "analyzing" | "confirm" | "manual">("intake");
  const router = useRouter();
  const technicianId = router.route.query.technicianId as string | undefined;
  
  // Intake state
  const [problemText, setProblemText] = useState("");
  
  // AI state
  const [analysis, setAnalysis] = useState<InterpretationResult | null>(null);
  
  // Manual / Confirm state
  const [manualCategorySlug, setManualCategorySlug] = useState<string>("");
  const [manualCustomCategory, setManualCustomCategory] = useState<string>("");
  const [manualType, setManualType] = useState<string>("");
  const [manualBrand, setManualBrand] = useState<string>("");
  const [manualModel, setManualModel] = useState<string>("");
  const [manualSymptomIds, setManualSymptomIds] = useState<string[]>([]);
  const [manualCustomSymptom, setManualCustomSymptom] = useState<string>("");

  const categoriesApi = useApi<{ categories: Category[] }>(
    ["equipment-categories"],
    "/api/equipment-categories",
    { staleTime: 24 * 60 * 60 * 1000 }
  );
  
  const categories = useMemo(() => {
    const rawList = categoriesApi.data?.categories ?? [];
    // Create a deep copy to avoid mutating React Query's frozen cache data
    const list = JSON.parse(JSON.stringify(rawList));
    
    if (!list.find((c: any) => c.slug === "other")) {
      list.push({ id: "other", slug: "other", name: "Other", symptoms: [{ id: "other-symptom", slug: "other-symptom", name: "Other" }] });
    } else {
      const otherCat = list.find((c: any) => c.slug === "other");
      if (otherCat && !otherCat.symptoms.find((s: any) => s.id === "other-symptom")) {
        otherCat.symptoms.push({ id: "other-symptom", slug: "other-symptom", name: "Other" });
      }
    }
    return list;
  }, [categoriesApi.data?.categories]);

  const interpretMut = useApiMutation<InterpretationResult, { text: string }>(
    "/api/ai/interpret", "POST", []
  );
  const startAiMut = useApiMutation<StartSessionResponse, any>(
    "/api/ai/start-session", "POST", [["history"]]
  );
  const startManualMut = useApiMutation<StartSessionResponse, any>(
    "/api/diagnostic-sessions", "POST", [["history"]]
  );
  const problemMut = useApiMutation<any, any>("/api/problems", "POST", [["history"]]);
  if (status === "loading") {
    return (
      <PageContainer>
        <FormSkeleton />
      </PageContainer>
    );
  }

  // --- Handlers ---

  async function handleInterpret() {
    if (problemText.trim().length < 5) {
      toast.error("Please provide a bit more detail.");
      return;
    }
    if (!isAuthed) {
      toast.error("Please sign in to diagnose equipment.");
      navigate("auth/signin");
      return;
    }

    setStep("analyzing");
    try {
      const res = await interpretMut.mutateAsync({ text: problemText });
      setAnalysis(res);
      setStep("confirm");
    } catch (e: any) {
      toast.error(e.message || "Could not analyze the problem.");
      setStep("intake");
    }
  }

  function handleEditDetails() {
    if (analysis?.interpretation?.equipment) {
      const eq = analysis.interpretation.equipment;
      setManualCategorySlug(eq.category || "");
      setManualType(eq.type || "");
      setManualBrand(eq.brand || "");
      setManualModel(eq.model || "");
    }
    setStep("manual");
  }

  async function handleStartAiSession() {
    if (!analysis?.interpretation || !analysis?.analysisId) return;
    try {
      const res = await startAiMut.mutateAsync({
        interpretation: analysis.interpretation,
        analysisId: analysis.analysisId,
      });
      toast.success("Diagnostic session started.");
      navigate(`diagnose/session/${res.sessionId}${technicianId ? `?technicianId=${technicianId}` : ""}`);
    } catch (e: any) {
      toast.error(e.message || "Failed to start session.");
    }
  }

  async function handleStartManualSession() {
    if (!manualCategorySlug) {
      toast.error("Please select a category.");
      return;
    }
    const cat = categories.find((c) => c.slug === manualCategorySlug);
    if (!cat || manualSymptomIds.length === 0) {
      toast.error("Please select at least one symptom.");
      return;
    }
    try {
      const problemRes = await problemMut.mutateAsync({
        categoryId: cat.id,
        customCategoryName: manualCategorySlug === "other" ? manualCustomCategory : undefined,
        customSymptom: manualSymptomIds.includes("other-symptom") ? manualCustomSymptom : undefined,
        symptomIds: manualSymptomIds,
        description: problemText || "Manual intake",
        urgency: "NORMAL",
      });
      const res = await startManualMut.mutateAsync({
        categoryId: cat.id,
        symptomId: manualSymptomIds[0], // Initialize engine with first selected root
        problemId: problemRes.problem.id,
      });
      const sid = (res.state as any)?.session?.id;
      if (!sid) throw new Error("Could not start session");
      toast.success("Diagnostic session started.");
      navigate(`diagnose/session/${sid}${technicianId ? `?technicianId=${technicianId}` : ""}`);
    } catch (e: any) {
      toast.error(e.message || "Failed to start session.");
    }
  }

  // --- Views ---

  return (
    <PageContainer>
      <PageHeader
        title="What are you trying to fix?"
        description="Describe the equipment and what's happening. FixIt will identify it and guide you through the diagnosis."
      />

      <div className="mx-auto max-w-2xl mt-4">
        <AnimatePresence mode="wait">
          {step === "intake" && (
            <motion.div
              key="intake"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              <Card>
                <CardContent className="pt-6">
                  <div className="space-y-4">
                    <Textarea
                      placeholder="Example: My LG refrigerator is making a loud clicking noise and isn't cooling properly..."
                      value={problemText}
                      onChange={(e) => setProblemText(e.target.value)}
                      className="min-h-[160px] text-base resize-none"
                    />
                    
                    <div className="flex flex-wrap items-center justify-between gap-4">
                      <Button variant="outline" className="gap-2" onClick={() => toast.info("Photo upload will be enabled in a future update.")}>
                        <Camera className="h-4 w-4" />
                        Add a photo
                      </Button>
                      
                      <div className="flex items-center gap-3 w-full sm:w-auto">
                        <Button variant="ghost" onClick={() => setStep("manual")}>
                          Browse equipment
                        </Button>
                        <Button 
                          className="gap-2 flex-1 sm:flex-none" 
                          onClick={handleInterpret}
                          disabled={!problemText.trim() || interpretMut.isPending}
                        >
                          Continue
                          <ArrowRight className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {step === "analyzing" && (
            <motion.div
              key="analyzing"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center py-24 space-y-6 text-center"
            >
              <div className="relative">
                <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full" />
                <Bot className="h-16 w-16 text-primary relative animate-bounce" />
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-semibold">Identifying your equipment...</h3>
                <p className="text-muted-foreground">Checking FixIt's verified repair knowledge for matching diagnostic procedures.</p>
              </div>
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </motion.div>
          )}

          {step === "confirm" && analysis?.interpretation && (
            <motion.div
              key="confirm"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              <h3 className="text-xl font-semibold flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-500" />
                Equipment identified
              </h3>
              
              <Card>
                <CardContent className="pt-6 space-y-6">
                  {/* Safety Alert */}
                  {analysis.safety.decision === "ESCALATE" && (
                    <div className="bg-destructive/10 text-destructive p-4 rounded-md border border-destructive/20 flex gap-3">
                      <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
                      <div>
                        <h4 className="font-semibold">⚠️ Professional service recommended</h4>
                        <p className="text-sm mt-1">{analysis.safety.reason || "This issue requires professional service."}</p>
                      </div>
                    </div>
                  )}

                  {/* Caution Alert */}
                  {analysis.safety.decision !== "ESCALATE" && analysis.safety.finalSafetyLevel === "CAUTION" && (
                    <div className="bg-yellow-500/10 text-yellow-600 p-4 rounded-md border border-yellow-500/20 flex gap-3">
                      <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
                      <div>
                        <h4 className="font-semibold">Caution Recommended</h4>
                        <p className="text-sm mt-1">{analysis.safety.reason || "Please proceed with caution when troubleshooting this issue."}</p>
                      </div>
                    </div>
                  )}

                  {/* Coverage Alert */}
                  {analysis.interpretation.knowledgeCoverage === "UNKNOWN" && (
                    <div className="bg-muted p-4 rounded-md border flex gap-3">
                      <Bot className="h-5 w-5 shrink-0 text-muted-foreground mt-0.5" />
                      <div>
                        <h4 className="font-semibold">Unknown Equipment</h4>
                        <p className="text-sm text-muted-foreground mt-1">We don't have verified diagnostic knowledge for this exact equipment yet. We'll provide safe general guidance.</p>
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <span className="text-sm text-muted-foreground block">Category</span>
                      <span className="font-medium capitalize">{analysis.interpretation.equipment?.category?.replace(/_/g, " ") || "Unknown"}</span>
                    </div>
                    <div>
                      <span className="text-sm text-muted-foreground block">Type</span>
                      <span className="font-medium capitalize">{analysis.interpretation.equipment?.type?.replace(/_/g, " ") || "Unknown"}</span>
                    </div>
                    <div>
                      <span className="text-sm text-muted-foreground block">Brand</span>
                      <span className="font-medium">{analysis.interpretation.equipment?.brand || "Unknown"}</span>
                    </div>
                    <div>
                      <span className="text-sm text-muted-foreground block">Problem</span>
                      <span className="font-medium line-clamp-2">{analysis.interpretation.summary}</span>
                    </div>
                  </div>

                  <div className="pt-4 flex flex-col sm:flex-row items-center justify-between gap-4 border-t">
                    <span className="text-sm font-medium">Is this correct?</span>
                    <div className="flex w-full sm:w-auto items-center gap-3">
                      <Button variant="outline" onClick={handleEditDetails}>
                        Edit details
                      </Button>
                      <Button 
                        onClick={handleStartAiSession}
                        disabled={startAiMut.isPending}
                        className="flex-1 sm:flex-none"
                      >
                        {startAiMut.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                        Yes, continue
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {step === "manual" && (
            <motion.div
              key="manual"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="icon" onClick={() => setStep("intake")}>
                  <ArrowLeft className="h-5 w-5" />
                </Button>
                <h3 className="text-xl font-semibold">Equipment Details</h3>
              </div>
              
              <Card>
                <CardContent className="pt-6 space-y-4">
                  <div className="space-y-2">
                    <Label>Category</Label>
                    <ContextualSearch
                      queryKey="category-search"
                      placeholder="Search categories (e.g. Refrigerator)"
                      onSearch={async (q) => {
                        const results: SearchResultItem[] = [];
                        for (const c of categories) {
                          const score = scoreItem(q, [
                            { name: "name", value: c.name, weight: 10.0 },
                            { name: "slug", value: c.slug, weight: 5.0 },
                            { name: "desc", value: c.description, weight: 1.0 },
                          ]);
                          if (score.score > 0) {
                            results.push({
                              id: c.slug,
                              title: c.name,
                              subtitle: c.description || undefined,
                              score: score.score
                            });
                          }
                        }
                        return results.sort((a, b) => (b.score || 0) - (a.score || 0));
                      }}
                      onSelect={(item) => {
                        setManualCategorySlug(item.id);
                        setManualSymptomIds([]);
                      }}
                    />
                    
                    {manualCategorySlug && (
                      <div className="mt-2 text-sm text-primary font-medium flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4" /> Selected: {categories.find(c => c.slug === manualCategorySlug)?.name}
                      </div>
                    )}
                  </div>
                  
                  {manualCategorySlug === "other" && (
                    <div className="space-y-2">
                      <Label>Custom Category Name</Label>
                      <Input value={manualCustomCategory} onChange={(e) => setManualCustomCategory(e.target.value)} placeholder="e.g. Hoverboard" />
                    </div>
                  )}

                  {manualCategorySlug && (
                    <div className="space-y-3">
                      <Label>What's wrong? (Select all that apply)</Label>
                      <div className="grid gap-3">
                        {categories.find(c => c.slug === manualCategorySlug)?.symptoms.map((s) => (
                          <div key={s.id} className="flex items-center space-x-2">
                            <Checkbox 
                              id={`symptom-${s.id}`} 
                              checked={manualSymptomIds.includes(s.id)}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  setManualSymptomIds(prev => [...prev, s.id]);
                                } else {
                                  setManualSymptomIds(prev => prev.filter(id => id !== s.id));
                                }
                              }}
                            />
                            <Label htmlFor={`symptom-${s.id}`} className="font-normal cursor-pointer text-base">
                              {s.name}
                            </Label>
                          </div>
                        ))}
                        <div className="flex items-center space-x-2">
                          <Checkbox 
                            id="symptom-other" 
                            checked={manualSymptomIds.includes("other-symptom")}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setManualSymptomIds(prev => [...prev, "other-symptom"]);
                              } else {
                                setManualSymptomIds(prev => prev.filter(id => id !== "other-symptom"));
                                setManualCustomSymptom("");
                              }
                            }}
                          />
                          <Label htmlFor="symptom-other" className="font-normal cursor-pointer text-base">
                            Other
                          </Label>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {manualSymptomIds.includes("other-symptom") && (
                    <div className="space-y-2">
                      <Label>Custom Symptom</Label>
                      <Input value={manualCustomSymptom} onChange={(e) => setManualCustomSymptom(e.target.value)} placeholder="Describe the symptom briefly" />
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Brand (Optional)</Label>
                      <Input value={manualBrand} onChange={(e) => setManualBrand(e.target.value)} placeholder="e.g. Bosch" />
                    </div>
                    <div className="space-y-2">
                      <Label>Type (Optional)</Label>
                      <Input value={manualType} onChange={(e) => setManualType(e.target.value)} placeholder="e.g. Cordless Drill" />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Problem Description</Label>
                    <Textarea 
                      value={problemText} 
                      onChange={(e) => setProblemText(e.target.value)} 
                      placeholder="Describe what's wrong..."
                      className="resize-none"
                    />
                  </div>

                  <div className="pt-4 flex justify-end">
                    <Button onClick={handleStartManualSession} disabled={startManualMut.isPending}>
                      {startManualMut.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                      Start Diagnosis
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </PageContainer>
  );
}
