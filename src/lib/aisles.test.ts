import { describe, expect, test } from 'vitest';
import { DEFAULT_AISLE_ORDER, groupByAisle } from './aisles.js';
import type { Category, ShoppingItem } from './types.js';

function item(name: string, category: Category): ShoppingItem {
  return { name, qty: 1, unit: 'unit', category, sources: ['staples'], checked: false };
}

describe('groupByAisle', () => {
  test('returns sections in the configured walking order, not input order', () => {
    const items = [item('milk', 'dairy'), item('bin bags', 'household'), item('onions', 'produce')];

    const groups = groupByAisle(items, DEFAULT_AISLE_ORDER);

    expect(groups.map((g) => g.category)).toEqual(['produce', 'dairy', 'household']);
  });

  test('omits sections with nothing to buy', () => {
    const groups = groupByAisle([item('onions', 'produce')], DEFAULT_AISLE_ORDER);

    expect(groups).toHaveLength(1);
    expect(groups[0]!.category).toBe('produce');
  });

  test('keeps every item of a section together even when they arrive interleaved', () => {
    const items = [item('milk', 'dairy'), item('onions', 'produce'), item('butter', 'dairy')];

    const groups = groupByAisle(items, DEFAULT_AISLE_ORDER);

    expect(groups).toHaveLength(2);
    expect(groups[1]!.category).toBe('dairy');
    expect(groups[1]!.items.map((i) => i.name).sort()).toEqual(['butter', 'milk']);
  });

  test('sorts items alphabetically within a section', () => {
    const items = [item('yoghurt', 'dairy'), item('butter', 'dairy'), item('milk', 'dairy')];

    const groups = groupByAisle(items, DEFAULT_AISLE_ORDER);

    expect(groups[0]!.items.map((i) => i.name)).toEqual(['butter', 'milk', 'yoghurt']);
  });

  test('honours a household-specific aisle order', () => {
    const items = [item('onions', 'produce'), item('milk', 'dairy')];

    const groups = groupByAisle(items, ['dairy', 'produce']);

    expect(groups.map((g) => g.category)).toEqual(['dairy', 'produce']);
  });

  test('puts items from an unlisted section last rather than dropping them', () => {
    const items = [item('crisps', 'snacks'), item('milk', 'dairy')];

    const groups = groupByAisle(items, ['dairy']);

    expect(groups.map((g) => g.category)).toEqual(['dairy', 'snacks']);
  });

  test('counts how many items in a section are still unchecked', () => {
    const checked = { ...item('milk', 'dairy'), checked: true };
    const groups = groupByAisle([checked, item('butter', 'dairy')], DEFAULT_AISLE_ORDER);

    expect(groups[0]!.remaining).toBe(1);
  });
});
