import { SeedErrorCode } from "../types";

export const allErrorCodes: SeedErrorCode[] = [
  // Washing Machine
  { brand: "LG", code: "OE", meaning: "Drain error — water not draining.", severity: "NORMAL", riskLevel: "CAUTION", possibleCauses: "Clogged pump filter, kinked drain hose", professionalRequired: false },
  { brand: "LG", code: "UE", meaning: "Unbalanced load error.", severity: "LOW", riskLevel: "SAFE", possibleCauses: "Heavy items on one side", recommendedActions: "Redistribute load and restart", professionalRequired: false },
  { brand: "LG", code: "LE", meaning: "Locked motor error.", severity: "HIGH", riskLevel: "PROFESSIONAL_ONLY", possibleCauses: "Motor failure, hall sensor issue", professionalRequired: true },
  { brand: "Samsung", code: "5E", meaning: "Water not draining.", severity: "NORMAL", riskLevel: "CAUTION", possibleCauses: "Blocked filter", professionalRequired: false },
  { brand: "Samsung", code: "nd", meaning: "No drain.", severity: "NORMAL", riskLevel: "CAUTION", professionalRequired: false },

  // Refrigerator
  { brand: "LG", code: "ER FF", meaning: "Freezer fan error — fan motor not running.", severity: "HIGH", riskLevel: "PROFESSIONAL_ONLY", professionalRequired: true },
  { brand: "LG", code: "ER CO", meaning: "Communication error between main board and display.", severity: "HIGH", riskLevel: "PROFESSIONAL_ONLY", professionalRequired: true },
  { brand: "LG", code: "ER DH", meaning: "Defrost heater error — defrost cycle failure.", severity: "NORMAL", riskLevel: "CAUTION", professionalRequired: false },

  // Dishwasher
  { brand: "Bosch", code: "E15", meaning: "Water leak detected — aquastop activated.", severity: "HIGH", riskLevel: "CAUTION", possibleCauses: "Internal leak, water in base pan", professionalRequired: false },
  { brand: "Bosch", code: "E24", meaning: "Drain error — water not draining.", severity: "NORMAL", riskLevel: "CAUTION", possibleCauses: "Blocked filter, kinked hose", professionalRequired: false },
  { brand: "Bosch", code: "E22", meaning: "Filter blockage — circulation pump blocked.", severity: "NORMAL", riskLevel: "CAUTION", professionalRequired: false },

  // Air Conditioner
  { brand: "LG", code: "CH05", meaning: "Communication error between indoor and outdoor unit.", severity: "HIGH", riskLevel: "PROFESSIONAL_ONLY", professionalRequired: true },
  
  // Power Tools (Mocked examples)
  { brand: "Bosch", code: "E01", meaning: "Battery communication failure.", severity: "NORMAL", riskLevel: "SAFE", recommendedActions: "Remove and reseat battery. Clean contacts.", professionalRequired: false, categorySlug: "power_tools" },
  { brand: "DeWalt", code: "FLASH_3", meaning: "Motor thermal overload.", severity: "HIGH", riskLevel: "CAUTION", professionalRequired: false },

  // Electronics (Laptops)
  { brand: "Dell", code: "2000-0314", meaning: "Thermal sensing error / Overheating.", severity: "HIGH", riskLevel: "CAUTION", possibleCauses: "Blocked vents, failed fan", professionalRequired: false },
  
  // Washer Overlap (E01 means something else here)
  { brand: "Bosch", code: "E01", meaning: "Motor power module failure.", severity: "HIGH", riskLevel: "PROFESSIONAL_ONLY", professionalRequired: true },

  // Generator
  { brand: "Honda", code: "E-05", meaning: "Low oil pressure / shutdown.", severity: "HIGH", riskLevel: "CAUTION", professionalRequired: false },
];
