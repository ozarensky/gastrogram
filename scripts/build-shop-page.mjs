// Builds the phone pages for a week from the saved plan, list and recipe library.
// Usage: npm run shop-page -- 2026-09-28
//
// Writes:
//   website/shop/index.html          the shopping list, served as a static file by Vercel (see vercel.json)
//   website/recipes/<id>/index.html  one page per recipe in the library, linked from the list
//   dist/shop-page.artifact.html     the list without the document shell, for publishing as a Claude artifact
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
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

/** Where the website lives. The artifact copy links here; the website itself uses root-relative links. */
const SITE = 'https://gastrogram.co.uk';

const read = (p) => JSON.parse(readFileSync(join(root, p), 'utf8'));
const prefs = read('data/preferences.json');
const list = read(`data/shopping-lists/${weekOf}.json`);
const plan = read(`data/plans/${weekOf}.json`);
const prices = existsSync(join(root, 'data/prices.json')) ? read('data/prices.json') : { currency: 'GBP', items: {} };
const recipes = Object.fromEntries(
  readdirSync(join(root, 'data/recipes'))
    .filter((f) => f.endsWith('.json'))
    .map((f) => {
      const r = read(`data/recipes/${f}`);
      return [r.id, r];
    }),
);

const partial = (name) => readFileSync(join(here, 'partials', name), 'utf8');
const HEAD = partial('head.html');
const CONTROLS_JS = partial('controls.js');
const shopTemplate = readFileSync(join(here, 'shop-page.template.html'), 'utf8');
const recipeTemplate = readFileSync(join(here, 'recipe-page.template.html'), 'utf8');

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const dateOf = (iso) => new Date(`${iso}T00:00:00Z`);
const dayOf = (iso) => DAYS[dateOf(iso).getUTCDay()];
const longDay = (iso) => `${dayOf(iso)} ${dateOf(iso).getUTCDate()} ${MONTHS[dateOf(iso).getUTCMonth()]}`;
const weekLabel = longDay(weekOf);

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
const CURRENCY = { GBP: '£', EUR: '€', USD: '$' };

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
function fill(template, values) {
  let out = template;
  for (const [key, value] of Object.entries(values)) out = out.replaceAll(`{{${key}}}`, value);
  return out;
}
function standalone(page) {
  const split = page.indexOf('<div class="wrap">');
  const head = page.slice(0, split).trim();
  const main = page.slice(split).trim();
  return `<!doctype html>
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
}
function writeOut(file, content) {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, content);
}

// Where each recipe appears this week: the source labels on the list, and the "when" line on its page.
const sourceLabel = { staples: 'staples' };
const usage = new Map();
for (const day of plan.days) {
  for (const slot of ['breakfast', 'lunch', 'dinner']) {
    const id = day[slot].recipeId;
    if (!usage.has(id)) usage.set(id, { slot, days: [] });
    usage.get(id).days.push(day.date);
    if (slot === 'dinner') sourceLabel[id] = `${dayOf(day.date)} ${SHORT[id] ?? recipes[id]?.title.toLowerCase() ?? id}`;
    else if (!sourceLabel[id]) sourceLabel[id] = `${slot}s`;
  }
}
function whenLabel(id) {
  const u = usage.get(id);
  if (!u) return 'In the library, not planned this week';
  if (u.slot === 'dinner') return `Dinner · ${longDay(u.days[0])}`;
  return `${cap(u.slot)} · ${u.days.map(dayOf).join(', ')}`;
}
function recipeMeta(r) {
  return r.activeMinutes === r.totalMinutes ? `${r.totalMinutes} min` : `${r.totalMinutes} min, ${r.activeMinutes} active`;
}

/** The last price seen for a line, from data/prices.json, as a short hint under the item. */
function priceHint(name) {
  const seen = prices.items?.[name.toLowerCase()];
  if (!Array.isArray(seen) || seen.length === 0) return '';
  const last = [...seen].sort((a, b) => String(a.date).localeCompare(String(b.date))).at(-1);
  if (typeof last.price !== 'number') return '';
  const symbol = CURRENCY[prices.currency] ?? '';
  const amount = `${symbol}${last.price.toFixed(2)}`;
  const forWhat = last.qty && last.unit ? ` for ${qtyText(last.qty, last.unit)}` : '';
  const where = last.shop ? `, ${last.shop}` : '';
  return `<span class="price">${esc(`${amount}${forWhat}${where}`)}</span>`;
}

// The shopping list, aisle by aisle.
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
          <span class="text"><span class="name">${esc(cap(i.name))}</span><span class="src">${esc(src)}</span>${priceHint(i.name)}${note}</span>
          <span class="qty">${esc(qtyText(i.qty, i.unit))}</span>
        </label>
      </li>`;
      })
      .join('\n');
    return `  <section class="aisle" id="${g.category}">
    <h2 class="section-title"><span>${esc(CATEGORY[g.category] ?? g.category)}</span><span class="left" data-left>${g.items.length} left</span></h2>
    <ul class="items">
${rows}
    </ul>
  </section>`;
  })
  .join('\n');

// The week's dinners, each linking to its recipe page.
const dinners = plan.days
  .map((d) => {
    const id = d.dinner.recipeId;
    const r = recipes[id];
    const note = d.dinner.notes ? `<span class="pnote">${esc(d.dinner.notes)}</span>` : '';
    const title = r ? `<a href="{{SITE}}/recipes/${id}/" target="_blank" rel="noopener">${esc(r.title)}</a>` : esc(id);
    return `      <li><span class="day">${dayOf(d.date)}</span><span>${title}${note}</span></li>`;
  })
  .join('\n');

const uniq = (ids) => [...new Set(ids)].map((id) => recipes[id]?.title ?? id);
const breakfasts = uniq(plan.days.map((d) => d.breakfast.recipeId)).join(', ');
const lunches = uniq(plan.days.map((d) => d.lunch.recipeId)).join(', ');

/** One row in the recipes list: opens the recipe's own page in a new tab. */
function recipeLink(id, when) {
  const r = recipes[id];
  if (!r) return '';
  return `    <a class="recipe" href="{{SITE}}/recipes/${id}/" target="_blank" rel="noopener">
      <span class="day">${esc(when)}</span>
      <span class="rmain"><span class="rtitle">${esc(r.title)}</span><span class="meta">${esc(recipeMeta(r))}</span></span>
      <span class="open" aria-hidden="true">Open</span>
    </a>`;
}
function slotLinks(slot) {
  return [...usage].filter(([, u]) => u.slot === slot).map(([id, u]) => recipeLink(id, u.days.map(dayOf).join(' '))).join('\n');
}
const recipesHtml = `  <section class="recipes" id="recipes">
    <h2 class="section-title"><span>Recipes</span><span class="left">${usage.size} this week</span></h2>
    <h3>Dinners</h3>
${plan.days.map((d) => recipeLink(d.dinner.recipeId, dayOf(d.date))).join('\n')}
    <h3>Breakfasts</h3>
${slotLinks('breakfast')}
    <h3>Lunches</h3>
${slotLinks('lunch')}
  </section>`;

const total = list.items.length;
const summary = `${total} lines from this week's ${plan.days.length} dinners, the breakfasts and the staples list. Oil, spices, stock cubes and other pantry basics are left off.`;

const shopPage = fill(shopTemplate, {
  HEAD,
  CONTROLS_JS,
  WEEK: weekOf,
  WEEK_LABEL: esc(weekLabel),
  TOTAL: String(total),
  DINNERS: dinners,
  BREAKFASTS: esc(breakfasts),
  LUNCHES: esc(lunches),
  SECTIONS: sections,
  RECIPES: recipesHtml,
  SUMMARY: esc(summary),
});

// The artifact copy is the bare page (claude.ai adds the document shell) and links to the website's recipe pages.
const artifactPage = shopPage.replaceAll('{{SITE}}', SITE);
writeOut(join(root, 'dist/shop-page.artifact.html'), artifactPage);

// The website copy is a complete document with root-relative links.
const sitePage = standalone(shopPage.replaceAll('{{SITE}}', ''));
writeOut(join(root, 'website/shop/index.html'), sitePage);

// One page per recipe in the library, regenerated from scratch so removed recipes disappear.
rmSync(join(root, 'website/recipes'), { recursive: true, force: true });
for (const r of Object.values(recipes)) {
  const ingredients = r.ingredients.length
    ? `  <ul class="ings">
${r.ingredients.map((i) => `    <li><span class="iqty">${esc(qtyText(i.qty, i.unit))}</span><span>${esc(i.item)}</span></li>`).join('\n')}
  </ul>`
    : `  <p class="staples-only">Everything for this is on the staples list.</p>`;
  const planNote = usage.get(r.id)?.slot === 'dinner' ? plan.days.find((d) => d.dinner.recipeId === r.id)?.dinner.notes : undefined;
  const page = fill(recipeTemplate, {
    TITLE: esc(r.title),
    HEAD,
    CONTROLS_JS,
    SITE: '',
    WHEN: esc(whenLabel(r.id)),
    TOTAL_MIN: String(r.totalMinutes),
    ACTIVE_MIN: String(r.activeMinutes),
    SERVES: esc(`${r.serves.adults} adults, ${r.serves.toddlers} toddlers`),
    CUISINE: esc(cap(r.cuisine.replace(/-/g, ' '))),
    PLAN_NOTE: planNote ? `  <p class="plan-note">${esc(planNote)}</p>` : '',
    TODDLER: esc(r.toddlerSplit),
    ING_COUNT: r.ingredients.length ? `${r.ingredients.length} items` : 'staples',
    INGREDIENTS: ingredients,
    STEP_COUNT: String(r.steps.length),
    STEPS: r.steps.map((s) => `    <li>${esc(s)}</li>`).join('\n'),
  });
  writeOut(join(root, `website/recipes/${r.id}/index.html`), standalone(page));
}

console.log(`${total} items in ${groups.length} aisles for the week of ${weekLabel}; ${usage.size} recipes planned`);
console.log(`  website/shop/index.html          (${sitePage.length} bytes)`);
console.log(`  website/recipes/<id>/index.html  (${Object.keys(recipes).length} pages)`);
console.log(`  dist/shop-page.artifact.html     (${artifactPage.length} bytes)`);
