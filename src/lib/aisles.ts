import type { Category, ShoppingItem } from './types.js';

/** The order most supermarkets are walked. Overridable per household in preferences. */
export const DEFAULT_AISLE_ORDER: Category[] = [
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
];

export interface AisleGroup {
  category: Category;
  items: ShoppingItem[];
  /** Items still to be picked up — drives the "18 of 47" counter in the UI. */
  remaining: number;
}

/**
 * Arranges a flat shopping list into shop sections in walking order, so the list is
 * read top to bottom while moving through the shop rather than doubling back.
 * Sections not named in `order` still appear, after the ones that are.
 */
export function groupByAisle(items: ShoppingItem[], order: Category[]): AisleGroup[] {
  const byCategory = new Map<Category, ShoppingItem[]>();
  for (const item of items) {
    const bucket = byCategory.get(item.category);
    if (bucket) bucket.push(item);
    else byCategory.set(item.category, [item]);
  }

  const ranked = [...order, ...[...byCategory.keys()].filter((c) => !order.includes(c))];

  return ranked
    .filter((category) => byCategory.has(category))
    .map((category) => {
      const group = byCategory
        .get(category)!
        .slice()
        .sort((a, b) => a.name.localeCompare(b.name));
      return {
        category,
        items: group,
        remaining: group.filter((i) => !i.checked).length,
      };
    });
}
