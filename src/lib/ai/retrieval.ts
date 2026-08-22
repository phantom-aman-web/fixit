// Lightweight knowledge retrieval. Pulls relevant diagnostic context from the
// existing database to ground AI prompts. This is NOT a vector database — it
// uses the simplest reliable strategy: fetch by category + symptom.

import { db } from "@/lib/db";

export interface KnowledgeContext {
  equipmentCategories: { slug: string; name: string }[];
  symptoms: { slug: string; name: string; categoryId: string }[];
  questions: { key: string; text: string; options: { value: string; label: string }[] }[];
  causes: { slug: string; name: string; riskLevel: string; professionalRecommended: boolean }[];
  errorCodes: { code: string; meaning: string; riskLevel: string; brand: string | null }[];
}

// Retrieve knowledge relevant to a free-text problem. We match on category
// keywords + symptom keywords to pull a focused subset.
export async function retrieveKnowledge(problemText: string): Promise<KnowledgeContext> {
  const text = problemText.toLowerCase();
  
  // Include models to improve text matching capability
  const allCats = await db.equipmentCategory.findMany({ 
    include: { symptoms: true, models: true } 
  });

  // Match categories by slug/name keywords or model brands.
  const matchedCats = allCats.filter((c) => {
    const slugWords = c.slug.replace(/_/g, " ").split(" ");
    const matchesSlug = slugWords.some((w) => text.includes(w));
    const matchesName = text.includes(c.name.toLowerCase());
    const matchesDesc = c.description ? text.includes(c.description.toLowerCase()) : false;
    const matchesModel = c.models.some(m => text.includes(m.brand.toLowerCase()) || text.includes(m.model.toLowerCase()));
    
    return matchesSlug || matchesName || matchesDesc || matchesModel;
  });

  // If nothing matched, return all (the AI will still need to pick one).
  const relevantCats = matchedCats.length > 0 ? matchedCats : allCats;

  const catIds = relevantCats.map((c) => c.id);
  const [questions, causes, errorCodes] = await Promise.all([
    db.diagnosticQuestion.findMany({
      where: { categoryId: { in: catIds } },
      include: { options: { orderBy: { order: "asc" } } },
      orderBy: { order: "asc" },
      take: 20,
    }),
    db.possibleCause.findMany({
      where: { categoryId: { in: catIds } },
      take: 20,
    }),
    db.equipmentErrorCode.findMany({
      where: { categoryId: { in: catIds } },
      take: 50,
    }),
  ]);

  return {
    equipmentCategories: relevantCats.map((c) => ({ slug: c.slug, name: c.name })),
    symptoms: relevantCats.flatMap((c) => c.symptoms.map((s) => ({ slug: s.slug, name: s.name, categoryId: c.id }))),
    questions: questions.map((q) => ({
      key: q.key,
      text: q.text,
      options: q.options.map((o) => ({ value: o.value, label: o.label })),
    })),
    causes: causes.map((c) => ({
      slug: c.slug,
      name: c.name,
      riskLevel: c.riskLevel,
      professionalRecommended: c.professionalRecommended,
    })),
    errorCodes: errorCodes.map((e) => ({
      code: e.code,
      meaning: e.meaning,
      riskLevel: e.riskLevel,
      brand: e.brand,
    })),
  };
}

// Format knowledge into a compact string for the AI prompt.
export function formatKnowledgeForPrompt(k: KnowledgeContext): string {
  const lines: string[] = [];
  lines.push("EQUIPMENT CATEGORIES:");
  for (const c of k.equipmentCategories) lines.push(`- ${c.slug}: ${c.name}`);
  lines.push("");
  lines.push("SYMPTOMS:");
  for (const s of k.symptoms) lines.push(`- ${s.slug}: ${s.name}`);
  
  if (k.errorCodes && k.errorCodes.length > 0) {
    lines.push("");
    lines.push("ERROR CODES (mapped to categories):");
    for (const e of k.errorCodes) {
      lines.push(`- [${e.brand || "Generic"}] ${e.code}: ${e.meaning} (Risk: ${e.riskLevel})`);
    }
  }

  lines.push("");
  lines.push("DIAGNOSTIC QUESTIONS:");
  for (const q of k.questions) {
    lines.push(`- ${q.key}: ${q.text}`);
    if (q.options.length) lines.push(`  options: ${q.options.map((o) => `${o.value}(${o.label})`).join(", ")}`);
  }
  lines.push("");
  lines.push("KNOWN CAUSES (safety levels are authoritative — AI must not downgrade):");
  for (const c of k.causes) {
    lines.push(`- ${c.name} [${c.riskLevel}${c.professionalRecommended ? " / PROFESSIONAL_RECOMMENDED" : ""}]`);
  }
  return lines.join("\n");
}

// Retrieve a map of cause name → safety level for a given category, used by
// the safety gate to enforce that AI cannot downgrade PROFESSIONAL_ONLY causes.
export async function retrieveCauseSafetyMap(categoryId: string): Promise<Record<string, string>> {
  const causes = await db.possibleCause.findMany({ where: { categoryId } });
  const map: Record<string, string> = {};
  for (const c of causes) {
    map[c.name] = c.riskLevel;
    map[c.slug] = c.riskLevel;
  }
  return map;
}
