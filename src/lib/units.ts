import type { Unit } from './types.js';

export interface Quantity {
  qty: number;
  unit: Unit;
}

export interface RoundedQuantity extends Quantity {
  /** How much of the bought amount the week's recipes do not use. */
  leftover: number;
}

/**
 * Units only combine within their own family. Each family has a base unit and a
 * conversion factor into it. `bunch` and `pack` are shop units with no measured
 * equivalent, so each sits alone — 2 bunches + 1 bunch is 3 bunches, but a bunch
 * plus 30 g is two separate lines on the list.
 */
const FAMILIES: Record<string, { base: Unit; factors: Partial<Record<Unit, number>> }> = {
  mass: { base: 'g', factors: { g: 1, kg: 1000 } },
  volume: { base: 'ml', factors: { ml: 1, l: 1000, tsp: 5, tbsp: 15 } },
  count: { base: 'unit', factors: { unit: 1 } },
  bunch: { base: 'bunch', factors: { bunch: 1 } },
  pack: { base: 'pack', factors: { pack: 1 } },
};

function familyOf(unit: Unit): string {
  for (const [name, family] of Object.entries(FAMILIES)) {
    if (unit in family.factors) return name;
  }
  throw new Error(`Unknown unit: ${unit}`);
}

/** True when two units describe the same kind of thing and can share one list line. */
export function canMerge(a: Unit, b: Unit): boolean {
  return familyOf(a) === familyOf(b);
}

/** Combines two quantities, converting into the family's base unit when they differ. */
export function addQuantities(a: Quantity, b: Quantity): Quantity {
  if (!canMerge(a.unit, b.unit)) {
    throw new Error(`Cannot add ${a.unit} to ${b.unit}: different kinds of quantity`);
  }

  if (a.unit === b.unit) {
    return { qty: a.qty + b.qty, unit: a.unit };
  }

  const family = FAMILIES[familyOf(a.unit)]!;
  const total = a.qty * family.factors[a.unit]! + b.qty * family.factors[b.unit]!;
  return { qty: total, unit: family.base };
}

/**
 * Rounds a needed amount up to whole packs, reporting what will be left over so the
 * next week's plan can spend it rather than let it rot.
 */
export function roundToPack(need: Quantity, packSize: number | undefined): RoundedQuantity {
  if (packSize === undefined || packSize <= 0) {
    return { ...need, leftover: 0 };
  }

  const packs = Math.ceil(need.qty / packSize);
  const bought = packs * packSize;
  return { qty: bought, unit: need.unit, leftover: bought - need.qty };
}
