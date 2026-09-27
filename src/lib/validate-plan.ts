import type { MealSlot, Plan, Preferences, Recipe, Violation } from './types.js';

const MS_PER_DAY = 86_400_000;

/** Parses an ISO date as UTC midnight so weekday maths never shifts with the timezone. */
function parseDate(iso: string): Date {
  return new Date(`${iso}T00:00:00Z`);
}

function daysBetween(from: string, to: string): number {
  return Math.round((parseDate(to).getTime() - parseDate(from).getTime()) / MS_PER_DAY);
}

const SLOTS: MealSlot[] = ['breakfast', 'lunch', 'dinner'];

/**
 * Checks a proposed week against every household rule and returns all violations
 * rather than stopping at the first, so a single pass tells the planner everything
 * it needs to fix.
 *
 * This is the deterministic gate between a generated plan and the shopping list.
 * The model proposes; this decides.
 */
export function validatePlan(plan: Plan, recipes: Recipe[], prefs: Preferences): Violation[] {
  const library = new Map(recipes.map((r) => [r.id, r]));
  const violations: Violation[] = [];
  const dinnersSeen = new Map<string, string>();
  let previousCuisine: string | null = null;

  plan.days.forEach((day, dayIndex) => {
    const weekday = parseDate(day.date).getUTCDay();
    const isWeeknight = prefs.weeknights.includes(weekday);

    for (const slot of SLOTS) {
      const planned = day[slot];
      const found = library.get(planned.recipeId);

      if (!found) {
        violations.push({
          rule: 'missing-recipe',
          date: day.date,
          message: `${slot} refers to unknown recipe "${planned.recipeId}"`,
        });
        continue;
      }

      checkExclusions(found, day.date, prefs, violations);
      checkPerishability(found, day.date, dayIndex, violations);

      if (slot !== 'dinner') continue;

      if (isWeeknight && found.totalMinutes > prefs.maxWeeknightMinutes) {
        violations.push({
          rule: 'time-cap',
          date: day.date,
          message: `"${found.title}" takes ${found.totalMinutes} min, over the ${prefs.maxWeeknightMinutes} min weeknight cap`,
        });
      }

      if (prefs.household.toddlers > 0 && found.toddlerSplit.trim() === '') {
        violations.push({
          rule: 'toddler-safe',
          date: day.date,
          message: `"${found.title}" states no toddler split`,
        });
      }

      if (previousCuisine !== null && found.cuisine === previousCuisine) {
        violations.push({
          rule: 'cuisine-repeat',
          date: day.date,
          message: `${found.cuisine} two nights running`,
        });
      }
      previousCuisine = found.cuisine;

      const earlierDate = dinnersSeen.get(found.id);
      if (earlierDate) {
        violations.push({
          rule: 'recipe-repeat',
          date: day.date,
          message: `"${found.title}" is already planned for ${earlierDate}`,
        });
      } else {
        dinnersSeen.set(found.id, day.date);
      }

      if (found.lastCooked) {
        const since = daysBetween(found.lastCooked, plan.weekOf);
        if (since >= 0 && since < prefs.noRepeatDays) {
          violations.push({
            rule: 'recipe-repeat',
            date: day.date,
            message: `"${found.title}" was cooked ${since} days ago, inside the ${prefs.noRepeatDays} day window`,
          });
        }
      }
    }
  });

  return violations;
}

function checkExclusions(
  found: Recipe,
  date: string,
  prefs: Preferences,
  violations: Violation[],
): void {
  for (const ingredient of found.ingredients) {
    const name = ingredient.item.toLowerCase();
    // First match only: "smoked bacon lardons" is one problem, not two.
    const hit = prefs.exclusions.find((x) => name.includes(x.toLowerCase()));
    if (hit) {
      violations.push({
        rule: 'exclusion',
        date,
        message: `"${found.title}" contains excluded ingredient "${ingredient.item}"`,
      });
    }
  }
}

/**
 * With one shop a week, an ingredient must still be good on the day it is cooked.
 * Day 0 is shopping day, so a two-day fish cannot appear on Friday.
 */
function checkPerishability(
  found: Recipe,
  date: string,
  dayIndex: number,
  violations: Violation[],
): void {
  for (const ingredient of found.ingredients) {
    if (ingredient.keepsDays === undefined) continue;
    if (dayIndex > ingredient.keepsDays) {
      violations.push({
        rule: 'perishability',
        date,
        message: `"${ingredient.item}" keeps ${ingredient.keepsDays} days but is cooked on day ${dayIndex}`,
      });
    }
  }
}
