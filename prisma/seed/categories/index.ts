import { applianceCategories } from "./appliances";
import { hvacCategories } from "./hvac";
import { toolCategories } from "./tools";
import { electronicsCategories } from "./electronics";
import { plumbingCategories } from "./plumbing";

export const allCategories = [
  ...applianceCategories,
  ...hvacCategories,
  ...toolCategories,
  ...electronicsCategories,
  ...plumbingCategories,
];
