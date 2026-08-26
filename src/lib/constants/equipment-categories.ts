export type SymptomDef = {
  id: string;
  name: string;
};

export type CategoryDef = {
  id: string; // The slug
  name: string;
  symptoms: SymptomDef[];
};

export const UNIVERSAL_CATEGORIES: CategoryDef[] = [
  {
    id: "hvac",
    name: "HVAC & Air Conditioning",
    symptoms: [
      { id: "not-cooling", name: "Not cooling" },
      { id: "not-heating", name: "Not heating" },
      { id: "weak-airflow", name: "Weak airflow" },
      { id: "leaking-water", name: "Leaking water" },
      { id: "strange-noise", name: "Strange noise" },
      { id: "bad-smell", name: "Bad smell" },
      { id: "short-cycling", name: "Short cycling" },
      { id: "wont-turn-on", name: "Won't turn on" },
      { id: "other", name: "Other" },
    ],
  },
  {
    id: "plumbing",
    name: "Plumbing",
    symptoms: [
      { id: "leak", name: "Leak" },
      { id: "low-pressure", name: "Low water pressure" },
      { id: "no-water", name: "No water" },
      { id: "drain-blockage", name: "Drain blockage" },
      { id: "overflow", name: "Overflow" },
      { id: "temperature-problem", name: "Temperature problem" },
      { id: "strange-noise", name: "Strange noise" },
      { id: "bad-smell", name: "Bad smell" },
      { id: "other", name: "Other" },
    ],
  },
  {
    id: "electrical",
    name: "Electrical",
    symptoms: [
      { id: "wont-turn-on", name: "Won't turn on" },
      { id: "power-loss", name: "Power loss" },
      { id: "flickering", name: "Flickering" },
      { id: "burning-smell", name: "Burning smell" },
      { id: "sparking", name: "Sparking" },
      { id: "overheating", name: "Overheating" },
      { id: "tripping-breaker", name: "Tripping breaker" },
      { id: "intermittent", name: "Intermittent operation" },
      { id: "strange-noise", name: "Strange noise" },
      { id: "other", name: "Other" },
    ],
  },
  {
    id: "appliances",
    name: "Major Appliances",
    symptoms: [
      { id: "wont-turn-on", name: "Won't turn on" },
      { id: "leaking", name: "Leaking" },
      { id: "strange-noise", name: "Strange noise" },
      { id: "not-cooling", name: "Not cooling (Fridge/Freezer)" },
      { id: "not-heating", name: "Not heating (Oven/Dryer)" },
      { id: "not-draining", name: "Not draining (Washer/Dishwasher)" },
      { id: "not-spinning", name: "Not spinning (Washer)" },
      { id: "bad-smell", name: "Bad smell" },
      { id: "door-issue", name: "Door won't close/lock" },
      { id: "error-code", name: "Showing error code" },
      { id: "other", name: "Other" },
    ],
  },
  {
    id: "electronics",
    name: "Electronics & IT",
    symptoms: [
      { id: "wont-turn-on", name: "Won't turn on" },
      { id: "no-display", name: "No display / Black screen" },
      { id: "no-sound", name: "No sound" },
      { id: "connectivity", name: "Network / Connectivity issue" },
      { id: "overheating", name: "Overheating" },
      { id: "software-crash", name: "Software crashing / freezing" },
      { id: "physical-damage", name: "Physical damage" },
      { id: "battery-issue", name: "Battery / Charging issue" },
      { id: "other", name: "Other" },
    ],
  },
  {
    id: "generator",
    name: "Generators & Power",
    symptoms: [
      { id: "wont-start", name: "Won't start" },
      { id: "starts-then-stops", name: "Starts then stops" },
      { id: "low-power", name: "Low power output" },
      { id: "surging", name: "Surging / Unstable power" },
      { id: "smoking", name: "Smoking or exhaust issue" },
      { id: "leaking-fuel", name: "Leaking fuel or oil" },
      { id: "strange-noise", name: "Strange noise" },
      { id: "battery-dead", name: "Dead battery" },
      { id: "other", name: "Other" },
    ],
  },
  {
    id: "water-system",
    name: "Pumps & Water Systems",
    symptoms: [
      { id: "wont-turn-on", name: "Won't turn on" },
      { id: "runs-constantly", name: "Runs constantly" },
      { id: "low-pressure", name: "Low pressure" },
      { id: "no-water", name: "No water pumping" },
      { id: "leaking", name: "Leaking" },
      { id: "strange-noise", name: "Strange noise" },
      { id: "cycling-rapidly", name: "Cycling rapidly" },
      { id: "other", name: "Other" },
    ],
  },
  {
    id: "security",
    name: "Security & Smart Home",
    symptoms: [
      { id: "offline", name: "Device offline" },
      { id: "false-alarms", name: "False alarms" },
      { id: "wont-arm", name: "Won't arm / disarm" },
      { id: "camera-no-feed", name: "Camera has no feed" },
      { id: "poor-video", name: "Poor video quality" },
      { id: "sensor-fail", name: "Sensor not triggering" },
      { id: "battery-dead", name: "Dead battery" },
      { id: "other", name: "Other" },
    ],
  },
  {
    id: "other",
    name: "Other",
    symptoms: [
      { id: "wont-turn-on", name: "Won't turn on" },
      { id: "strange-noise", name: "Strange noise" },
      { id: "leaking", name: "Leaking" },
      { id: "physical-damage", name: "Physical damage" },
      { id: "not-working", name: "Not working as expected" },
      { id: "other", name: "Other" },
    ],
  },
];

export function getCategory(id: string): CategoryDef | undefined {
  return UNIVERSAL_CATEGORIES.find((c) => c.id === id);
}

export function getSymptom(categoryId: string, symptomId: string): SymptomDef | undefined {
  const cat = getCategory(categoryId);
  return cat?.symptoms.find((s) => s.id === symptomId);
}
