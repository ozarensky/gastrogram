import { addQuantities, canMerge } from './units.js';
import type {
  Ingredient,
  PantryItem,
  Plan,
  Preferences,
  Recipe,
  ShoppingItem,
  ShoppingList,
  StapleItem,
  Unit,
} from './types.js';

const MEAL_SLOTS = ['breakfast', 'lunch', 'dinner'] as const;

/** A toddler eats about half an adult portion. Good enough to size a shop. */
function portions(serves: { adults: number; toddlers: number }): number {
  return serves.adults + serves.toddlers * 0.5;
}

/** You cannot buy 1.5 lemons. Counted things round up; measured things round sensibly. */
function roundQty(qty: number, unit: Unit): number {
  if (unit === 'unit' || unit === 'bunch' || unit === 'pack') return Math.ceil(qty);
  return Math.round(qty * 100) / 100;
}

/**
 * Turns a week's plan into the single list you take to the shop:
 * every planned ingredient, scaled to the household, plus the recurring staples,
 * minus whatever the pantry already holds, with duplicates merged into one line.
 *
 * Pantry suppression deliberately does not apply to staples — the pantry says
 * "we always have this", while a staple says "buy this every week regardless".
 */
export function consolidate(
  plan: Plan,
  recipes: Recipe[],
  staples: StapleItem[],
  pantry: PantryItem[],
  prefs: Preferences,
): ShoppingList {
  const library = new Map(recipes.map((r) => [r.id, r]));
  const inPantry = new Set(pantry.map((p) => p.name.toLowerCase()));
  const householdPortions = portions(prefs.household);

  const lines: ShoppingItem[] = [];

  const add = (
    name: string,
    qty: number,
    unit: Unit,
    category: Ingredient['category'],
    source: string,
  ): void => {
    const existing = lines.find((l) => l.name.toLowerCase() === name.toLowerCase() && canMerge(l.unit, unit));

    if (existing) {
      const merged = addQuantities({ qty: existing.qty, unit: existing.unit }, { qty, unit });
      existing.qty = roundQty(merged.qty, merged.unit);
      existing.unit = merged.unit;
      if (!existing.sources.includes(source)) existing.sources.push(source);
      return;
    }

    lines.push({
      name,
      qty: roundQty(qty, unit),
      unit,
      category,
      sources: [source],
      checked: false,
    });
  };

  for (const day of plan.days) {
    for (const slot of MEAL_SLOTS) {
      const found = library.get(day[slot].recipeId);
      if (!found) continue;

      const scale = householdPortions / portions(found.serves);

      for (const ingredient of found.ingredients) {
        if (inPantry.has(ingredient.item.toLowerCase())) continue;
        add(ingredient.item, ingredient.qty * scale, ingredient.unit, ingredient.category, found.id);
      }
    }
  }

  for (const staple of staples) {
    add(staple.name, staple.qty, staple.unit, staple.category, 'staples');
  }

  return { weekOf: plan.weekOf, items: lines };
}
