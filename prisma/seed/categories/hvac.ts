import { SeedCategory } from "../types";

export const hvacCategories: SeedCategory[] = [
  {
    slug: "air_conditioner",
    name: "Air Conditioner",
    icon: "snowflake",
    description: "Split, window, and portable air conditioning units.",
    models: [
      { brand: "Bosch", model: "Climate 5000i" },
      { brand: "LG", model: "Dual Inverter" },
    ],
    symptoms: [
      {
        slug: "not_cooling",
        name: "Not Cooling",
        description: "Blowing air but not cold",
        questions: [
          {
            key: "fan_running",
            text: "Is the outdoor unit fan running?",
            inputType: "SINGLE_SELECT",
            order: 0,
            options: [
              { value: "yes", label: "Yes" },
              { value: "no", label: "No" },
              { value: "unknown", label: "Not sure" },
            ],
          },
          {
            key: "filter_status",
            text: "When were the indoor filters last cleaned?",
            inputType: "SINGLE_SELECT",
            order: 1,
            options: [
              { value: "recently", label: "Recently (within 1 month)" },
              { value: "long_ago", label: "More than 3 months ago" },
              { value: "never", label: "Never" },
            ],
          },
        ],
        causes: [
          {
            slug: "dirty_filter",
            name: "Dirty Air Filter",
            description: "Blocked airflow reduces cooling capacity.",
            riskLevel: "SAFE",
            baseConfidence: 0.6,
            professionalRecommended: false,
            steps: [
              {
                title: "Clean Air Filters",
                description: "Remove and wash the indoor unit filters.",
                difficulty: "EASY",
                estimatedMinutes: 10,
                safetyLevel: "SAFE",
                requiredTools: "None",
                instructions: "Open the front panel of the indoor unit. Slide out the mesh filters. Wash them under lukewarm water. Let them dry completely before reinstalling.",
                expectedResult: "Airflow improves and cooling is restored.",
                failureResult: "If still not cooling, issue may be refrigerant related.",
                order: 0,
              },
            ],
          },
          {
            slug: "refrigerant_leak",
            name: "Low Refrigerant",
            description: "System has lost refrigerant charge.",
            riskLevel: "PROFESSIONAL_ONLY",
            baseConfidence: 0.4,
            professionalRecommended: true,
            steps: [
              {
                title: "Professional Inspection",
                description: "Refrigerant handling requires certified technicians.",
                difficulty: "ADVANCED",
                estimatedMinutes: 60,
                safetyLevel: "PROFESSIONAL_ONLY",
                requiredTools: "Manifold gauge, vacuum pump, refrigerant",
                instructions: "Do not attempt to recharge yourself. Call an HVAC technician to find the leak, repair it, and recharge the system.",
                expectedResult: "System holds pressure and cools properly.",
                failureResult: "N/A",
                order: 0,
              },
            ],
          },
        ],
        rules: [
          {
            questionKey: "filter_status",
            optionValue: "long_ago",
            causeSlug: "dirty_filter",
            weight: 0.8,
          },
          {
            questionKey: "fan_running",
            optionValue: "no",
            causeSlug: "refrigerant_leak",
            weight: 0.5,
          },
        ],
      },
    ],
  },
];
