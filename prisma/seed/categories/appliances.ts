import { SeedCategory } from "../types";

export const applianceCategories: SeedCategory[] = [
  // ───────────────────── Washing machine ─────────────────────
  {
    slug: "washing_machine",
    name: "Washing Machine",
    icon: "washing-machine",
    description: "Front-load and top-load washing machines.",
    models: [
      { brand: "LG", model: "Front Load 7kg" },
      { brand: "Samsung", model: "Top Load 9kg" },
      { brand: "Beko", model: "Front Load 8kg" },
    ],
    symptoms: [
      {
        slug: "loud_noise_during_spin",
        name: "Loud noise during spin cycle",
        description: "Machine makes an unusual noise when spinning.",
        questions: [
          {
            key: "when_noise",
            text: "When does the noise happen?",
            inputType: "SINGLE_SELECT",
            order: 0,
            options: [
              { value: "during_wash", label: "During washing" },
              { value: "during_spin", label: "During spinning" },
              { value: "during_drain", label: "During draining" },
              { value: "all_the_time", label: "All the time" },
              { value: "not_sure", label: "I'm not sure" },
            ],
          },
          {
            key: "noise_type",
            text: "What does the noise sound like?",
            inputType: "SINGLE_SELECT",
            order: 1,
            options: [
              { value: "banging", label: "Banging" },
              { value: "grinding", label: "Grinding" },
              { value: "scraping", label: "Scraping" },
              { value: "clicking", label: "Clicking" },
              { value: "humming", label: "Humming" },
              { value: "other", label: "Other" },
            ],
          },
          {
            key: "recently_moved",
            text: "Was the machine recently moved or installed?",
            inputType: "SINGLE_SELECT",
            order: 2,
            options: [
              { value: "yes", label: "Yes" },
              { value: "no", label: "No" },
            ],
          },
          {
            key: "load_size",
            text: "How full was the drum when the noise occurred?",
            inputType: "SINGLE_SELECT",
            order: 3,
            options: [
              { value: "small", label: "Small load" },
              { value: "normal", label: "Normal load" },
              { value: "large", label: "Large load" },
              { value: "overloaded", label: "Overloaded / very full" },
            ],
          },
          {
            key: "level_feet",
            text: "Does the machine sit level and stable on the floor?",
            inputType: "SINGLE_SELECT",
            order: 4,
            options: [
              { value: "level", label: "Yes, it is level" },
              { value: "wobbly", label: "No, it wobbles" },
              { value: "unknown", label: "I'm not sure" },
            ],
          },
        ],
        causes: [
          {
            slug: "unbalanced_load",
            name: "Unbalanced load",
            description:
              "Laundry has clustered on one side of the drum, causing vibration and banging during the high-speed spin.",
            riskLevel: "SAFE",
            baseConfidence: 0.55,
            professionalRecommended: false,
            steps: [
              {
                title: "Redistribute the load and re-run spin",
                description:
                  "Pause the cycle, open the door, and spread items evenly around the drum.",
                difficulty: "EASY",
                estimatedMinutes: 5,
                safetyLevel: "SAFE",
                requiredTools: "None",
                instructions:
                  "1. Pause the machine and wait for the drum to stop.\n2. Open the door and redistribute laundry evenly.\n3. Remove a few items if the drum is very full.\n4. Close the door and restart a spin-only cycle.\n5. Observe whether vibration improves.",
                expectedResult:
                  "The spin cycle runs quietly with minimal vibration.",
                failureResult:
                  "Noise continues — the cause is likely mechanical, not load distribution.",
                order: 0,
              },
            ],
          },
          {
            slug: "machine_not_level",
            name: "Machine not level",
            description:
              "One or more feet are not adjusted, so the machine rocks during spin.",
            riskLevel: "SAFE",
            baseConfidence: 0.45,
            professionalRecommended: false,
            steps: [
              {
                title: "Level the machine feet",
                description:
                  "Adjust the adjustable feet so all four touch the floor firmly.",
                difficulty: "EASY",
                estimatedMinutes: 10,
                safetyLevel: "SAFE",
                requiredTools: "Spirit level (optional), wrench",
                instructions:
                  "1. Unplug the machine for safety.\n2. Rock the machine gently corner to corner to find the loose foot.\n3. Rotate the adjustable foot counter-clockwise to extend it until it touches the floor.\n4. Repeat for all corners until no rocking remains.\n5. If you have a level, aim for the bubble centered in both directions.\n6. Tighten the locknut on each foot.\n7. Plug in and run a short spin cycle.",
                expectedResult: "Machine stays firmly planted; no rocking.",
                failureResult:
                  "Machine still rocks — floor may be uneven; use a mat or shims.",
                order: 0,
              },
            ],
          },
          {
            slug: "foreign_object",
            name: "Foreign object in drum",
            description:
              "Coins, keys, or debris are trapped between the drum and tub, causing scraping or clicking.",
            riskLevel: "CAUTION",
            baseConfidence: 0.4,
            professionalRecommended: false,
            steps: [
              {
                title: "Inspect and remove foreign objects",
                description:
                  "Check the drum, gasket, and filter for trapped items.",
                difficulty: "MODERATE",
                estimatedMinutes: 15,
                safetyLevel: "CAUTION",
                requiredTools: "Towel, shallow container",
                instructions:
                  "1. Unplug the machine.\n2. Empty all pockets of laundry before reloading.\n3. Run your hand around the rubber door gasket and remove debris.\n4. Locate the small filter access door at the bottom front.\n5. Place a towel and shallow container to catch water.\n6. Slowly unscrew the filter and remove any trapped objects.\n7. Reinstall the filter, plug in, and run a rinse/spin.",
                expectedResult: "No scraping or clicking during spin.",
                failureResult:
                  "Noise persists — object may be deeper; professional service recommended.",
                order: 0,
              },
            ],
          },
          {
            slug: "drum_bearing_wear",
            name: "Drum bearing wear",
            description:
              "The rear drum bearing is failing, producing a deep grinding roar during spin. This is a component-level repair.",
            riskLevel: "PROFESSIONAL_ONLY",
            baseConfidence: 0.35,
            professionalRecommended: true,
            steps: [
              {
                title: "Confirm the bearing symptom",
                description:
                  "A diagnostic check only — do not attempt the repair yourself.",
                difficulty: "ADVANCED",
                estimatedMinutes: 5,
                safetyLevel: "PROFESSIONAL_ONLY",
                requiredTools: "None (diagnostic only)",
                instructions:
                  "1. Unplug the machine.\n2. With the drum empty, spin it by hand.\n3. Listen for a rough, grinding feel or rumble.\n4. If present, this strongly indicates bearing wear.\n5. Stop — do not disassemble. Request professional service.",
                expectedResult:
                  "You have confirmed the symptom without disassembly.",
                failureResult:
                  "Escalate to a professional technician for component replacement.",
                order: 0,
              },
            ],
          },
        ],
        rules: [
          { questionKey: "when_noise", optionValue: "during_spin", causeSlug: "unbalanced_load", weight: 1.8 },
          { questionKey: "when_noise", optionValue: "during_spin", causeSlug: "drum_bearing_wear", weight: 1.2 },
          { questionKey: "noise_type", optionValue: "banging", causeSlug: "unbalanced_load", weight: 1.6 },
          { questionKey: "recently_moved", optionValue: "yes", causeSlug: "machine_not_level", weight: 1.5 },
          { questionKey: "load_size", optionValue: "overloaded", causeSlug: "unbalanced_load", weight: 1.4 },
          { questionKey: "level_feet", optionValue: "wobbly", causeSlug: "machine_not_level", weight: 2.2 },
          { questionKey: "noise_type", optionValue: "scraping", causeSlug: "foreign_object", weight: 1.7 },
          { questionKey: "noise_type", optionValue: "clicking", causeSlug: "foreign_object", weight: 1.2 },
          { questionKey: "noise_type", optionValue: "grinding", causeSlug: "drum_bearing_wear", weight: 2.4, escalate: true, escalateReason: "Grinding during spin strongly suggests drum bearing wear — a component-level repair requiring professional tools and disassembly." },
        ],
      },
    ],
  },

  // ───────────────────── Refrigerator ─────────────────────
  {
    slug: "refrigerator",
    name: "Refrigerator",
    icon: "refrigerator",
    description: "Standard household refrigerators and fridge-freezers.",
    models: [
      { brand: "LG", model: "Double Door 350L" },
      { brand: "Samsung", model: "Side-by-Side 500L" },
      { brand: "Hell", model: "Single Door 200L" },
    ],
    symptoms: [
      {
        slug: "not_cooling",
        name: "Not cooling properly",
        description: "Fridge or freezer is not cold enough.",
        questions: [
          {
            key: "which_compartment",
            text: "Which compartment is not cooling?",
            inputType: "SINGLE_SELECT",
            order: 0,
            options: [
              { value: "fridge_only", label: "Fridge compartment" },
              { value: "freezer_only", label: "Freezer compartment" },
              { value: "both", label: "Both" },
              { value: "not_sure", label: "Not sure" },
            ],
          },
          {
            key: "thermostat_setting",
            text: "What is the thermostat set to?",
            inputType: "SINGLE_SELECT",
            order: 1,
            options: [
              { value: "low", label: "Low (warmest)" },
              { value: "medium", label: "Medium" },
              { value: "high", label: "High (coldest)" },
              { value: "unknown", label: "I don't know" },
            ],
          },
          {
            key: "airflow_blocked",
            text: "Are the interior shelves or vents packed full of food?",
            inputType: "SINGLE_SELECT",
            order: 2,
            options: [
              { value: "yes_packed", label: "Yes, very full" },
              { value: "no_normal", label: "No, normal amount" },
            ],
          },
          {
            key: "condenser_dusty",
            text: "Is the back/bottom of the fridge visibly dusty or clogged?",
            inputType: "SINGLE_SELECT",
            order: 3,
            options: [
              { value: "yes_dirty", label: "Yes, dusty" },
              { value: "no_clean", label: "No, looks clean" },
              { value: "cant_reach", label: "Can't reach / check" },
            ],
          },
          {
            key: "door_seal",
            text: "Does the door seal close tightly? (Close on a piece of paper and pull.)",
            inputType: "SINGLE_SELECT",
            order: 4,
            options: [
              { value: "tight", label: "Holds paper firmly" },
              { value: "loose", label: "Paper slips out easily" },
              { value: "damaged", label: "Seal is torn or brittle" },
            ],
          },
          {
            key: "running_sound",
            text: "Can you hear the compressor running (a low hum)?",
            inputType: "SINGLE_SELECT",
            order: 5,
            options: [
              { value: "yes_hum", label: "Yes, I hear a hum" },
              { value: "no_silent", label: "No, it is silent" },
              { value: "clicking", label: "It clicks but does not start" },
            ],
          },
        ],
        causes: [
          {
            slug: "thermostat_too_warm",
            name: "Thermostat set too warm",
            description:
              "The thermostat is set to a warm position; the compressor runs less than needed.",
            riskLevel: "SAFE",
            baseConfidence: 0.4,
            professionalRecommended: false,
            steps: [
              {
                title: "Adjust thermostat to medium-high",
                description: "Set the dial to medium or colder and wait 6–8 hours.",
                difficulty: "EASY",
                estimatedMinutes: 2,
                safetyLevel: "SAFE",
                requiredTools: "None",
                instructions:
                  "1. Locate the thermostat dial (inside the fridge or at the back top).\n2. Turn it to medium or one notch colder.\n3. Close the door and avoid opening for the next 6–8 hours.\n4. Check the temperature again.",
                expectedResult: "Fridge reaches 3–5°C; freezer reaches -18°C.",
                failureResult: "Still warm after 8 hours — escalate to next checks.",
                order: 0,
              },
            ],
          },
          {
            slug: "blocked_airflow",
            name: "Blocked cold-air airflow",
            description:
              "Overfilled shelves or covered vents prevent cold air from circulating.",
            riskLevel: "SAFE",
            baseConfidence: 0.4,
            professionalRecommended: false,
            steps: [
              {
                title: "Clear vents and rearrange food",
                description:
                  "Remove items blocking interior vents and leave space between shelves.",
                difficulty: "EASY",
                estimatedMinutes: 10,
                safetyLevel: "SAFE",
                requiredTools: "None",
                instructions:
                  "1. Locate the cold-air vents (usually at the back of the fridge compartment).\n2. Remove any food touching or covering the vents.\n3. Leave at least 2cm gap between items and the back wall.\n4. Do not overload any single shelf.\n5. Close the door and wait 4–6 hours.",
                expectedResult: "Even cooling returns; no warm spots.",
                failureResult: "Still warm — likely a different cause.",
                order: 0,
              },
            ],
          },
          {
            slug: "dirty_condenser",
            name: "Dirty condenser coils",
            description:
              "Dust on the condenser coils reduces heat rejection, so cooling becomes weak.",
            riskLevel: "CAUTION",
            baseConfidence: 0.35,
            professionalRecommended: false,
            steps: [
              {
                title: "Clean the condenser coils",
                description:
                  "Vacuum or brush the coils at the back or underneath the fridge.",
                difficulty: "MODERATE",
                estimatedMinutes: 20,
                safetyLevel: "CAUTION",
                requiredTools: "Vacuum with brush attachment, coil brush (optional)",
                instructions:
                  "1. Unplug the fridge.\n2. Pull it away from the wall.\n3. Locate the condenser coils (black tubing at the back, or underneath at the front behind a kickplate).\n4. Vacuum dust gently with a brush attachment.\n5. Do not bend the tubing.\n6. Push the fridge back, leaving 5–10cm clearance for airflow.\n7. Plug in and wait 8–12 hours.",
                expectedResult: "Cooling improves; compressor runs less often.",
                failureResult: "Still weak — possible sealed-system or fan issue.",
                order: 0,
              },
            ],
          },
          {
            slug: "door_seal_failure",
            name: "Door seal (gasket) failure",
            description:
              "A torn or loose gasket lets cold air escape, so the fridge runs constantly but cannot cool.",
            riskLevel: "CAUTION",
            baseConfidence: 0.4,
            professionalRecommended: false,
            steps: [
              {
                title: "Clean and test the door seal",
                description:
                  "Wash the gasket, re-test, and if damaged, arrange replacement.",
                difficulty: "MODERATE",
                estimatedMinutes: 15,
                safetyLevel: "CAUTION",
                requiredTools: "Warm soapy water, cloth, paper strip",
                instructions:
                  "1. Wipe the entire gasket with warm soapy water; dry.\n2. Close the door on a strip of paper and pull slowly.\n3. Repeat around the whole door.\n4. If the paper slips out anywhere, the seal is weak.\n5. If the gasket is torn, brittle, or permanently deformed, note the model and request a replacement gasket.",
                expectedResult: "Seal grips paper all around the door.",
                failureResult: "Damaged gasket — replace it (parts-only repair).",
                order: 0,
              },
            ],
          },
          {
            slug: "compressor_or_sealed_system",
            name: "Compressor or sealed-system fault",
            description:
              "The compressor is silent, clicks but does not start, or runs without cooling. This indicates a sealed-system or electrical fault.",
            riskLevel: "PROFESSIONAL_ONLY",
            baseConfidence: 0.3,
            professionalRecommended: true,
            steps: [
              {
                title: "Confirm compressor behavior (diagnostic only)",
                description: "Listen and observe — do not attempt sealed-system repair.",
                difficulty: "ADVANCED",
                estimatedMinutes: 5,
                safetyLevel: "PROFESSIONAL_ONLY",
                requiredTools: "None",
                instructions:
                  "1. Ensure the fridge is plugged in and the thermostat is on.\n2. Listen near the lower back for 2–3 minutes.\n3. Note: silent compressor, clicking without starting, or running but never cooling.\n4. Do not attempt to open the sealed refrigeration system — refrigerants require licensed handling.\n5. Request professional service.",
                expectedResult: "You have characterized the compressor behavior for the technician.",
                failureResult: "Escalate — sealed-system work requires a licensed technician.",
                order: 0,
              },
            ],
          },
        ],
        rules: [
          { questionKey: "thermostat_setting", optionValue: "low", causeSlug: "thermostat_too_warm", weight: 2.0 },
          { questionKey: "airflow_blocked", optionValue: "yes_packed", causeSlug: "blocked_airflow", weight: 1.8 },
          { questionKey: "condenser_dusty", optionValue: "yes_dirty", causeSlug: "dirty_condenser", weight: 1.7 },
          { questionKey: "door_seal", optionValue: "loose", causeSlug: "door_seal_failure", weight: 1.8 },
          { questionKey: "door_seal", optionValue: "damaged", causeSlug: "door_seal_failure", weight: 2.4 },
          { questionKey: "running_sound", optionValue: "no_silent", causeSlug: "compressor_or_sealed_system", weight: 2.2, escalate: true, escalateReason: "A silent compressor suggests a sealed-system or electrical fault requiring licensed service." },
          { questionKey: "running_sound", optionValue: "clicking", causeSlug: "compressor_or_sealed_system", weight: 2.4, escalate: true, escalateReason: "Clicking without starting indicates a compressor start relay or compressor fault — professional service required." },
          { questionKey: "which_compartment", optionValue: "both", causeSlug: "compressor_or_sealed_system", weight: 1.3 },
        ],
      },
    ],
  },

  // ───────────────────── Dishwasher ─────────────────────
  {
    slug: "dishwasher",
    name: "Dishwasher",
    icon: "dishwasher",
    description: "Built-in and freestanding dishwashers.",
    models: [
      { brand: "Bosch", model: "12 Place Settings" },
      { brand: "LG", model: "QuadWash 14" },
      { brand: "Beko", model: "Compact 10" },
    ],
    symptoms: [
      {
        slug: "not_draining",
        name: "Not draining",
        description: "Water remains at the bottom of the dishwasher after a cycle.",
        questions: [
          {
            key: "water_amount",
            text: "How much water is left?",
            inputType: "SINGLE_SELECT",
            order: 0,
            options: [
              { value: "small_pool", label: "A small puddle" },
              { value: "half_full", label: "About half full" },
              { value: "full", label: "Mostly full" },
            ],
          },
          {
            key: "filter_clean",
            text: "Is the bottom filter clean?",
            inputType: "SINGLE_SELECT",
            order: 1,
            options: [
              { value: "yes_clean", label: "Yes, I cleaned it recently" },
              { value: "no_dirty", label: "No, it is clogged" },
              { value: "cant_find", label: "I can't find the filter" },
            ],
          },
          {
            key: "drain_hose_kinked",
            text: "Is the drain hose (under the sink) kinked or pinched?",
            inputType: "SINGLE_SELECT",
            order: 2,
            options: [
              { value: "yes_kinked", label: "Yes, it is kinked" },
              { value: "no_ok", label: "No, it looks fine" },
              { value: "cant_see", label: "I can't see the hose" },
            ],
          },
          {
            key: "sink_drains_ok",
            text: "Does the kitchen sink drain normally?",
            inputType: "SINGLE_SELECT",
            order: 3,
            options: [
              { value: "yes_ok", label: "Yes, sink drains fine" },
              { value: "no_slow", label: "No, sink is also slow" },
            ],
          },
          {
            key: "new_installation",
            text: "Was the dishwasher recently installed or moved?",
            inputType: "SINGLE_SELECT",
            order: 4,
            options: [
              { value: "yes_new", label: "Yes" },
              { value: "no_existing", label: "No" },
            ],
          },
        ],
        causes: [
          {
            slug: "filter_obstruction",
            name: "Filter obstruction",
            description:
              "Food debris has clogged the fine filter at the bottom, blocking drainage.",
            riskLevel: "SAFE",
            baseConfidence: 0.5,
            professionalRecommended: false,
            steps: [
              {
                title: "Clean the dishwasher filter",
                description: "Remove and rinse the bottom filter under running water.",
                difficulty: "EASY",
                estimatedMinutes: 10,
                safetyLevel: "SAFE",
                requiredTools: "Soft brush, sink",
                instructions:
                  "1. Turn off the dishwasher at the panel.\n2. Slide out the lower rack.\n3. Twist the cylindrical filter counter-clockwise and lift it out.\n4. Rinse under warm running water; brush off debris.\n5. Check the filter well for large debris and remove.\n6. Reinstall the filter, twisting clockwise to lock.\n7. Run a short rinse cycle.",
                expectedResult: "Water drains fully at the end of the cycle.",
                failureResult: "Still not draining — check hose or pump.",
                order: 0,
              },
            ],
          },
          {
            slug: "drain_hose_issue",
            name: "Drain hose kink or blockage",
            description:
              "The drain hose is pinched, installed too low, or partially blocked.",
            riskLevel: "CAUTION",
            baseConfidence: 0.4,
            professionalRecommended: false,
            steps: [
              {
                title: "Inspect and straighten the drain hose",
                description: "Ensure the hose is not kinked and has a proper high loop.",
                difficulty: "MODERATE",
                estimatedMinutes: 15,
                safetyLevel: "CAUTION",
                requiredTools: "Towel, flashlight, zip tie (optional)",
                instructions:
                  "1. Turn off power to the dishwasher at the breaker.\n2. Open the under-sink cabinet and locate the corrugated drain hose.\n3. Check for kinks, sharp bends, or crushing.\n4. Straighten the hose and secure a 'high loop' as high as possible under the counter.\n5. Ensure the hose connection to the sink drain or disposal is clear.\n6. Restore power and run a drain-only cycle.",
                expectedResult: "Water drains briskly into the sink.",
                failureResult: "Still slow — possible pump fault; escalate.",
                order: 0,
              },
            ],
          },
          {
            slug: "sink_drain_blockage",
            name: "Shared sink drain blockage",
            description:
              "The sink drain itself is slow, so the dishwasher cannot discharge.",
            riskLevel: "CAUTION",
            baseConfidence: 0.35,
            professionalRecommended: false,
            steps: [
              {
                title: "Clear the sink drain",
                description:
                  "Clear the sink trap; the dishwasher shares this drain path.",
                difficulty: "MODERATE",
                estimatedMinutes: 20,
                safetyLevel: "CAUTION",
                requiredTools: "Bucket, pliers, towel",
                instructions:
                  "1. Place a bucket under the U-shaped trap under the sink.\n2. Unscrew the slip nuts and remove the trap.\n3. Empty debris into the bucket.\n4. Rinse the trap; reinstall and tighten.\n5. Run the hot tap for a minute to confirm the sink drains well.\n6. Then run a dishwasher drain cycle.",
                expectedResult: "Sink drains fast; dishwasher follows.",
                failureResult: "Persistent blockage deeper in plumbing — call a plumber.",
                order: 0,
              },
            ],
          },
          {
            slug: "drain_pump_fault",
            name: "Drain pump fault",
            description:
              "The drain pump is jammed by a hard object (glass, pit) or has failed electrically.",
            riskLevel: "PROFESSIONAL_ONLY",
            baseConfidence: 0.3,
            professionalRecommended: true,
            steps: [
              {
                title: "Listen for the pump (diagnostic only)",
                description: "Confirm whether the drain pump hums; do not disassemble.",
                difficulty: "ADVANCED",
                estimatedMinutes: 5,
                safetyLevel: "PROFESSIONAL_ONLY",
                requiredTools: "None",
                instructions:
                  "1. Cancel any running cycle.\n2. Start a drain-only cycle.\n3. Listen near the lower front for a humming pump sound.\n4. If silent or loudly grinding, stop.\n5. Request professional service — pump access requires base disassembly.",
                expectedResult: "You have characterized the pump behavior.",
                failureResult: "Escalate to a professional for pump inspection/replacement.",
                order: 0,
              },
            ],
          },
        ],
        rules: [
          { questionKey: "filter_clean", optionValue: "no_dirty", causeSlug: "filter_obstruction", weight: 2.2 },
          { questionKey: "drain_hose_kinked", optionValue: "yes_kinked", causeSlug: "drain_hose_issue", weight: 2.0 },
          { questionKey: "new_installation", optionValue: "yes_new", causeSlug: "drain_hose_issue", weight: 1.4 },
          { questionKey: "sink_drains_ok", optionValue: "no_slow", causeSlug: "sink_drain_blockage", weight: 2.4 },
          { questionKey: "filter_clean", optionValue: "yes_clean", causeSlug: "drain_pump_fault", weight: 0.6 },
          { questionKey: "water_amount", optionValue: "full", causeSlug: "drain_pump_fault", weight: 1.0 },
        ],
      },
    ],
  },
];

