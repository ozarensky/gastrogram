import { describe, expect, test } from 'vitest';
import { addQuantities, canMerge, roundToPack } from './units.js';

describe('addQuantities', () => {
  test('adds two masses expressed in different units', () => {
    expect(addQuantities({ qty: 300, unit: 'g' }, { qty: 0.5, unit: 'kg' })).toEqual({
      qty: 800,
      unit: 'g',
    });
  });

  test('adds two volumes expressed in different units', () => {
    expect(addQuantities({ qty: 250, unit: 'ml' }, { qty: 1, unit: 'l' })).toEqual({
      qty: 1250,
      unit: 'ml',
    });
  });

  test('converts spoons to millilitres when adding to a volume', () => {
    expect(addQuantities({ qty: 2, unit: 'tbsp' }, { qty: 30, unit: 'ml' })).toEqual({
      qty: 60,
      unit: 'ml',
    });
  });

  test('keeps the larger unit when both sides use it', () => {
    expect(addQuantities({ qty: 1, unit: 'kg' }, { qty: 2, unit: 'kg' })).toEqual({
      qty: 3,
      unit: 'kg',
    });
  });

  test('adds counts of discrete things', () => {
    expect(addQuantities({ qty: 2, unit: 'unit' }, { qty: 3, unit: 'unit' })).toEqual({
      qty: 5,
      unit: 'unit',
    });
  });

  test('refuses to add a mass to a volume', () => {
    expect(() => addQuantities({ qty: 100, unit: 'g' }, { qty: 100, unit: 'ml' })).toThrow(
      /cannot add/i,
    );
  });

  test('refuses to add a count to a mass', () => {
    expect(() => addQuantities({ qty: 2, unit: 'unit' }, { qty: 100, unit: 'g' })).toThrow(
      /cannot add/i,
    );
  });
});

describe('canMerge', () => {
  test('mass and mass can merge', () => {
    expect(canMerge('g', 'kg')).toBe(true);
  });

  test('volume and spoons can merge', () => {
    expect(canMerge('tsp', 'l')).toBe(true);
  });

  test('mass and volume cannot merge', () => {
    expect(canMerge('g', 'ml')).toBe(false);
  });

  test('a bunch does not merge with a count', () => {
    expect(canMerge('bunch', 'unit')).toBe(false);
  });
});

describe('roundToPack', () => {
  test('rounds up to the next whole pack and flags the remainder', () => {
    expect(roundToPack({ qty: 150, unit: 'g' }, 200)).toEqual({
      qty: 200,
      unit: 'g',
      leftover: 50,
    });
  });

  test('buys two packs when one is not enough', () => {
    expect(roundToPack({ qty: 350, unit: 'g' }, 200)).toEqual({
      qty: 400,
      unit: 'g',
      leftover: 50,
    });
  });

  test('reports no leftover when the need is an exact multiple', () => {
    expect(roundToPack({ qty: 400, unit: 'g' }, 200)).toEqual({
      qty: 400,
      unit: 'g',
      leftover: 0,
    });
  });

  test('leaves the quantity untouched when there is no pack size', () => {
    expect(roundToPack({ qty: 3, unit: 'unit' }, undefined)).toEqual({
      qty: 3,
      unit: 'unit',
      leftover: 0,
    });
  });
});
