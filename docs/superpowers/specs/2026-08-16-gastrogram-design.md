# Gastrogram — Design Spec

**Date:** 2026-08-16
**Status:** Approved

## Problem

The household shops once a week, in person, and wants that single trip to cover
everything — dinners, breakfasts, lunches, snacks, drinks, milk, eggs, household
basics. Today that means ad-hoc list-making, forgotten staples, and mid-week top-up
trips that defeat the purpose of the weekly shop.

## Household profile

| | |
|---|---|
| Eaters | 2 adults + 2 toddlers (ages 3 and 2) |
| Constraint | Pork-free (hard exclusion, never violated) |
| Cuisines | Mediterranean, Asian, European comfort |
| Rhythm | Cook fresh nightly, hard cap 30 min total per weeknight |
| Coverage | Breakfast, lunch, dinner, snacks, drinks — all 7 days |
| Shopping | One in-person shop/week now; online ordering later |

Two toddler-driven constraints shape every recipe: **low active time** (you cannot
babysit a pan with a 2-year-old in the house) and a **toddler split** — one base dish,
adult seasoning added at the end, so nobody cooks two meals.

## Architecture

The filesystem is the database. Claude Code skills are the brain; a local server +
React app is the eyes and hands. Both read and write the same JSON under `data/`.

```
Claude Code skills ──write──▶  data/*.json  ◀──read/write── Express + React UI
      (the brain)                                                (the hands)
                                    │
                              publish-list skill
                                    ▼
                          private URL → phone in the shop
```

Planning is constraint satisfaction over taste, time and perishability — that belongs
where the reasoning is. Ticking off carrots is not reasoning — that belongs in a UI.
Splitting them along the JSON files keeps each side small and independently testable.

## Core algorithm 1 — plan generation as constraint satisfaction

A generated week must satisfy, in priority order:

1. **Hard exclusions** — pork-free plus any allergy in `preferences.json`. Never violated.
2. **Time cap** — every weeknight dinner within the configured cap (30 min total).
3. **Toddler-safe base** — every dinner has a version a 2-year-old eats, with the
   seasoning split stated explicitly.
4. **Ingredient overlap** — perishables deliberately reused across 2–3 recipes so a
   bunch of coriander gets used up rather than composted.
5. **Perishability ordering** — days sequenced by shelf life. Fish and fresh leaves
   early in the week; root veg, frozen and tinned late.
6. **Variety** — no cuisine two nights running; no recipe repeated within 4 weeks.

**A deterministic validator sits between the LLM and the output.** The agent proposes a
plan, pure TypeScript checks rules 1–6, violations are fed back for a fix. The LLM
proposes; code decides. Without this, the pork shows up in week three.

## Core algorithm 2 — shopping list consolidation

```
plan ingredients + staples − pantry → normalise units → round to packs → group by aisle
```

- **Unit normalisation** — 300 g + 0.5 kg resolve to one line, one number.
- **Pack rounding** — need 150 g crème fraîche → buy the 200 g tub, flag the 50 g
  remainder so next week's planner can spend it.
- **Aisle grouping** — categories ordered to match the walk through the shop.
- **Pantry stays deliberately dumb** — a short hand-maintained list of things always in
  the house, so the list stops asking you to buy olive oil every week. Full inventory
  tracking with depletion maths is explicitly not built; it always drifts out of sync
  with reality.

## Data contracts

**recipe** — `id`, `title`, `cuisine`, `activeMinutes`, `totalMinutes`,
`serves {adults, toddlers}`, `toddlerSplit`, `tags[]`,
`ingredients[] {item, qty, unit, category}`, `steps[]`, `lastCooked`, `rating`.

**plan** — `weekOf`, `days[] {date, breakfast, lunch, dinner {recipeId, notes}, snacks[]}`.

**shopping-list** — `items[] {name, qty, unit, category, sources[], checked, note}`.
`sources` records which recipes (or `staples`) produced each line, so the UI can answer
"why am I buying 3 lemons?".

## Build order

- **Phase 1 — the brain.** Data contracts, seed data, seed recipes, `plan-week` and
  `build-shopping-list` skills. `src/lib/` written test-first.
- **Phase 2 — the hands.** Express server, React app: Week, Shopping list, Recipe.
- **Phase 3 — the edges.** Preferences/Pantry editing, swap-a-meal, `add-recipe`,
  `publish-list`.

Each phase ends in something usable. Stopping after Phase 1 still leaves a working
weekly planner.

## Explicitly not building

- Full pantry inventory / depletion tracking.
- Supermarket API integration (data model is export-ready for it later).
- Calorie or macro tracking.
- Multi-household accounts, auth, cloud sync.
