import { db } from "../../../src/lib/db";
import { allCategories } from "../categories";
import { allErrorCodes } from "../error-codes";

export async function seedEquipmentAndDiagnostics() {
  for (const cat of allCategories) {
    const created = await db.equipmentCategory.upsert({
      where: { slug: cat.slug },
      update: {
        name: cat.name,
        icon: cat.icon,
        description: cat.description,
      },
      create: {
        slug: cat.slug,
        name: cat.name,
        icon: cat.icon,
        description: cat.description,
      },
    });

    for (const mod of cat.models) {
      await db.equipmentModel.upsert({
        where: {
          categoryId_brand_model: {
            categoryId: created.id,
            brand: mod.brand,
            model: mod.model,
          },
        },
        update: {},
        create: {
          categoryId: created.id,
          brand: mod.brand,
          model: mod.model,
        },
      });
    }

    for (const sym of cat.symptoms) {
      let symptom = await db.symptom.findFirst({
        where: { categoryId: created.id, slug: sym.slug },
      });
      if (!symptom) {
        symptom = await db.symptom.create({
          data: {
            categoryId: created.id,
            slug: sym.slug,
            name: sym.name,
            description: sym.description,
          },
        });
      } else {
        await db.symptom.update({
          where: { id: symptom.id },
          data: { name: sym.name, description: sym.description },
        });
      }

      // Create causes first (rules + questions reference them).
      const causeMap = new Map<string, string>();
      for (const c of sym.causes) {
        let cause = await db.possibleCause.findFirst({
          where: { categoryId: created.id, slug: c.slug },
        });

        if (!cause) {
          cause = await db.possibleCause.create({
            data: {
              categoryId: created.id,
              slug: c.slug,
              name: c.name,
              description: c.description,
              riskLevel: c.riskLevel,
              baseConfidence: c.baseConfidence,
              professionalRecommended: c.professionalRecommended,
              troubleshootingSteps: {
                create: c.steps.map((s) => ({
                  title: s.title,
                  description: s.description,
                  difficulty: s.difficulty,
                  estimatedMinutes: s.estimatedMinutes,
                  safetyLevel: s.safetyLevel,
                  requiredTools: s.requiredTools,
                  instructions: s.instructions,
                  expectedResult: s.expectedResult,
                  failureResult: s.failureResult,
                  order: s.order,
                })),
              },
            },
          });
        }
        causeMap.set(c.slug, cause.id);
      }

      // Questions + options.
      for (const q of sym.questions) {
        const existingQuestion = await db.diagnosticQuestion.findFirst({
          where: { categoryId: created.id, key: q.key },
        });

        if (!existingQuestion) {
          await db.diagnosticQuestion.create({
            data: {
              categoryId: created.id,
              symptomId: symptom.id,
              key: q.key,
              text: q.text,
              helpText: q.helpText,
              inputType: q.inputType,
              order: q.order,
              required: true,
              options: {
                create: q.options,
              },
            },
          });
        }
      }

      // Rules.
      for (const r of sym.rules) {
        const causeId = causeMap.get(r.causeSlug);
        if (!causeId) continue;

        const existingRule = await db.diagnosticRule.findFirst({
          where: {
            categoryId: created.id,
            symptomId: symptom.id,
            questionKey: r.questionKey,
            optionValue: r.optionValue,
            causeId,
          },
        });

        if (!existingRule) {
          await db.diagnosticRule.create({
            data: {
              categoryId: created.id,
              symptomId: symptom.id,
              questionKey: r.questionKey,
              optionValue: r.optionValue,
              operator: r.operator ?? "eq",
              causeId,
              weight: r.weight ?? 1.0,
              escalate: r.escalate ?? false,
              escalateReason: r.escalateReason,
            },
          });
        }
      }
    }
  }

  // Seed Error Codes
  await db.equipmentErrorCode.deleteMany();
  for (const err of allErrorCodes) {
    let catSlug = err.categorySlug;
    if (!catSlug) {
      catSlug = "washing_machine";
      if (err.brand === "Bosch" && err.code.startsWith("E")) catSlug = "dishwasher";
      if (err.brand === "LG" && err.code.startsWith("ER")) catSlug = "refrigerator";
      if (err.brand === "LG" && err.code === "CH05") catSlug = "air_conditioner";
      if (err.brand === "DeWalt") catSlug = "power_tools";
      if (err.brand === "Dell") catSlug = "electronics";
      if (err.brand === "Honda") catSlug = "power_equipment";
    }

    const cat = await db.equipmentCategory.findUnique({ where: { slug: catSlug } });
    if (!cat) continue;

    await db.equipmentErrorCode.create({
      data: {
        categoryId: cat.id,
        brand: err.brand,
        modelPattern: err.modelPattern,
        code: err.code,
        meaning: err.meaning,
        severity: err.severity,
        riskLevel: err.riskLevel,
        possibleCauses: err.possibleCauses,
        recommendedActions: err.recommendedActions,
        professionalRequired: err.professionalRequired,
      },
    });
  }

  console.log(
    `  equipment+diagnostics: ${allCategories.length} categories seeded`
  );
}
