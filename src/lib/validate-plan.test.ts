import { describe, expect, test } from 'vitest';
import { validatePlan } from './validate-plan.js';
import { PREFS, ing, plan, recipe, WEEK_DATES } from './fixtures.js';
import type { Recipe } from './types.js';

/** Seven distinct, compliant dinners: the baseline a valid week looks like. */
function goodWeek(): { recipes: Recipe[]; ids: string[] } {
  const cuisines = [
    'mediterranean',
    'asian',
    'european-comfort',
    'mediterranean',
    'asian',
    'european-comfort',
    'mediterranean',
  ] as const;
  const recipes = cuisines.map((cuisine, i) => recipe(`dinner-${i}`, { cuisine }));
  const support = [recipe('porridge'), recipe('sandwiches')];
  return { recipes: [...recipes, ...support], ids: recipes.map((r) => r.id) };
}

describe('validatePlan', () => {
  test('a compliant week produces no violations', () => {
    const { recipes, ids } = goodWeek();

    expect(validatePlan(plan(ids), recipes, PREFS)).toEqual([]);
  });

  describe('hard exclusions', () => {
    test('rejects a dinner containing an excluded ingredient', () => {
      const { recipes, ids } = goodWeek();
      recipes[0]!.ingredients = [ing('smoked bacon lardons')];

      const violations = validatePlan(plan(ids), recipes, PREFS);

      expect(violations).toHaveLength(1);
      expect(violations[0]!.rule).toBe('exclusion');
      expect(violations[0]!.date).toBe(WEEK_DATES[0]);
      expect(violations[0]!.message).toMatch(/bacon/i);
    });

    test('matches exclusions regardless of case', () => {
      const { recipes, ids } = goodWeek();
      recipes[2]!.ingredients = [ing('Chorizo Picante')];

      const violations = validatePlan(plan(ids), recipes, PREFS);

      expect(violations.map((v) => v.rule)).toEqual(['exclusion']);
    });

    test('checks breakfast and lunch too, not only dinner', () => {
      const { recipes, ids } = goodWeek();
      recipes.find((r) => r.id === 'sandwiches')!.ingredients = [ing('sliced ham')];

      const violations = validatePlan(plan(ids), recipes, PREFS);

      expect(violations.length).toBeGreaterThan(0);
      expect(violations.every((v) => v.rule === 'exclusion')).toBe(true);
    });
  });

  describe('weeknight time cap', () => {
    test('rejects a weeknight dinner over the cap', () => {
      const { recipes, ids } = goodWeek();
      recipes[1]!.totalMinutes = 45;

      const violations = validatePlan(plan(ids), recipes, PREFS);

      expect(violations).toHaveLength(1);
      expect(violations[0]!.rule).toBe('time-cap');
      expect(violations[0]!.message).toMatch(/45/);
    });

    test('allows a long dinner at the weekend', () => {
      const { recipes, ids } = goodWeek();
      // index 5 is Saturday 2026-08-22
      recipes[5]!.totalMinutes = 90;

      expect(validatePlan(plan(ids), recipes, PREFS)).toEqual([]);
    });

    test('allows a dinner exactly at the cap', () => {
      const { recipes, ids } = goodWeek();
      recipes[0]!.totalMinutes = 30;

      expect(validatePlan(plan(ids), recipes, PREFS)).toEqual([]);
    });
  });

  describe('toddler safety', () => {
    test('rejects a dinner with no stated toddler split', () => {
      const { recipes, ids } = goodWeek();
      recipes[3]!.toddlerSplit = '';

      const violations = validatePlan(plan(ids), recipes, PREFS);

      expect(violations.map((v) => v.rule)).toEqual(['toddler-safe']);
    });

    test('skips the toddler check when the household has no toddlers', () => {
      const { recipes, ids } = goodWeek();
      recipes[3]!.toddlerSplit = '';
      const adultsOnly = {
        ...PREFS,
        household: { adults: 2, toddlers: 0, toddlerAges: [] },
      };

      expect(validatePlan(plan(ids), recipes, adultsOnly)).toEqual([]);
    });
  });

  describe('perishability ordering', () => {
    test('rejects fresh fish planned later than it keeps', () => {
      const { recipes, ids } = goodWeek();
      // Friday is 4 days after the Monday shop; fresh fish keeps 2.
      recipes[4]!.ingredients = [ing('salmon fillets', { keepsDays: 2, category: 'meat-fish' })];

      const violations = validatePlan(plan(ids), recipes, PREFS);

      expect(violations).toHaveLength(1);
      expect(violations[0]!.rule).toBe('perishability');
      expect(violations[0]!.message).toMatch(/salmon/i);
    });

    test('accepts the same fish planned early in the week', () => {
      const { recipes, ids } = goodWeek();
      recipes[1]!.ingredients = [ing('salmon fillets', { keepsDays: 2, category: 'meat-fish' })];

      expect(validatePlan(plan(ids), recipes, PREFS)).toEqual([]);
    });

    test('ignores ingredients that declare no shelf life', () => {
      const { recipes, ids } = goodWeek();
      recipes[6]!.ingredients = [ing('dried pasta', { category: 'dry-goods' })];

      expect(validatePlan(plan(ids), recipes, PREFS)).toEqual([]);
    });
  });

  describe('variety', () => {
    test('rejects the same cuisine two nights running', () => {
      const { recipes, ids } = goodWeek();
      recipes[1]!.cuisine = 'mediterranean'; // same as night 0

      const violations = validatePlan(plan(ids), recipes, PREFS);

      expect(violations.map((v) => v.rule)).toEqual(['cuisine-repeat']);
      expect(violations[0]!.date).toBe(WEEK_DATES[1]);
    });

    test('rejects the same recipe planned twice in one week', () => {
      const { recipes, ids } = goodWeek();
      const repeated = [...ids];
      repeated[3] = ids[0]!;

      const violations = validatePlan(plan(repeated), recipes, PREFS);

      expect(violations.some((v) => v.rule === 'recipe-repeat')).toBe(true);
    });

    test('rejects a recipe cooked within the no-repeat window', () => {
      const { recipes, ids } = goodWeek();
      recipes[2]!.lastCooked = '2026-08-01'; // 18 days before, window is 28

      const violations = validatePlan(plan(ids), recipes, PREFS);

      expect(violations.map((v) => v.rule)).toEqual(['recipe-repeat']);
    });

    test('accepts a recipe last cooked before the window opened', () => {
      const { recipes, ids } = goodWeek();
      recipes[2]!.lastCooked = '2026-06-01';

      expect(validatePlan(plan(ids), recipes, PREFS)).toEqual([]);
    });
  });

  describe('referential integrity', () => {
    test('reports a dinner pointing at a recipe that does not exist', () => {
      const { recipes, ids } = goodWeek();
      const broken = [...ids];
      broken[2] = 'no-such-recipe';

      const violations = validatePlan(plan(broken), recipes, PREFS);

      expect(violations.some((v) => v.rule === 'missing-recipe')).toBe(true);
    });
  });

  test('reports every violation at once rather than stopping at the first', () => {
    const { recipes, ids } = goodWeek();
    recipes[0]!.ingredients = [ing('bacon')];
    recipes[1]!.totalMinutes = 60;

    const violations = validatePlan(plan(ids), recipes, PREFS);

    expect(violations.map((v) => v.rule).sort()).toEqual(['exclusion', 'time-cap']);
  });
});
