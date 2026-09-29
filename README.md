# Gastrogram

Weekly meal planning and one-shop grocery agent for a household of two adults and two toddlers. The filesystem is the database: everything lives as JSON under `data/`, and the TypeScript library under `src/lib/` validates plans and builds shopping lists. The design is written up in `docs/superpowers/specs/2026-08-16-gastrogram-design.md`.

## Layout

```
data/
  preferences.json     household, exclusions, cuisines, time cap, aisle order
  pantry.json          always in the house, never on the list
  staples.json         bought every week regardless of the plan
  recipes/*.json       one file per recipe
  plans/<monday>.json  a week's meals
  shopping-lists/<monday>.json   the consolidated list for that week
  prices.json          prices learned from till receipts, per item
src/lib/               validator, consolidator, units, aisle grouping (test-first)
scripts/               the week's pipeline, run with npm
website/               static site deployed by Vercel (vercel.json): the list at /shop/, one page per recipe at /recipes/<id>/
```

## A week, start to finish

```bash
npm install
npm test

# 1. Write data/plans/<monday>.json, then validate it and build the list
npm run shopping-list -- 2026-09-28

# 2. Build the phone page (website/shop/index.html plus the artifact variant in dist/)
npm run shop-page -- 2026-09-28
```

Pushing `main` deploys `website/` on Vercel (see `vercel.json`). The list is served at `/shop/`, and the site root redirects there.

## After the shop

The list has an "After the shop" section on its Claude copy (the artifact). Upload the till receipt there, as a photo or PDF: it lands in the artifact's private asset store, indexed by a record under `weeks/<monday>/receipts` in the artifact's database, marked `processed: false`.

Then, in a Claude Code session, ask for the prices to be learned. Claude lists that week's receipt records, fetches each asset by id, reads the receipt, and appends what it finds to `data/prices.json`:

```json
{
  "currency": "GBP",
  "items": {
    "whole milk": [
      { "date": "2026-09-28", "shop": "Tesco", "price": 1.45, "qty": 2, "unit": "l", "receipt": "<asset id>" }
    ]
  }
}
```

Item names match the shopping list, lower-cased. Once a record is processed, Claude sets `processed: true` on it, and the next list build shows the last known price under each line.
