import { SeedCategory } from "../types";

export const toolCategories: SeedCategory[] = [
  {
    slug: "power_tools",
    name: "Power Tools",
    icon: "wrench",
    description: "Drills, saws, grinders, and other power tools.",
    models: [
      { brand: "Bosch", model: "GSR 18V-50" },
      { brand: "DeWalt", model: "DCD791" },
    ],
    symptoms: [
      {
        slug: "smoking",
        name: "Smoking or Burning Smell",
        description: "Tool emits smoke or smells like burning plastic/metal.",
        questions: [
          {
            key: "smoke_origin",
            text: "Where is the smoke coming from?",
            inputType: "SINGLE_SELECT",
            order: 0,
            options: [
              { value: "motor", label: "From the motor vents" },
              { value: "battery", label: "From the battery pack" },
              { value: "chuck", label: "From the chuck or blade area" },
            ],
          },
        ],
        causes: [
          {
            slug: "motor_burnt",
            name: "Burnt Motor",
            description: "The motor windings or brushes have overheated and burnt.",
            riskLevel: "HIGH",
            baseConfidence: 0.8,
            professionalRecommended: true,
            steps: [
              {
                title: "Stop Using Immediately",
                description: "Continuing to use a burnt motor can cause a fire.",
                difficulty: "EASY",
                estimatedMinutes: 0,
                safetyLevel: "HIGH",
                requiredTools: "None",
                instructions: "Unplug the tool or remove the battery immediately. Place it in a safe, non-flammable area. Do not attempt to use it again.",
                expectedResult: "Tool is safely powered down.",
                failureResult: "N/A",
                order: 0,
              },
            ],
          },
          {
            slug: "battery_thermal_runaway",
            name: "Battery Thermal Runaway",
            description: "The lithium-ion battery is critically overheating.",
            riskLevel: "EMERGENCY",
            baseConfidence: 0.9,
            professionalRecommended: true,
            steps: [
              {
                title: "Evacuate and Isolate",
                description: "Lithium-ion battery fires are extremely dangerous and cannot be easily extinguished.",
                difficulty: "EASY",
                estimatedMinutes: 0,
                safetyLevel: "EMERGENCY",
                requiredTools: "None",
                instructions: "If safe to do so, move the tool/battery outdoors away from flammable materials. DO NOT touch a smoking battery with bare hands. Evacuate the area and call emergency services if a fire starts.",
                expectedResult: "Personal safety is maintained.",
                failureResult: "N/A",
                order: 0,
              },
            ],
          },
        ],
        rules: [
          {
            questionKey: "smoke_origin",
            optionValue: "motor",
            causeSlug: "motor_burnt",
            weight: 1.0,
            escalate: true,
            escalateReason: "Electrical fire risk",
          },
          {
            questionKey: "smoke_origin",
            optionValue: "battery",
            causeSlug: "battery_thermal_runaway",
            weight: 2.0,
            escalate: true,
            escalateReason: "Battery thermal runaway risk",
          },
        ],
      },
    ],
  },
];
