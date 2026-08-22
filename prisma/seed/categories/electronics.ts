import { SeedCategory } from "../types";

export const electronicsCategories: SeedCategory[] = [
  {
    slug: "electronics",
    name: "Electronics",
    icon: "laptop",
    description: "Computers, laptops, displays, and smart devices.",
    models: [
      { brand: "Apple", model: "MacBook Pro" },
      { brand: "Dell", model: "XPS 15" },
    ],
    symptoms: [
      {
        slug: "unexpected_shutdown",
        name: "Unexpected Shutdown",
        description: "Device powers off suddenly without warning.",
        questions: [
          {
            key: "shutdown_timing",
            text: "When does the shutdown usually occur?",
            inputType: "SINGLE_SELECT",
            order: 0,
            options: [
              { value: "under_load", label: "When playing games or doing heavy work" },
              { value: "on_battery", label: "Only when running on battery" },
              { value: "randomly", label: "Completely randomly" },
            ],
          },
          {
            key: "device_temperature",
            text: "Does the device feel unusually hot before it shuts down?",
            inputType: "SINGLE_SELECT",
            order: 1,
            options: [
              { value: "very_hot", label: "Yes, very hot to the touch" },
              { value: "normal", label: "No, feels normal" },
            ],
          },
        ],
        causes: [
          {
            slug: "thermal_throttling",
            name: "Overheating (Thermal Shutdown)",
            description: "The system is shutting down to protect itself from excessive heat.",
            riskLevel: "SAFE",
            baseConfidence: 0.7,
            professionalRecommended: false,
            steps: [
              {
                title: "Check Air Vents",
                description: "Ensure the cooling system can breathe.",
                difficulty: "EASY",
                estimatedMinutes: 5,
                safetyLevel: "SAFE",
                requiredTools: "None",
                instructions: "Verify that all air vents are clear of dust and not blocked by blankets or clothing. Place the laptop on a hard, flat surface.",
                expectedResult: "Device runs cooler and stops shutting down.",
                failureResult: "If vents are clear, internal thermal paste or fans may have failed.",
                order: 0,
              },
            ],
          },
          {
            slug: "failing_battery",
            name: "Degraded Battery",
            description: "The battery can no longer sustain voltage under load.",
            riskLevel: "SAFE",
            baseConfidence: 0.6,
            professionalRecommended: false,
            steps: [
              {
                title: "Check Battery Health",
                description: "Use the OS to verify battery condition.",
                difficulty: "EASY",
                estimatedMinutes: 5,
                safetyLevel: "SAFE",
                requiredTools: "None",
                instructions: "In Windows, generate a Battery Report. On macOS, check System Information > Power for 'Condition'.",
                expectedResult: "Report indicates if the battery needs replacement.",
                failureResult: "N/A",
                order: 0,
              },
            ],
          },
        ],
        rules: [
          {
            questionKey: "shutdown_timing",
            optionValue: "under_load",
            causeSlug: "thermal_throttling",
            weight: 0.5,
          },
          {
            questionKey: "device_temperature",
            optionValue: "very_hot",
            causeSlug: "thermal_throttling",
            weight: 1.0,
          },
          {
            questionKey: "shutdown_timing",
            optionValue: "on_battery",
            causeSlug: "failing_battery",
            weight: 1.5,
          },
        ],
      },
    ],
  },
];
