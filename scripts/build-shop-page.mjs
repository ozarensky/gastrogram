// Builds the phone shopping-list page for a week from the saved plan and list.
// Usage: npm run shop-page -- 2026-09-28
//
// Writes two files:
//   website/shop/index.html        a complete document, served as a static file by Vercel (see vercel.json)
//   dist/shop-page.artifact.html   the same page without the document shell, for publishing as a Claude artifact
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { groupByAisle } from '../dist/lib/aisles.js';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const weekOf = process.argv[2];
if (!weekOf) {
  console.error('usage: node scripts/build-shop-page.mjs <weekOf, the ISO date of the Monday>');
  process.exit(2);
}

const read = (p) => JSON.parse(readFileSync(join(root, p), 'utf8'));
const prefs = read('data/preferences.json');
const list = read(`data/shopping-lists/${weekOf}.json`);
const plan = read(`data/plans/${weekOf}.json`);
const recipes = Object.fromEntries(
  readdirSync(join(root, 'data/recipes'))
    .filter((f) => f.endsWith('.json'))
    .map((f) => {
      const r = read(`data/recipes/${f}`);
      return [r.id, r];
    }),
);

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const dateOf = (iso) => new Date(`${iso}T00:00:00Z`);
const dayOf = (iso) => DAYS[dateOf(iso).getUTCDay()];
const weekLabel = `${dayOf(weekOf)} ${dateOf(weekOf).getUTCDate()} ${MONTHS[dateOf(weekOf).getUTCMonth()]}`;

/** Short names for the "why am I buying this" line. Anything missing falls back to the recipe title. */
const SHORT = {
  'miso-cod-greens': 'miso cod',
  'lemon-chicken-orzo': 'lemon orzo',
  'quick-beef-stroganoff': 'stroganoff',
  'chicken-noodle-stir-fry': 'stir-fry',
  'gnocchi-tomato-mozzarella-bake': 'gnocchi bake',
  'chicken-sausage-root-traybake': 'traybake',
  'coconut-veg-noodle-soup': 'coconut soup',
  'tuna-white-bean-pasta': 'tuna pasta',
};
const CATEGORY = {
  produce: 'Produce',
  bakery: 'Bakery',
  dairy: 'Dairy',
  'meat-fish': 'Meat & fish',
  frozen: 'Frozen',
  'dry-goods': 'Dry goods',
  'tins-jars': 'Tins & jars',
  drinks: 'Drinks',
  snacks: 'Snacks',
  household: 'Household',
};

const sourceLabel = { staples: 'staples' };
for (const day of plan.days) {
  const id = day.dinner.recipeId;
  sourceLabel[id] = `${dayOf(day.date)} ${SHORT[id] ?? recipes[id]?.title.toLowerCase() ?? id}`;
  for (const slot of ['breakfast', 'lunch']) {
    const sid = day[slot].recipeId;
    if (!sourceLabel[sid]) sourceLabel[sid] = `${slot}s`;
  }
}

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ESC[c]);
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
function qtyText(q, u) {
  if (u === 'unit') return String(q);
  if (u === 'pack') return `${q} ${q === 1 ? 'pack' : 'packs'}`;
  if (u === 'bunch') return `${q} ${q === 1 ? 'bunch' : 'bunches'}`;
  return `${q} ${u}`;
}

const groups = groupByAisle(list.items, prefs.aisleOrder);
const sections = groups
  .map((g) => {
    const rows = g.items
      .map((i) => {
        const id = slug(i.name);
        const src = i.sources.map((s) => sourceLabel[s] ?? s).join(', ');
        const note = i.note ? `<span class="note">${esc(i.note)}</span>` : '';
        return `      <li class="item" data-slug="${id}">
        <label for="tick-${id}">
          <input type="checkbox" class="tick" id="tick-${id}">
          <span class="box" aria-hidden="true"></span>
          <span class="text"><span class="name">${esc(cap(i.name))}</span><span class="src">${esc(src)}</span>${note}</span>
          <span class="qty">${esc(qtyText(i.qty, i.unit))}</span>
        </label>
      </li>`;
      })
      .join('\n');
    return `  <section class="aisle" id="${g.category}">
    <h2><span>${esc(CATEGORY[g.category] ?? g.category)}</span><span class="left" data-left>${g.items.length} left</span></h2>
    <ul class="items">
${rows}
    </ul>
  </section>`;
  })
  .join('\n');

const dinners = plan.days
  .map((d) => {
    const r = recipes[d.dinner.recipeId];
    const note = d.dinner.notes ? `<span class="pnote">${esc(d.dinner.notes)}</span>` : '';
    return `      <li><span class="day">${dayOf(d.date)}</span><span>${esc(r?.title ?? d.dinner.recipeId)}${note}</span></li>`;
  })
  .join('\n');

const uniq = (ids) => [...new Set(ids)].map((id) => recipes[id]?.title ?? id);
const breakfasts = uniq(plan.days.map((d) => d.breakfast.recipeId)).join(', ');
const lunches = uniq(plan.days.map((d) => d.lunch.recipeId)).join(', ');

const total = list.items.length;
const summary = `${total} lines from this week's ${plan.days.length} dinners, the breakfasts and the staples list. Oil, spices, stock cubes and other pantry basics are left off.`;

const page = readFileSync(join(here, 'shop-page.template.html'), 'utf8')
  .replaceAll('{{WEEK}}', weekOf)
  .replaceAll('{{WEEK_LABEL}}', esc(weekLabel))
  .replaceAll('{{TOTAL}}', String(total))
  .replaceAll('{{DINNERS}}', dinners)
  .replaceAll('{{BREAKFASTS}}', esc(breakfasts))
  .replaceAll('{{LUNCHES}}', esc(lunches))
  .replaceAll('{{SECTIONS}}', sections)
  .replaceAll('{{SUMMARY}}', esc(summary));

// The artifact variant is the bare page: claude.ai wraps it in its own document shell.
const artifactFile = join(root, 'dist/shop-page.artifact.html');
mkdirSync(dirname(artifactFile), { recursive: true });
writeFileSync(artifactFile, page);

// The website variant is a complete document for a plain static host.
const split = page.indexOf('<div class="wrap">');
const head = page.slice(0, split).trim();
const main = page.slice(split).trim();
const standalone = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="robots" content="noindex, nofollow">
<meta name="color-scheme" content="dark light">
${head}
<style>
  :root { padding-top: env(safe-area-inset-top, 0px); padding-bottom: env(safe-area-inset-bottom, 0px); }
  [hidden] { display: none !important; }
</style>
</head>
<body>
${main}
</body>
</html>
`;
const siteFile = join(root, 'website/shop/index.html');
mkdirSync(dirname(siteFile), { recursive: true });
writeFileSync(siteFile, standalone);

console.log(`${total} items in ${groups.length} aisles for the week of ${weekLabel}`);
console.log(`  website/shop/index.html      (${standalone.length} bytes)`);
console.log(`  dist/shop-page.artifact.html (${page.length} bytes)`);
