import { SeedCategory } from "../types";

export const plumbingCategories: SeedCategory[] = [
  {
    slug: "water_heater",
    name: "Water Heater",
    icon: "droplet",
    description: "Gas, electric, and tankless water heaters.",
    models: [
      { brand: "Rheem", model: "Performance Plus" },
      { brand: "A.O. Smith", model: "Signature" },
    ],
    symptoms: [
      {
        slug: "no_hot_water",
        name: "No Hot Water",
        description: "The unit is not producing hot water.",
        questions: [
          {
            key: "heater_type",
            text: "Is this a gas or electric water heater?",
            inputType: "SINGLE_SELECT",
            order: 0,
            options: [
              { value: "gas", label: "Gas" },
              { value: "electric", label: "Electric" },
              { value: "tankless", label: "Tankless" },
              { value: "unknown", label: "I don't know" },
            ],
          },
          {
            key: "pilot_light",
            text: "If it's gas, is the pilot light lit?",
            inputType: "SINGLE_SELECT",
            order: 1,
            options: [
              { value: "yes", label: "Yes, it's lit" },
              { value: "no", label: "No, it's out" },
              { value: "na", label: "Not applicable (Electric / Unknown)" },
            ],
          },
        ],
        causes: [
          {
            slug: "pilot_out",
            name: "Pilot Light Extinguished",
            description: "The pilot light has gone out, preventing the burner from igniting.",
            riskLevel: "CAUTION",
            baseConfidence: 0.6,
            professionalRecommended: false,
            steps: [
              {
                title: "Relight Pilot",
                description: "Follow the manufacturer instructions on the gas valve to relight.",
                difficulty: "MEDIUM",
                estimatedMinutes: 10,
                safetyLevel: "CAUTION",
                requiredTools: "Lighter (if manual)",
                instructions: "Turn knob to 'Pilot'. Press and hold knob down while pressing the igniter button until the flame lights. Hold for 30-60 seconds. If you smell gas, DO NOT attempt to light. Turn off gas and call a professional.",
                expectedResult: "Pilot stays lit and burner ignites.",
                failureResult: "If it won't stay lit, the thermocouple may be faulty.",
                order: 0,
              },
            ],
          },
          {
            slug: "heating_element_failed",
            name: "Failed Heating Element",
            description: "The electric heating element has burnt out.",
            riskLevel: "PROFESSIONAL_ONLY",
            baseConfidence: 0.5,
            professionalRecommended: true,
            steps: [
              {
                title: "Test and Replace Element",
                description: "Requires working with 240V electricity and draining the tank.",
                difficulty: "ADVANCED",
                estimatedMinutes: 60,
                safetyLevel: "PROFESSIONAL_ONLY",
                requiredTools: "Multimeter, element wrench",
                instructions: "Turn off breaker. Drain tank below element level. Test element for continuity. If open, replace. THIS INVOLVES DEADLY VOLTAGE. Professional service recommended.",
                expectedResult: "Water heats up normally.",
                failureResult: "N/A",
                order: 0,
              },
            ],
          },
        ],
        rules: [
          {
            questionKey: "heater_type",
            optionValue: "gas",
            causeSlug: "pilot_out",
            weight: 0.5,
          },
          {
            questionKey: "pilot_light",
            optionValue: "no",
            causeSlug: "pilot_out",
            weight: 1.5,
          },
          {
            questionKey: "heater_type",
            optionValue: "electric",
            causeSlug: "heating_element_failed",
            weight: 1.0,
          },
        ],
      },
    ],
  },
];
