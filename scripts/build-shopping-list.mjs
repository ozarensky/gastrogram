// Validates a week's plan against the household rules, then writes the consolidated shopping list.
// Usage: npm run shopping-list -- 2026-09-28   (the ISO date of the week's Monday)
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { groupByAisle } from '../dist/lib/aisles.js';
import { consolidate } from '../dist/lib/consolidate.js';
import { validatePlan } from '../dist/lib/validate-plan.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const weekOf = process.argv[2];
if (!weekOf) {
  console.error('usage: node scripts/build-shopping-list.mjs <weekOf, the ISO date of the Monday>');
  process.exit(2);
}

const read = (p) => JSON.parse(readFileSync(join(root, p), 'utf8'));
const prefs = read('data/preferences.json');
const pantry = read('data/pantry.json');
const staples = read('data/staples.json');
const recipes = readdirSync(join(root, 'data/recipes'))
  .filter((f) => f.endsWith('.json'))
  .map((f) => read(`data/recipes/${f}`));
const plan = read(`data/plans/${weekOf}.json`);

const violations = validatePlan(plan, recipes, prefs);
if (violations.length) {
  console.error(`Plan for ${weekOf} has ${violations.length} violation(s):`);
  for (const v of violations) console.error(`  ${v.date} [${v.rule}] ${v.message}`);
  process.exit(1);
}
console.log(`Plan for ${weekOf} is valid.`);

const list = consolidate(plan, recipes, staples, pantry, prefs);

// Keep any hand-written notes from a previous run of the same week.
const outFile = join(root, `data/shopping-lists/${weekOf}.json`);
if (existsSync(outFile)) {
  const previous = JSON.parse(readFileSync(outFile, 'utf8'));
  const notes = new Map(previous.items.filter((i) => i.note).map((i) => [i.name.toLowerCase(), i.note]));
  for (const item of list.items) {
    const note = notes.get(item.name.toLowerCase());
    if (note) item.note = note;
  }
}

mkdirSync(dirname(outFile), { recursive: true });
writeFileSync(outFile, JSON.stringify(list, null, 2) + '\n');

for (const group of groupByAisle(list.items, prefs.aisleOrder)) {
  console.log(`\n${group.category} (${group.items.length})`);
  for (const item of group.items) {
    console.log(`  ${item.name}: ${item.qty} ${item.unit}   <- ${item.sources.join(', ')}`);
  }
}
console.log(`\n${list.items.length} lines written to data/shopping-lists/${weekOf}.json`);
