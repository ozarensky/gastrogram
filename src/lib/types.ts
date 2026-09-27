/**
 * Shared data contracts. These mirror the JSON files under `data/` exactly —
 * the filesystem is the database, and these are its schema.
 */

/** Shop sections, in the order you physically walk them. Configurable per household. */
export type Category =
  | 'produce'
  | 'bakery'
  | 'dairy'
  | 'meat-fish'
  | 'frozen'
  | 'dry-goods'
  | 'tins-jars'
  | 'drinks'
  | 'snacks'
  | 'household';

export type Cuisine =
  | 'mediterranean'
  | 'asian'
  | 'european-comfort'
  | 'indian'
  | 'middle-eastern'
  | 'other';

/**
 * Mass and volume convert within their own family only. `unit` is a count of
 * discrete things (3 lemons); `bunch`/`pack` are shop units that never merge
 * with a measured quantity.
 */
export type Unit =
  | 'g'
  | 'kg'
  | 'ml'
  | 'l'
  | 'tsp'
  | 'tbsp'
  | 'unit'
  | 'bunch'
  | 'pack';

export type MealSlot = 'breakfast' | 'lunch' | 'dinner';

export interface Ingredient {
  item: string;
  qty: number;
  unit: Unit;
  category: Category;
  /** Days this ingredient keeps once bought. Drives perishability ordering. */
  keepsDays?: number;
}

export interface Recipe {
  id: string;
  title: string;
  cuisine: Cuisine;
  /** Minutes of hands-on work. The number that matters with toddlers around. */
  activeMinutes: number;
  /** Wall-clock minutes start to plate. This is what the 30-minute cap tests. */
  totalMinutes: number;
  serves: { adults: number; toddlers: number };
  /** What to hold back for the kids before the adult seasoning goes in. */
  toddlerSplit: string;
  tags: string[];
  ingredients: Ingredient[];
  steps: string[];
  /** ISO date of the last time this was cooked, or null if never. */
  lastCooked: string | null;
  rating: number | null;
}

export interface PlannedMeal {
  recipeId: string;
  notes?: string;
}

export interface PlanDay {
  /** ISO date, e.g. "2026-08-17". */
  date: string;
  breakfast: PlannedMeal;
  lunch: PlannedMeal;
  dinner: PlannedMeal;
  snacks: string[];
}

export interface Plan {
  /** ISO date of the Monday this week starts. */
  weekOf: string;
  days: PlanDay[];
}

export interface StapleItem {
  name: string;
  qty: number;
  unit: Unit;
  category: Category;
}

export interface PantryItem {
  name: string;
  category: Category;
}

export interface Preferences {
  household: { adults: number; toddlers: number; toddlerAges: number[] };
  /** Ingredient substrings that must never appear in a plan. Case-insensitive. */
  exclusions: string[];
  cuisines: Cuisine[];
  /** Hard cap on a weeknight dinner's totalMinutes. */
  maxWeeknightMinutes: number;
  /** Nights treated as weeknights (0 = Sunday). Weekends may exceed the cap. */
  weeknights: number[];
  /** A recipe cooked within this many days may not be planned again. */
  noRepeatDays: number;
  /** Shop sections in walking order. Drives shopping list grouping. */
  aisleOrder: Category[];
}

export interface ShoppingItem {
  name: string;
  qty: number;
  unit: Unit;
  category: Category;
  /** Recipe ids, or the literal "staples", that contributed to this line. */
  sources: string[];
  checked: boolean;
  /** e.g. leftover flagged by pack rounding: "50g spare". */
  note?: string;
}

export interface ShoppingList {
  weekOf: string;
  items: ShoppingItem[];
}

export interface Violation {
  rule:
    | 'exclusion'
    | 'time-cap'
    | 'toddler-safe'
    | 'perishability'
    | 'cuisine-repeat'
    | 'recipe-repeat'
    | 'missing-recipe';
  date: string;
  message: string;
}
