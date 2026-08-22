"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "sonner";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronLeft,
  Clock,
  Lightbulb,
  Loader2,
  PartyPopper,
  RotateCcw,
  Search,
  ShieldAlert,
  ShieldCheck,
  SkipForward,
  Sparkles,
  Stethoscope,
  Wrench,
  X,
} from "lucide-react";

import {
  ErrorState,
  LoadingState,
  PageContainer,
  PageHeader,
} from "@/components/shared/states";
import {
  ConfidenceBadge,
  RiskBadge,
  SafetyBadge,
  StatusBadge,
  confidenceTier,
} from "@/components/shared/status-badges";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { useApi, useApiMutation } from "@/hooks/use-api";
import { navigate } from "@/store/router";

// ───────────────────────────── Types ─────────────────────────────

type QuestionOption = { value: string; label: string };
type Question = {
  key: string;
  text: string;
  helpText?: string | null;
  inputType: string;
  order: number;
  options: QuestionOption[];
};

type ComputedCause = {
  causeId: string;
  slug: string;
  name: string;
  description: string;
  riskLevel: string;
  confidence: number;
  professionalRecommended: boolean;
  reasoning: string[];
};

type Session = {
  id: string;
  status: string;
  currentQuestionKey?: string | null;
  riskLevel?: string | null;
  escalationRecommendation?: string | null;
  confidence?: number | null;
  startedAt: string;
  completedAt?: string | null;
  problemId?: string | null;
  equipmentId?: string | null;
  categoryId: string;
  symptomId?: string | null;
};

type SessionState = {
  session: Session;
  questions: Question[];
  answers: Record<string, string[]>;
  possibleCauses: ComputedCause[];
  escalation: { escalate: boolean; reason?: string };
  nextQuestionKey: string | null;
};

type TroubleshootingStep = {
  id: string;
  title: string;
  description: string;
  difficulty: string;
  estimatedMinutes: number;
  safetyLevel: string;
  requiredTools?: string | null;
  instructions: string;
  expectedResult?: string | null;
  failureResult?: string | null;
  order: number;
};

type StepResult = {
  id: string;
  stepId: string;
  status: "SOLVED" | "FAILED" | "SKIPPED";
  notes?: string | null;
};

type FullStateResponse = {
  state: SessionState;
  troubleshootingSteps: TroubleshootingStep[];
  stepResults: StepResult[];
};

type RepairRequestResponse = {
  request: { id: string };
  matches: unknown;
};

// ───────────────────────────── Helpers ─────────────────────────────

const DIFFICULTY_LABEL: Record<string, string> = {
  EASY: "Easy",
  MODERATE: "Moderate",
  ADVANCED: "Advanced",
};

const DIFFICULTY_STYLE: Record<string, string> = {
  EASY: "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300",
  MODERATE:
    "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950 dark:text-amber-300",
  ADVANCED:
    "bg-red-100 text-red-800 border-red-200 dark:bg-red-950 dark:text-red-300",
};

function formatList(items: string[]): string {
  return items.filter(Boolean).join(", ");
}

// ───────────────────────────── Screen ─────────────────────────────

export function DiagnoseSessionScreen({ sessionId }: { sessionId: string }) {
  const stateApi = useApi<FullStateResponse>(
    ["diagnostic-sessions", sessionId],
    `/api/diagnostic-sessions/${sessionId}`
  );

  const answerMut = useApiMutation<
    { state: SessionState },
    { questionKey: string; values: string[] }
  >(`/api/diagnostic-sessions/${sessionId}/answer`);
  const completeMut = useApiMutation<{ state: SessionState }, void>(
    `/api/diagnostic-sessions/${sessionId}/complete`
  );
  const stepMut = useApiMutation<
    { state: SessionState },
    { stepId: string; status: "SOLVED" | "FAILED" | "SKIPPED"; notes?: string }
  >(`/api/diagnostic-sessions/${sessionId}/step`);
  const repairMut = useApiMutation<
    RepairRequestResponse,
    { problemId: string; sessionId?: string }
  >("/api/repair-requests");

  const data = stateApi.data;
  const state = data?.state;
  const questions = state?.questions ?? [];
  const answers = state?.answers ?? {};
  const causes = state?.possibleCauses ?? [];
  const escalation = state?.escalation ?? { escalate: false };
  const session = state?.session;
  const troubleshootingSteps = data?.troubleshootingSteps ?? [];
  const stepResults = data?.stepResults ?? [];

  // The question currently being viewed. Defaults to the engine's
  // nextQuestionKey; allows local back/forward navigation without
  // immediately calling the API.
  const [localQuestionKey, setLocalQuestionKey] = useState<string | null>(
    state?.nextQuestionKey ?? null
  );
  const [selectedValues, setSelectedValues] = useState<string[]>([]);

  // Sync localQuestionKey with the engine's nextQuestionKey when it changes
  // (e.g., after a mutation completes) using the "adjusting state during
  // render" pattern. This avoids setState-in-effect cascades.
  const [prevNextKey, setPrevNextKey] = useState<string | null | undefined>(
    state?.nextQuestionKey
  );
  if (state && state.nextQuestionKey !== prevNextKey) {
    setPrevNextKey(state.nextQuestionKey);
    setLocalQuestionKey(state.nextQuestionKey);
  }

  // If the session moves out of IN_PROGRESS, drop the local question view.
  const [prevStatus, setPrevStatus] = useState<string | undefined>(
    state?.session.status
  );
  if (state && state.session.status !== prevStatus) {
    setPrevStatus(state.session.status);
    if (state.session.status !== "IN_PROGRESS") {
      setLocalQuestionKey(null);
    }
  }

  // When localQuestionKey changes, prefill selectedValues from the existing
  // answer (also "adjusting state during render").
  const [prevLocalKey, setPrevLocalKey] = useState<string | null | undefined>(
    localQuestionKey
  );
  if (localQuestionKey !== prevLocalKey) {
    setPrevLocalKey(localQuestionKey);
    setSelectedValues(localQuestionKey ? answers[localQuestionKey] ?? [] : []);
  }

  const sortedQuestions = useMemo(
    () => [...questions].sort((a, b) => a.order - b.order),
    [questions]
  );
  const currentQuestion = useMemo(
    () => sortedQuestions.find((q) => q.key === localQuestionKey) ?? null,
    [sortedQuestions, localQuestionKey]
  );

  const answeredCount = Object.keys(answers).length;
  const totalCount = sortedQuestions.length;
  const currentIndex = currentQuestion
    ? sortedQuestions.findIndex((q) => q.key === currentQuestion.key)
    : -1;
  const progressPct = totalCount
    ? Math.min(100, Math.round(((answeredCount) / totalCount) * 100))
    : 0;

  if (stateApi.isLoading) {
    return (
      <PageContainer>
        <LoadingState label="Loading diagnostic session…" />
      </PageContainer>
    );
  }

  if (stateApi.isError || !state || !session) {
    return (
      <PageContainer>
        <ErrorState
          title="Couldn't load this session"
          detail={stateApi.error?.message ?? "Session may have been removed."}
          onRetry={() => stateApi.refetch()}
        />
        <div className="mt-4 flex justify-center">
          <Button variant="outline" size="sm" onClick={() => navigate("diagnose")}>
            <ArrowLeft className="h-4 w-4" /> Back to diagnose
          </Button>
        </div>
      </PageContainer>
    );
  }

  const isComplete = session.status === "COMPLETED" || session.status === "ESCALATED";
  const solvedResult = stepResults.find((r) => r.status === "SOLVED");
  const allStepsFailed =
    troubleshootingSteps.length > 0 &&
    stepResults.length >= troubleshootingSteps.length &&
    stepResults.every((r) => r.status === "FAILED" || r.status === "SKIPPED") &&
    !solvedResult;
  const showCelebration = !!solvedResult;
  const showEscalationFlow =
    isComplete && (escalation.escalate || allStepsFailed) && !showCelebration;
  const showTroubleshootingFlow =
    isComplete &&
    !escalation.escalate &&
    !allStepsFailed &&
    !showCelebration &&
    troubleshootingSteps.length > 0;

  function toggleMulti(value: string) {
    setSelectedValues((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]
    );
  }

  async function handleAnswer() {
    if (!currentQuestion) return;
    if (selectedValues.length === 0) {
      toast.error("Please pick an answer before continuing.");
      return;
    }
    try {
      const res = await answerMut.mutateAsync({
        questionKey: currentQuestion.key,
        values: selectedValues,
      });
      // After the engine recomputes, advance to the next unanswered question.
      // The mutation also invalidates the GET query, so the panel will refresh.
      const next = res.state.nextQuestionKey;
      setLocalQuestionKey(next);
      setSelectedValues([]);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to save answer";
      toast.error(msg);
    }
  }

  async function handleComplete() {
    try {
      await completeMut.mutateAsync();
      toast.success("Diagnosis complete.");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to complete";
      toast.error(msg);
    }
  }

  async function handleStep(stepId: string, status: "SOLVED" | "FAILED" | "SKIPPED") {
    try {
      await stepMut.mutateAsync({ stepId, status });
      if (status === "SOLVED") {
        toast.success("Great — glad that solved it!");
      } else if (status === "FAILED") {
        toast.info("Marked as not solved. Let's try the next step.");
      } else {
        toast.info("Step skipped.");
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to record step";
      toast.error(msg);
    }
  }

  async function handleFindTechnician() {
    const problemId = session?.problemId;
    if (!problemId) {
      toast.error("This session isn't linked to a problem report.");
      navigate("technicians");
      return;
    }
    try {
      const res = await repairMut.mutateAsync({
        problemId,
        sessionId,
      });
      toast.success("Repair request created — finding matching technicians.");
      navigate(`technicians?requestId=${res.request.id}`);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to create request";
      toast.error(msg);
    }
  }

  function handleBack() {
    if (!currentQuestion) return;
    const idx = sortedQuestions.findIndex((q) => q.key === currentQuestion.key);
    if (idx <= 0) return;
    const prev = sortedQuestions[idx - 1];
    setLocalQuestionKey(prev.key);
    setSelectedValues(answers[prev.key] ?? []);
  }

  return (
    <PageContainer className="max-w-6xl">
      <SessionHeader
        status={session.status}
        answeredCount={answeredCount}
        totalCount={totalCount}
        progressPct={progressPct}
      />

      {/* In-progress question flow */}
      {!isComplete && currentQuestion && (
        <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
          <div className="min-w-0">
            <AnimatePresence mode="wait">
              <motion.div
                key={currentQuestion.key}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.18 }}
              >
                <QuestionCard
                  question={currentQuestion}
                  questionIndex={currentIndex}
                  totalCount={totalCount}
                  selectedValues={selectedValues}
                  onSelect={(v) => setSelectedValues([v])}
                  onToggleMulti={toggleMulti}
                  onChangeText={(v) => setSelectedValues(v ? [v] : [])}
                  onChangeNumber={(v) => setSelectedValues(v ? [v] : [])}
                  onContinue={handleAnswer}
                  onBack={handleBack}
                  canBack={currentIndex > 0}
                  submitting={answerMut.isPending}
                />
              </motion.div>
            </AnimatePresence>

            {state?.nextQuestionKey === null && (
              <Card className="mt-4 border-primary/40 bg-primary/5">
                <CardContent className="flex flex-col items-start gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-medium">All questions answered.</p>
                    <p className="text-sm text-muted-foreground">
                      We have enough information to give you a diagnosis.
                    </p>
                  </div>
                  <Button onClick={handleComplete} disabled={completeMut.isPending}>
                    {completeMut.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" /> Computing…
                      </>
                    ) : (
                      <>
                        <Lightbulb className="h-4 w-4" /> See diagnosis
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>

          <aside className="lg:sticky lg:top-20 lg:self-start">
            <PossibleCausesPanel causes={causes} escalation={escalation} />
          </aside>
        </div>
      )}

      {/* If in-progress but no current question (e.g., all answered) */}
      {!isComplete && !currentQuestion && (
        <Card className="border-primary/40 bg-primary/5">
          <CardContent className="flex flex-col items-start gap-3 py-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-medium">All questions answered.</p>
              <p className="text-sm text-muted-foreground">
                We have enough information to give you a diagnosis.
              </p>
            </div>
            <Button onClick={handleComplete} disabled={completeMut.isPending}>
              {completeMut.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Computing…
                </>
              ) : (
                <>
                  <Lightbulb className="h-4 w-4" /> See diagnosis
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Diagnosis result view */}
      {isComplete && !showCelebration && (
        <DiagnosisResultView
          causes={causes}
          escalation={escalation}
          showEscalationFlow={showEscalationFlow}
          troubleshootingSteps={troubleshootingSteps}
          stepResults={stepResults}
          onStep={handleStep}
          onFindTechnician={handleFindTechnician}
          findingTechnician={repairMut.isPending}
          allStepsFailed={allStepsFailed}
          sessionId={sessionId}
        />
      )}

      {/* Celebration after SOLVED */}
      {showCelebration && (
        <CelebrationView
          causeName={causes[0]?.name}
          onBackToDiagnose={() => navigate("diagnose")}
          onViewHistory={() => navigate("history")}
        />
      )}

      <div className="mt-8 flex flex-wrap items-center justify-between gap-2">
        <Button variant="ghost" size="sm" onClick={() => navigate("diagnose")}>
          <ArrowLeft className="h-4 w-4" /> Back to diagnose
        </Button>
        {isComplete && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setLocalQuestionKey(null);
              navigate("diagnose");
            }}
          >
            <RotateCcw className="h-4 w-4" /> Start over
          </Button>
        )}
      </div>
    </PageContainer>
  );
}

// ───────────────────────────── Header ─────────────────────────────

function SessionHeader({
  status,
  answeredCount,
  totalCount,
  progressPct,
}: {
  status: string;
  answeredCount: number;
  totalCount: number;
  progressPct: number;
}) {
  const inProgress = status === "IN_PROGRESS";
  return (
    <div className="mb-6">
      <PageHeader
        title={
          inProgress
            ? "Diagnosing your equipment"
            : status === "ESCALATED"
            ? "Diagnosis complete"
            : "Diagnosis complete"
        }
        description={
          inProgress
            ? `Answer a few questions to narrow down the cause. Question ${Math.min(
                answeredCount + 1,
                totalCount
              )} of ${totalCount}.`
            : "Here's what we found."
        }
        actions={<StatusBadge status={status} />}
      />
      {inProgress && totalCount > 0 && (
        <div className="flex items-center gap-3">
          <Progress value={progressPct} className="h-1.5" />
          <span className="shrink-0 text-xs text-muted-foreground">
            {answeredCount}/{totalCount}
          </span>
        </div>
      )}
    </div>
  );
}

// ───────────────────────────── Question card ─────────────────────────────

function QuestionCard({
  question,
  questionIndex,
  totalCount,
  selectedValues,
  onSelect,
  onToggleMulti,
  onChangeText,
  onChangeNumber,
  onContinue,
  onBack,
  canBack,
  submitting,
}: {
  question: Question;
  questionIndex: number;
  totalCount: number;
  selectedValues: string[];
  onSelect: (v: string) => void;
  onToggleMulti: (v: string) => void;
  onChangeText: (v: string) => void;
  onChangeNumber: (v: string) => void;
  onContinue: () => void;
  onBack: () => void;
  canBack: boolean;
  submitting: boolean;
}) {
  const inputType = question.inputType;
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          <Stethoscope className="h-3.5 w-3.5" aria-hidden />
          Question {questionIndex + 1} of {totalCount}
        </div>
        <CardTitle className="text-xl leading-snug">{question.text}</CardTitle>
        {question.helpText && (
          <CardDescription>{question.helpText}</CardDescription>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {(inputType === "SINGLE_SELECT" || inputType === "BOOLEAN") && (
          <RadioGroup
            value={selectedValues[0] ?? ""}
            onValueChange={onSelect}
            className="gap-2"
          >
            {question.options.map((opt) => {
              const active = selectedValues.includes(opt.value);
              return (
                <Label
                  key={opt.value}
                  htmlFor={`opt-${opt.value}`}
                  className={cn(
                    "flex cursor-pointer items-center gap-3 rounded-lg border p-4 transition-all hover:shadow-sm",
                    active
                      ? "border-primary bg-primary/5 ring-1 ring-primary"
                      : "border-border bg-card hover:border-primary/40"
                  )}
                >
                  <RadioGroupItem
                    id={`opt-${opt.value}`}
                    value={opt.value}
                  />
                  <span className="text-sm font-medium">{opt.label}</span>
                </Label>
              );
            })}
            {question.options.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No options available for this question.
              </p>
            )}
          </RadioGroup>
        )}

        {inputType === "MULTI_SELECT" && (
          <div className="space-y-2">
            {question.options.map((opt) => {
              const active = selectedValues.includes(opt.value);
              return (
                <Label
                  key={opt.value}
                  htmlFor={`opt-${opt.value}`}
                  className={cn(
                    "flex cursor-pointer items-center gap-3 rounded-lg border p-4 transition-all hover:shadow-sm",
                    active
                      ? "border-primary bg-primary/5 ring-1 ring-primary"
                      : "border-border bg-card hover:border-primary/40"
                  )}
                >
                  <Checkbox
                    id={`opt-${opt.value}`}
                    checked={active}
                    onCheckedChange={() => onToggleMulti(opt.value)}
                  />
                  <span className="text-sm font-medium">{opt.label}</span>
                </Label>
              );
            })}
            {question.options.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No options available for this question.
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              Select all that apply.
            </p>
          </div>
        )}

        {inputType === "TEXT" && (
          <Input
            value={selectedValues[0] ?? ""}
            onChange={(e) => onChangeText(e.target.value)}
            placeholder="Type your answer…"
            autoFocus
          />
        )}

        {inputType === "NUMBER" && (
          <Input
            type="number"
            value={selectedValues[0] ?? ""}
            onChange={(e) => onChangeNumber(e.target.value)}
            placeholder="Enter a number"
            autoFocus
          />
        )}

        <div className="flex items-center justify-between gap-2 pt-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={onBack}
            disabled={!canBack || submitting}
          >
            <ChevronLeft className="h-4 w-4" /> Back
          </Button>
          <Button onClick={onContinue} disabled={submitting}>
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Saving…
              </>
            ) : (
              <>
                Continue <ArrowRight className="h-4 w-4" />
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ───────────────────────────── Possible causes panel ─────────────────────────────

function PossibleCausesPanel({
  causes,
  escalation,
}: {
  causes: ComputedCause[];
  escalation: { escalate: boolean; reason?: string };
}) {
  const top = causes.slice(0, 3);
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Lightbulb className="h-4 w-4 text-primary" aria-hidden />
          <CardTitle className="text-base">Possible causes</CardTitle>
        </div>
        <CardDescription>
          {causes.length === 0
            ? "We'll show likely causes as you answer."
            : "Updates live as you answer."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {escalation.escalate && (
          <Alert className="border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
            <ShieldAlert className="h-4 w-4" aria-hidden />
            <AlertTitle>Professional service recommended</AlertTitle>
            {escalation.reason && (
              <AlertDescription>{escalation.reason}</AlertDescription>
            )}
          </Alert>
        )}

        {top.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Answer the first question to see possible causes.
          </p>
        )}

        {top.map((cause, i) => (
          <CauseCard key={cause.causeId} cause={cause} rank={i + 1} />
        ))}

        {causes.length > 3 && (
          <p className="pt-1 text-center text-xs text-muted-foreground">
            +{causes.length - 3} more cause{causes.length - 3 > 1 ? "s" : ""}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function CauseCard({ cause, rank }: { cause: ComputedCause; rank: number }) {
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-start gap-2">
          <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-bold text-muted-foreground">
            {rank}
          </span>
          <div className="min-w-0">
            <p className="text-sm font-medium leading-tight">{cause.name}</p>
            <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
              {cause.description}
            </p>
          </div>
        </div>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2 pl-7">
        <ConfidenceBadge probability={cause.confidence} />
        <SafetyBadge level={cause.riskLevel} />
        {cause.professionalRecommended && (
          <span className="inline-flex items-center gap-1 rounded-md border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
            <Wrench className="h-2.5 w-2.5" aria-hidden /> Pro
          </span>
        )}
      </div>
      {cause.reasoning.length > 0 && (
        <ul className="mt-2 space-y-1 pl-7">
          {cause.reasoning.slice(0, 2).map((r, i) => (
            <li
              key={i}
              className="flex items-start gap-1 text-[11px] leading-snug text-muted-foreground"
            >
              <span className="mt-0.5 text-primary" aria-hidden>
                •
              </span>
              <span className="line-clamp-2">{r}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ───────────────────────────── Diagnosis result view ─────────────────────────────

function DiagnosisResultView({
  causes,
  escalation,
  showEscalationFlow,
  troubleshootingSteps,
  stepResults,
  onStep,
  onFindTechnician,
  findingTechnician,
  allStepsFailed,
  sessionId,
}: {
  causes: ComputedCause[];
  escalation: { escalate: boolean; reason?: string };
  showEscalationFlow: boolean;
  troubleshootingSteps: TroubleshootingStep[];
  stepResults: StepResult[];
  onStep: (stepId: string, status: "SOLVED" | "FAILED" | "SKIPPED") => void;
  onFindTechnician: () => void;
  findingTechnician: boolean;
  allStepsFailed: boolean;
  sessionId: string;
}) {
  const top = causes[0];
  const runnerUps = causes.slice(1, 3);

  // Fallback for equipment with no deterministic flow
  if (causes.length === 0 && !showEscalationFlow) {
    return (
      <Alert className="border-primary/40 bg-primary/5">
        <Sparkles className="h-5 w-5 text-primary" aria-hidden />
        <AlertTitle className="text-base">
          No step-by-step guides available yet
        </AlertTitle>
        <AlertDescription className="mt-2 text-muted-foreground">
          We don't have a structured diagnostic flow for this specific equipment. 
          However, our Universal AI Assistant can help you troubleshoot it, or you can request a technician directly.
        </AlertDescription>
        <div className="mt-4 flex flex-col sm:flex-row gap-3">
          <Button onClick={() => navigate("ai-diagnose")}>
            <Sparkles className="mr-2 h-4 w-4" /> Try AI Assistant
          </Button>
          <Button variant="outline" onClick={onFindTechnician} disabled={findingTechnician}>
            {findingTechnician ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Finding…
              </>
            ) : (
              <>
                <Search className="mr-2 h-4 w-4" /> Find a technician
              </>
            )}
          </Button>
        </div>
      </Alert>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <div className="min-w-0 space-y-6">
        {/* Escalation banner */}
        {showEscalationFlow && (
          <Alert className="border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
            <ShieldAlert className="h-5 w-5" aria-hidden />
            <AlertTitle className="text-base">
              {allStepsFailed
                ? "We couldn't resolve this with self-service steps"
                : "We recommend professional service"}
            </AlertTitle>
            <AlertDescription>
              {escalation.reason ||
                (allStepsFailed
                  ? "None of the troubleshooting steps solved the issue. A qualified technician can help."
                  : "Based on your answers, this issue is best handled by a qualified professional.")}
            </AlertDescription>
            <div className="mt-3">
              <Button onClick={onFindTechnician} disabled={findingTechnician}>
                {findingTechnician ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Finding…
                  </>
                ) : (
                  <>
                    <Search className="h-4 w-4" /> Find a technician
                  </>
                )}
              </Button>
            </div>
          </Alert>
        )}

        {/* Most likely cause */}
        {top && (
          <Card className="overflow-hidden">
            <CardHeader>
              <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                <Lightbulb className="h-3.5 w-3.5" aria-hidden />
                Most likely cause
              </div>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <CardTitle className="text-2xl leading-tight">
                  {top.name}
                </CardTitle>
                <div className="flex flex-wrap items-center gap-2">
                  <ConfidenceBadge probability={top.confidence} />
                  <SafetyBadge level={top.riskLevel} />
                </div>
              </div>
              <CardDescription className="text-sm leading-relaxed">
                {top.description}
              </CardDescription>
            </CardHeader>
            {top.reasoning.length > 0 && (
              <CardContent>
                <div className="rounded-lg bg-muted/40 p-4">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Why FixIt thinks this
                  </p>
                  <ul className="space-y-1.5 text-sm">
                    {top.reasoning.map((r, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <Check
                          className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary"
                          aria-hidden
                        />
                        <span>{r}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </CardContent>
            )}
          </Card>
        )}

        {/* Runner-up causes */}
        {runnerUps.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Other possibilities</CardTitle>
              <CardDescription>
                If the top cause isn't right, these are also worth checking.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {runnerUps.map((c, i) => (
                <div
                  key={c.causeId}
                  className="flex items-start justify-between gap-2 rounded-lg border border-border p-3"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium leading-tight">{c.name}</p>
                    <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                      {c.description}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <ConfidenceBadge probability={c.confidence} />
                    <SafetyBadge level={c.riskLevel} />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Troubleshooting steps */}
        {troubleshootingSteps.length > 0 && !showEscalationFlow && (
          <div className="space-y-4">
            <div>
              <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
                <Wrench className="h-5 w-5 text-primary" aria-hidden />
                Try fixing it yourself
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Follow these steps in order. Mark each one as solved, didn't
                work, or skip.
              </p>
            </div>
            <ol className="space-y-4">
              {troubleshootingSteps.map((step, i) => (
                <TroubleshootingStepCard
                  key={step.id}
                  step={step}
                  index={i}
                  result={stepResults.find((r) => r.stepId === step.id)}
                  onStep={onStep}
                  sessionId={sessionId}
                />
              ))}
            </ol>
          </div>
        )}

        {/* If escalation flow and no steps shown, prompt to find tech */}
        {showEscalationFlow && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">What now?</CardTitle>
              <CardDescription>
                A qualified technician can diagnose on-site and order any parts
                needed.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={onFindTechnician} disabled={findingTechnician}>
                {findingTechnician ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Finding…
                  </>
                ) : (
                  <>
                    <Search className="h-4 w-4" /> Find a technician
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Right panel: live causes (frozen at completion) */}
      <aside className="lg:sticky lg:top-20 lg:self-start">
        <PossibleCausesPanel causes={causes} escalation={escalation} />
        {top && (
          <Card className="mt-4">
            <CardHeader>
              <CardTitle className="text-sm">Risk summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Top cause risk</span>
                <RiskBadge level={top.riskLevel} />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Confidence</span>
                <span className="font-medium">
                  {confidenceTier(top.confidence)} · {Math.round(top.confidence * 100)}%
                </span>
              </div>
              {top.professionalRecommended && (
                <div className="flex items-center gap-2 rounded-md bg-amber-50 p-2 text-xs text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
                  <ShieldAlert className="h-3.5 w-3.5" aria-hidden />
                  Professional repair recommended for this cause.
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </aside>
    </div>
  );
}

function TroubleshootingStepCard({
  step,
  index,
  result,
  onStep,
  sessionId,
}: {
  step: TroubleshootingStep;
  index: number;
  result?: StepResult;
  onStep: (stepId: string, status: "SOLVED" | "FAILED" | "SKIPPED") => void;
  sessionId: string;
}) {
  const tools = step.requiredTools ? formatList(step.requiredTools.split(",")) : "";
  const [aiExplanation, setAiExplanation] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [showAi, setShowAi] = useState(false);

  async function fetchAiExplanation() {
    if (aiExplanation) { setShowAi(true); return; }
    setAiLoading(true);
    try {
      const res = await fetch(`/api/ai/explain-step`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, stepId: step.id }),
      });
      const data = await res.json();
      if (data.explanation) {
        setAiExplanation(data.explanation.explanation);
        setShowAi(true);
      } else if (data.fellBack) {
        toast.info("AI explanation unavailable — showing the standard instructions.");
      }
    } catch {
      toast.error("Could not load AI explanation.");
    } finally {
      setAiLoading(false);
    }
  }

  return (
    <li>
      <Card
        className={cn(
          result?.status === "SOLVED" && "border-emerald-300 bg-emerald-50/40 dark:border-emerald-800 dark:bg-emerald-950/20",
          result?.status === "FAILED" && "opacity-75"
        )}
      >
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                {index + 1}
              </span>
              <div>
                <CardTitle className="text-base leading-tight">
                  {step.title}
                </CardTitle>
                <CardDescription className="mt-1 text-sm">
                  {step.description}
                </CardDescription>
              </div>
            </div>
            {result && <StepResultBadge status={result.status} />}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2 pl-10 text-xs">
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 font-medium",
                DIFFICULTY_STYLE[step.difficulty] ?? DIFFICULTY_STYLE.EASY
              )}
            >
              {DIFFICULTY_LABEL[step.difficulty] ?? step.difficulty}
            </span>
            <span className="inline-flex items-center gap-1 text-muted-foreground">
              <Clock className="h-3 w-3" aria-hidden />
              ~{step.estimatedMinutes} min
            </span>
            <SafetyBadge level={step.safetyLevel} />
            <button
              onClick={fetchAiExplanation}
              disabled={aiLoading}
              className="inline-flex items-center gap-1 rounded-md border border-primary/30 bg-primary/5 px-1.5 py-0.5 font-medium text-primary hover:bg-primary/10 disabled:opacity-50"
            >
              <Sparkles className="h-3 w-3" />
              {aiLoading ? "Explaining…" : aiExplanation ? "Show AI explanation" : "Explain in plain language"}
            </button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {showAi && aiExplanation && (
            <div className="rounded-md border border-primary/20 bg-primary/5 p-3">
              <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-primary">
                <Sparkles className="h-3.5 w-3.5" /> AI explanation
              </p>
              <p className="mt-1 leading-relaxed">{aiExplanation}</p>
            </div>
          )}
          {tools && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Tools needed
              </p>
              <p className="mt-0.5">{tools}</p>
            </div>
          )}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Instructions
            </p>
            <pre className="mt-1 whitespace-pre-wrap rounded-md bg-muted/40 p-3 font-sans text-sm leading-relaxed">
              {step.instructions}
            </pre>
          </div>
          {step.expectedResult && (
            <div className="rounded-md border border-emerald-200 bg-emerald-50/60 p-3 text-sm dark:border-emerald-800 dark:bg-emerald-950/20">
              <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-emerald-800 dark:text-emerald-300">
                <CheckCircle2 className="h-3.5 w-3.5" aria-hidden /> Expected result
              </p>
              <p className="mt-1 text-emerald-900 dark:text-emerald-200">
                {step.expectedResult}
              </p>
            </div>
          )}
          {step.failureResult && (
            <div className="rounded-md border border-amber-200 bg-amber-50/60 p-3 text-sm dark:border-amber-800 dark:bg-amber-950/20">
              <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-amber-800 dark:text-amber-300">
                <AlertTriangle className="h-3.5 w-3.5" aria-hidden /> If it doesn't work
              </p>
              <p className="mt-1 text-amber-900 dark:text-amber-200">
                {step.failureResult}
              </p>
            </div>
          )}

          {!result && (
            <div className="rounded-md border border-border bg-muted/30 p-3">
              <p className="mb-2 text-sm font-medium">Did this solve the problem?</p>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="default"
                  onClick={() => onStep(step.id, "SOLVED")}
                  className="bg-emerald-600 text-white hover:bg-emerald-700"
                >
                  <Check className="h-4 w-4" /> Solved
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onStep(step.id, "FAILED")}
                >
                  <X className="h-4 w-4" /> Didn't work
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => onStep(step.id, "SKIPPED")}
                >
                  <SkipForward className="h-4 w-4" /> Skip
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </li>
  );
}

function StepResultBadge({ status }: { status: StepResult["status"] }) {
  if (status === "SOLVED") {
    return (
      <span className="inline-flex items-center gap-1 rounded-md border border-emerald-300 bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
        <CheckCircle2 className="h-3 w-3" aria-hidden /> Solved
      </span>
    );
  }
  if (status === "FAILED") {
    return (
      <span className="inline-flex items-center gap-1 rounded-md border border-amber-300 bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300">
        <X className="h-3 w-3" aria-hidden /> Didn't work
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-md border border-border bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
      <SkipForward className="h-3 w-3" aria-hidden /> Skipped
    </span>
  );
}

// ───────────────────────────── Celebration view ─────────────────────────────

function CelebrationView({
  causeName,
  onBackToDiagnose,
  onViewHistory,
}: {
  causeName?: string;
  onBackToDiagnose: () => void;
  onViewHistory: () => void;
}) {
  return (
    <Card className="overflow-hidden border-emerald-300 bg-emerald-50/40 dark:border-emerald-800 dark:bg-emerald-950/20">
      <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300">
          <PartyPopper className="h-8 w-8" aria-hidden />
        </div>
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Problem solved!</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {causeName
              ? `You successfully fixed the issue with "${causeName}".`
              : "You successfully fixed the issue."}
            <br />
            We've marked your problem as resolved.
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-2">
          <ShieldCheck className="h-4 w-4 text-emerald-700 dark:text-emerald-300" aria-hidden />
          <span className="text-sm text-emerald-800 dark:text-emerald-200">
            Saved to your history.
          </span>
        </div>
        <div className="mt-2 flex flex-wrap justify-center gap-2">
          <Button onClick={onViewHistory}>
            <Clock className="h-4 w-4" /> View history
          </Button>
          <Button variant="outline" onClick={onBackToDiagnose}>
            <RotateCcw className="h-4 w-4" /> Diagnose another problem
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
