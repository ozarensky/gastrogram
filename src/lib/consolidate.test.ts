import { describe, expect, test } from 'vitest';
import { consolidate } from './consolidate.js';
import { PREFS, ing, plan, recipe } from './fixtures.js';
import type { PantryItem, Plan, Recipe, StapleItem } from './types.js';

/** A week where only the named dinners contribute ingredients. */
function week(dinnerIds: string[]): Plan {
  const filled = [...dinnerIds, ...Array(7 - dinnerIds.length).fill('empty')];
  const p = plan(filled);
  for (const day of p.days) {
    day.breakfast = { recipeId: 'empty' };
    day.lunch = { recipeId: 'empty' };
  }
  return p;
}

const EMPTY = recipe('empty', { ingredients: [] });

function build(recipes: Recipe[], staples: StapleItem[] = [], pantry: PantryItem[] = []) {
  return consolidate(week(recipes.filter((r) => r.id !== 'empty').map((r) => r.id)), [...recipes, EMPTY], staples, pantry, PREFS);
}

describe('consolidate', () => {
  test('carries the week through to the list', () => {
    expect(build([recipe('a')]).weekOf).toBe('2026-08-17');
  });

  test('merges the same ingredient from two recipes into one line', () => {
    const list = build([
      recipe('a', { ingredients: [ing('basmati rice', { qty: 200, unit: 'g', category: 'dry-goods' })] }),
      recipe('b', { cuisine: 'asian', ingredients: [ing('basmati rice', { qty: 0.3, unit: 'kg', category: 'dry-goods' })] }),
    ]);

    const rice = list.items.filter((i) => i.name === 'basmati rice');
    expect(rice).toHaveLength(1);
    expect(rice[0]!.qty).toBe(500);
    expect(rice[0]!.unit).toBe('g');
  });

  test('records which recipes each line came from', () => {
    const list = build([
      recipe('a', { ingredients: [ing('lemons', { qty: 2, unit: 'unit' })] }),
      recipe('b', { cuisine: 'asian', ingredients: [ing('lemons', { qty: 1, unit: 'unit' })] }),
    ]);

    expect(list.items.find((i) => i.name === 'lemons')!.sources).toEqual(['a', 'b']);
  });

  test('keeps quantities that cannot merge on separate lines', () => {
    const list = build([
      recipe('a', { ingredients: [ing('coriander', { qty: 1, unit: 'bunch' })] }),
      recipe('b', { cuisine: 'asian', ingredients: [ing('coriander', { qty: 30, unit: 'g' })] }),
    ]);

    expect(list.items.filter((i) => i.name === 'coriander')).toHaveLength(2);
  });

  test('adds staples the recipes never mention', () => {
    const list = build([recipe('a')], [
      { name: 'milk', qty: 4, unit: 'l', category: 'dairy' },
      { name: 'eggs', qty: 12, unit: 'unit', category: 'dairy' },
    ]);

    expect(list.items.map((i) => i.name)).toContain('milk');
    expect(list.items.find((i) => i.name === 'eggs')!.sources).toEqual(['staples']);
  });

  test('merges a staple with the same ingredient used in a recipe', () => {
    const list = build(
      [recipe('a', { ingredients: [ing('milk', { qty: 500, unit: 'ml', category: 'dairy' })] })],
      [{ name: 'milk', qty: 2, unit: 'l', category: 'dairy' }],
    );

    const milk = list.items.filter((i) => i.name === 'milk');
    expect(milk).toHaveLength(1);
    expect(milk[0]!.qty).toBe(2500);
    expect(milk[0]!.sources).toEqual(['a', 'staples']);
  });

  test('drops a recipe ingredient already in the pantry', () => {
    const list = build(
      [recipe('a', { ingredients: [ing('olive oil', { qty: 30, unit: 'ml' }), ing('onions')] })],
      [],
      [{ name: 'olive oil', category: 'dry-goods' }],
    );

    expect(list.items.map((i) => i.name)).toEqual(['onions']);
  });

  test('matches pantry entries regardless of case', () => {
    const list = build([recipe('a', { ingredients: [ing('Sea Salt')] })], [], [
      { name: 'sea salt', category: 'dry-goods' },
    ]);

    expect(list.items).toHaveLength(0);
  });

  test('keeps a staple even when the pantry names it, because staples are deliberate weekly buys', () => {
    const list = build([recipe('a', { ingredients: [] })], [
      { name: 'rice', qty: 1, unit: 'kg', category: 'dry-goods' },
    ], [{ name: 'rice', category: 'dry-goods' }]);

    expect(list.items.map((i) => i.name)).toEqual(['rice']);
  });

  test('scales a recipe written for fewer people up to the household', () => {
    // Household is 2 adults + 2 toddlers = 3 portions; recipe serves 2 adults = 2 portions.
    const list = build([
      recipe('a', {
        serves: { adults: 2, toddlers: 0 },
        ingredients: [ing('chicken thighs', { qty: 400, unit: 'g', category: 'meat-fish' })],
      }),
    ]);

    expect(list.items.find((i) => i.name === 'chicken thighs')!.qty).toBe(600);
  });

  test('rounds counted things up to whole items when scaling', () => {
    const list = build([
      recipe('a', {
        serves: { adults: 2, toddlers: 0 },
        ingredients: [ing('lemons', { qty: 1, unit: 'unit' })],
      }),
    ]);

    expect(list.items.find((i) => i.name === 'lemons')!.qty).toBe(2);
  });

  test('leaves every item unchecked so the shop starts from zero', () => {
    const list = build([recipe('a')], [{ name: 'milk', qty: 4, unit: 'l', category: 'dairy' }]);

    expect(list.items.every((i) => i.checked === false)).toBe(true);
  });
});
