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
src/lib/               validator, consolidator, units, aisle grouping (test-first)
scripts/               the week's pipeline, run with npm
website/               static site deployed by the Cloudflare Worker (wrangler.jsonc)
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

Pushing `main` deploys `website/` through Cloudflare Workers Builds. The list is served at `/shop/`.
