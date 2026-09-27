import type { Cuisine, Ingredient, Plan, PlanDay, Preferences, Recipe } from './types.js';

/** Test fixtures shared by the validator and consolidator specs. */

export const PREFS: Preferences = {
  household: { adults: 2, toddlers: 2, toddlerAges: [3, 2] },
  exclusions: ['pork', 'bacon', 'ham', 'chorizo', 'pancetta', 'lardons', 'prosciutto'],
  cuisines: ['mediterranean', 'asian', 'european-comfort'],
  maxWeeknightMinutes: 30,
  weeknights: [1, 2, 3, 4, 5],
  noRepeatDays: 28,
  aisleOrder: [
    'produce',
    'bakery',
    'dairy',
    'meat-fish',
    'frozen',
    'dry-goods',
    'tins-jars',
    'drinks',
    'snacks',
    'household',
  ],
};

export function ing(item: string, overrides: Partial<Ingredient> = {}): Ingredient {
  return { item, qty: 100, unit: 'g', category: 'produce', ...overrides };
}

export function recipe(id: string, overrides: Partial<Recipe> = {}): Recipe {
  return {
    id,
    title: id,
    cuisine: 'mediterranean' as Cuisine,
    activeMinutes: 10,
    totalMinutes: 25,
    serves: { adults: 2, toddlers: 2 },
    toddlerSplit: 'Plate the toddlers before adding chilli.',
    tags: [],
    ingredients: [ing('courgette')],
    steps: ['Cook it.'],
    lastCooked: null,
    rating: null,
    ...overrides,
  };
}

/** Monday 2026-08-17 through Sunday 2026-08-23. */
export const WEEK_DATES = [
  '2026-08-17',
  '2026-08-18',
  '2026-08-19',
  '2026-08-20',
  '2026-08-21',
  '2026-08-22',
  '2026-08-23',
];

/** Builds a 7-day plan whose dinners are the given recipe ids, in order. */
export function plan(dinnerIds: string[]): Plan {
  const days: PlanDay[] = WEEK_DATES.map((date, i) => ({
    date,
    breakfast: { recipeId: 'porridge' },
    lunch: { recipeId: 'sandwiches' },
    dinner: { recipeId: dinnerIds[i] ?? 'filler' },
    snacks: ['fruit'],
  }));
  return { weekOf: WEEK_DATES[0]!, days };
}
