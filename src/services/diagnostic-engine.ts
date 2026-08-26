import { db } from "@/lib/db";

// Deterministic diagnostic engine. No AI. Data-driven from the DB.
//
// Flow:
//   startSession(customerId, {categoryId, symptomId, problemId?, equipmentId?})
//     → creates a DiagnosticSession, returns it + the first question
//   answerQuestion(sessionId, questionKey, values[])
//     → persists answer, evaluates rules, updates possibleCauses,
//       advances currentQuestionKey, returns {session, nextQuestion, possibleCauses}
//   getSessionState(sessionId)
//     → returns the full session with computed causes + next question
//   completeDiagnosis(sessionId)
//     → finalizes ranked diagnoses, sets riskLevel + escalation
//   recordStepResult(sessionId, stepId, status, notes?)
//     → records a troubleshooting attempt; may escalate on failure

export interface ComputedCause {
  causeId: string;
  slug: string;
  name: string;
  description: string;
  riskLevel: string;
  confidence: number; // 0..1
  professionalRecommended: boolean;
  reasoning: string[];
}

export interface SessionState {
  session: Awaited<ReturnType<typeof db.diagnosticSession.findUnique>>;
  questions: { key: string; text: string; helpText: string | null; inputType: string; order: number; options: { value: string; label: string }[] }[];
  answers: Record<string, string[]>;
  possibleCauses: ComputedCause[];
  escalation: { escalate: boolean; reason?: string };
  nextQuestionKey: string | null;
}

export async function startSession(params: {
  customerId: string;
  categoryId: string;
  symptomId: string;
  problemId?: string;
  equipmentId?: string;
}) {
  const cat = await db.equipmentCategory.findUnique({ where: { id: params.categoryId } });
  if (!cat) throw new Error("Category not found");
  const symptom = await db.symptom.findFirst({
    where: { id: params.symptomId, categoryId: params.categoryId },
  });
  if (!symptom) throw new Error("Symptom not found");

  const questions = await orderedQuestions(params.categoryId, params.symptomId);

  const session = await db.diagnosticSession.create({
    data: {
      customerId: params.customerId,
      categoryId: params.categoryId,
      symptomId: params.symptomId,
      symptomSlug: symptom.slug,
      problemId: params.problemId,
      equipmentId: params.equipmentId,
      status: "IN_PROGRESS",
      currentQuestionKey: questions.length > 0 ? questions[0].key : null,
      answersJson: JSON.stringify({}),
      possibleCausesJson: JSON.stringify([]),
    },
  });

  return getSessionState(session.id);
}

async function orderedQuestions(categoryId: string, symptomId: string) {
  // Prefer symptom-specific questions; fall back to category-general questions.
  const symptomQs = await db.diagnosticQuestion.findMany({
    where: { categoryId, symptomId },
    include: { options: { orderBy: { order: "asc" } } },
    orderBy: { order: "asc" },
  });
  if (symptomQs.length > 0) return symptomQs;
  return db.diagnosticQuestion.findMany({
    where: { categoryId, symptomId: null },
    include: { options: { orderBy: { order: "asc" } } },
    orderBy: { order: "asc" },
  });
}

export async function answerQuestion(sessionId: string, questionKey: string, values: string[]) {
  const session = await db.diagnosticSession.findUnique({ where: { id: sessionId } });
  if (!session) throw new Error("Session not found");
  if (session.status !== "IN_PROGRESS") throw new Error("Session is not in progress");

  const question = await db.diagnosticQuestion.findFirst({
    where: { categoryId: session.categoryId, key: questionKey },
  });
  if (!question) throw new Error("Question not found for this category");

  // Persist normalized answer.
  const existing = await db.diagnosticAnswer.findUnique({
    where: { sessionId_questionKey: { sessionId, questionKey } },
  });
  if (existing) {
    await db.diagnosticAnswer.update({
      where: { id: existing.id },
      data: { valuesJson: JSON.stringify(values), questionText: question.text },
    });
  } else {
    await db.diagnosticAnswer.create({
      data: { sessionId, questionKey, questionText: question.text, valuesJson: JSON.stringify(values) },
    });
  }

  // Update answers map on the session.
  const answers = parseAnswers(session.answersJson);
  answers[questionKey] = values;
  await db.diagnosticSession.update({
    where: { id: sessionId },
    data: { answersJson: JSON.stringify(answers), updatedAt: new Date() },
  });

  // Recompute possible causes + advance.
  const state = await recompute(sessionId);
  return state;
}

function parseAnswers(json: string | null): Record<string, string[]> {
  if (!json) return {};
  try {
    return JSON.parse(json) as Record<string, string[]>;
  } catch {
    return {};
  }
}

async function recompute(sessionId: string): Promise<SessionState> {
  const session = await db.diagnosticSession.findUnique({ where: { id: sessionId } });
  if (!session) throw new Error("Session not found");

  const answers = parseAnswers(session.answersJson);
  const symptomId = session.symptomId ?? undefined;

  const rules = await db.diagnosticRule.findMany({
    where: { categoryId: session.categoryId, ...(symptomId ? { symptomId } : {}) },
  });

  const validCauseIds = Array.from(new Set(rules.map((r) => r.causeId)));
  
  // Load causes that have rules for this symptom.
  const causes = validCauseIds.length > 0 
    ? await db.possibleCause.findMany({
        where: { 
          categoryId: session.categoryId,
          id: { in: validCauseIds }
        },
      })
    : [];

  // Score each cause.
  const evidence: Record<string, { weight: number; reasons: string[]; escalate: boolean; escalateReason?: string }> = {};
  for (const c of causes) {
    evidence[c.id] = { weight: 0, reasons: [], escalate: false };
  }

  let anyEscalate = false;
  let escalateReason: string | undefined;

  // Preload question texts for this category to avoid N+1 queries inside the rule loop.
  const allQuestions = await db.diagnosticQuestion.findMany({
    where: { categoryId: session.categoryId },
    select: { key: true, text: true },
  });
  const questionTextByKey = new Map(allQuestions.map((q) => [q.key, q.text]));

  for (const rule of rules) {
    const ans = answers[rule.questionKey];
    if (!ans || ans.length === 0) continue;
    const matches =
      rule.operator === "any"
        ? true
        : rule.operator === "ne"
        ? !ans.includes(rule.optionValue ?? "")
        : ans.includes(rule.optionValue ?? "");
    if (!matches) continue;

    if (!evidence[rule.causeId]) evidence[rule.causeId] = { weight: 0, reasons: [], escalate: false };
    evidence[rule.causeId].weight += rule.weight;
    const qText = questionTextByKey.get(rule.questionKey);
    const reason = qText ? `${qText} → ${rule.optionValue}` : `${rule.questionKey} → ${rule.optionValue}`;
    evidence[rule.causeId].reasons.push(reason);

    if (rule.escalate) {
      anyEscalate = true;
      escalateReason = rule.escalateReason ?? escalateReason;
    }
  }

  // Normalize into confidence.
  const totalRaw = causes.reduce(
    (sum, c) => sum + (c.baseConfidence + (evidence[c.id]?.weight ?? 0)),
    0
  ) || 1;

  const computed: ComputedCause[] = causes
    .map((c) => {
      const ev = evidence[c.id] ?? { weight: 0, reasons: [], escalate: false };
      const raw = c.baseConfidence + ev.weight;
      return {
        causeId: c.id,
        slug: c.slug,
        name: c.name,
        description: c.description ?? "",
        riskLevel: c.riskLevel,
        confidence: raw / totalRaw,
        professionalRecommended: c.professionalRecommended,
        reasoning: ev.reasons,
      };
    })
    .sort((a, b) => b.confidence - a.confidence);

  // Determine risk level = highest risk among top 3 causes with confidence >= 0.15.
  const riskRank: Record<string, number> = { SAFE: 0, CAUTION: 1, PROFESSIONAL_ONLY: 2 };
  const topRelevant = computed.filter((c) => c.confidence >= 0.12).slice(0, 3);
  const riskLevel = topRelevant.length
    ? topRelevant.reduce((max, c) => (riskRank[c.riskLevel] > riskRank[max] ? c.riskLevel : max), "SAFE" as string)
    : "SAFE";

  // Escalate if a rule explicitly says so, OR the TOP cause is professional-only.
  // We do NOT escalate merely because a lower-ranked cause has PROFESSIONAL_ONLY
  // risk — that would prevent users from trying safe troubleshooting when the
  // most likely cause is benign. The riskLevel is still shown to the user as a
  // warning, but escalation (directing to professional service) only happens
  // when the top cause itself requires a professional.
  const topCause = computed[0];
  const escalate =
    anyEscalate ||
    (topCause?.professionalRecommended && topCause.confidence >= 0.25);

  if (!escalateReason && topCause?.professionalRecommended && topCause.confidence >= 0.25) {
    escalateReason = `${topCause.name} typically requires professional service.`;
  }

  // Persist computed state.
  await db.diagnosticSession.update({
    where: { id: sessionId },
    data: {
      possibleCausesJson: JSON.stringify(computed),
      riskLevel,
      escalationRecommendation: escalate ? escalateReason ?? "Professional service recommended." : null,
      updatedAt: new Date(),
    },
  });

  // Advance currentQuestionKey to the next unanswered question.
  const questions = await orderedQuestions(session.categoryId, symptomId!);
  const answeredKeys = new Set(Object.keys(answers));
  const nextQ = questions.find((q) => !answeredKeys.has(q.key));
  await db.diagnosticSession.update({
    where: { id: sessionId },
    data: { currentQuestionKey: nextQ?.key ?? null },
  });

  return buildState(await db.diagnosticSession.findUnique({ where: { id: sessionId } }), questions, answers, computed, escalate, escalateReason, nextQ?.key ?? null);
}

async function buildState(
  session: any,
  questions: any[],
  answers: Record<string, string[]>,
  computed: ComputedCause[],
  escalate: boolean,
  escalateReason: string | undefined,
  nextQuestionKey: string | null
): Promise<SessionState> {
  return {
    session,
    questions: questions.map((q) => ({
      key: q.key,
      text: q.text,
      helpText: q.helpText,
      inputType: q.inputType,
      order: q.order,
      options: (q.options ?? []).map((o: any) => ({ value: o.value, label: o.label })),
    })),
    answers,
    possibleCauses: computed,
    escalation: { escalate, reason: escalateReason },
    nextQuestionKey,
  };
}

export async function getSessionState(sessionId: string): Promise<SessionState> {
  const session = await db.diagnosticSession.findUnique({ where: { id: sessionId } });
  if (!session) throw new Error("Session not found");
  const answers = parseAnswers(session.answersJson);
  const questions = await orderedQuestions(session.categoryId, session.symptomId ?? "");
  const computed: ComputedCause[] = parseCauses(session.possibleCausesJson);
  // Recompute escalation from current state (cheap).
  const topCause = computed[0];
  const riskRank: Record<string, number> = { SAFE: 0, CAUTION: 1, PROFESSIONAL_ONLY: 2 };
  const topRelevant = computed.filter((c) => c.confidence >= 0.12).slice(0, 3);
  const riskLevel = session.riskLevel ?? (topRelevant.length
    ? topRelevant.reduce((max, c) => (riskRank[c.riskLevel] > riskRank[max] ? c.riskLevel : max), "SAFE" as string)
    : "SAFE");
  const escalate =
    !!session.escalationRecommendation ||
    (topCause?.professionalRecommended && topCause.confidence >= 0.25);
  const answeredKeys = new Set(Object.keys(answers));
  const nextQ = questions.find((q) => !answeredKeys.has(q.key));
  return {
    session,
    questions: questions.map((q) => ({
      key: q.key,
      text: q.text,
      helpText: q.helpText,
      inputType: q.inputType,
      order: q.order,
      options: (q.options ?? []).map((o: any) => ({ value: o.value, label: o.label })),
    })),
    answers,
    possibleCauses: computed,
    escalation: { escalate, reason: session.escalationRecommendation ?? undefined },
    nextQuestionKey: nextQ?.key ?? null,
  };
}

function parseCauses(json: string | null): ComputedCause[] {
  if (!json) return [];
  try {
    return JSON.parse(json) as ComputedCause[];
  } catch {
    return [];
  }
}

export async function completeDiagnosis(sessionId: string) {
  const state = await recompute(sessionId);
  const top = state.possibleCauses.slice(0, 3);

  // Persist Diagnosis rows (ranked).
  await db.diagnosis.deleteMany({ where: { sessionId } });
  for (let i = 0; i < top.length; i++) {
    const c = top[i];
    await db.diagnosis.create({
      data: {
        sessionId,
        causeId: c.causeId,
        confidence: c.confidence,
        reasoning: c.reasoning.join(" | ") || "Based on your answers.",
        rank: i + 1,
      },
    });
  }

  await db.diagnosticSession.update({
    where: { id: sessionId },
    data: {
      status: state.escalation.escalate ? "ESCALATED" : "COMPLETED",
      confidence: top[0]?.confidence ?? 0,
      riskLevel: state.session?.riskLevel ?? "SAFE",
      escalationRecommendation: state.escalation.escalate ? state.escalation.reason ?? "Professional service recommended." : null,
      recommendationJson: JSON.stringify({
        topCause: top[0] ?? null,
        escalation: state.escalation,
      }),
      completedAt: new Date(),
    },
  });

  // If a problem report is linked, mark it DIAGNOSED/ESCALATED.
  if (state.session?.problemId) {
    await db.problemReport.update({
      where: { id: state.session.problemId },
      data: { status: state.escalation.escalate ? "ESCALATED" : "DIAGNOSED" },
    });
  }

  return getSessionState(sessionId);
}

export async function recordStepResult(
  sessionId: string,
  stepId: string,
  status: "SOLVED" | "FAILED" | "SKIPPED",
  notes?: string
) {
  const session = await db.diagnosticSession.findUnique({ where: { id: sessionId } });
  if (!session) throw new Error("Session not found");
  // Troubleshooting steps may only be attempted on a COMPLETED (non-escalated)
  // session. ESCALATED sessions should direct the user to professional service,
  // not to further DIY troubleshooting.
  if (session.status !== "COMPLETED") {
    throw new Error(`Cannot record step result on a ${session.status} session`);
  }

  const step = await db.troubleshootingStep.findUnique({ where: { id: stepId } });
  if (!step) throw new Error("Step not found");

  const existing = await db.diagnosticStepResult.findFirst({
    where: { sessionId, stepId },
  });
  if (existing) {
    await db.diagnosticStepResult.update({
      where: { id: existing.id },
      data: { status, notes },
    });
  } else {
    await db.diagnosticStepResult.create({
      data: { sessionId, stepId, status, notes },
    });
  }

  // If solved, mark session COMPLETED and problem RESOLVED.
  if (status === "SOLVED") {
    await db.diagnosticSession.update({
      where: { id: sessionId },
      data: { status: "COMPLETED", completedAt: new Date(), confidence: 1 },
    });
    const s = await db.diagnosticSession.findUnique({ where: { id: sessionId } });
    if (s?.problemId) {
      await db.problemReport.update({
        where: { id: s.problemId },
        data: { status: "RESOLVED" },
      });
    }
  }

  return getSessionState(sessionId);
}
