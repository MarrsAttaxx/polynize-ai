# polynize.ai — Claude Code Build Package

This is the complete handoff package for the polynize.ai v1 rebuild. Everything Claude Code needs to build the site is inside this folder.

## Understanding PAM

This repo also runs the **PAM Console** (Polynize Agent Management), not just the public website. To understand how PAM is built, why it is built that way, and where it is headed, **start at [`docs/START-HERE.md`](docs/START-HERE.md)** — the entry point and index to the architecture, the load-bearing decision log, and the maturity report.

> **Docs convention:** when you change PAM, update the relevant `docs/` file in the *same commit* so the docs never drift from the code. If a change would contradict a decision in `docs/decisions.md`, stop and flag it rather than proceeding.

## What to do with this

1. **Unzip this folder into the root of your new Next.js repo.** After unzipping, your repo root should contain:
   - `CLAUDE.md` (the root-level brief for Claude Code)
   - `config/cwu-shapes.json` (the 8-shape library)
   - `design_handoff/` (the full design bundle plus all docs)

2. **Move `CLAUDE.md` to repo root.** It's currently inside `design_handoff/01-CLAUDE.md`. Claude Code looks for `CLAUDE.md` at the repo root automatically, so either copy or rename it:
   ```
   cp design_handoff/01-CLAUDE.md CLAUDE.md
   ```
   Leave the original in place in `design_handoff/` too, it's fine for it to exist in both spots.

3. **Scaffold Next.js.** Run `npx create-next-app@latest` in the repo, answer the prompts (App Router: yes, TypeScript: yes, Tailwind: your call, ESLint: yes, src directory: your call, import alias: default). Claude Code can also do this inside its first session if you prefer.

4. **Open Claude Code** (the CLI, via `claude` in your terminal) in the repo folder.

5. **Paste the opening prompt** from `design_handoff/07-opening-prompt.md` as your first message. The prompt tells Claude Code what to read, in what order, and what to do before writing any code.

6. **Review its response**, answer any questions, then say "proceed."

## What's in this package

```
polynize-build/
├── CLAUDE.md                          (copy this to repo root)
├── config/
│   └── cwu-shapes.json                (8-shape library, machine-readable)
└── design_handoff/
    ├── README.md                       (overview + read order)
    ├── STATE-OF-WORK.md                (what's done, what isn't)
    ├── HANDOFF-BRIEF.md                (the original designer handoff)
    ├── 00-architecture.md              (data contracts, state flow)
    ├── 01-CLAUDE.md                    (same as root CLAUDE.md, keep both)
    ├── 02-migration-map.md             (design file → target app location)
    ├── 03-acceptance-criteria.md       ("done" criteria per surface)
    ├── 04-gotchas.md                   (prototype fakes to replace)
    ├── 05-schema-sketches.md           (Supabase schema)
    ├── 06-shape-reconciliation.md      (5 → 8 shape mapping, critical)
    ├── 07-opening-prompt.md            (the first-session prompt)
    ├── reference/
    │   └── CWU_Design_System_v0_1.pdf  (methodology source)
    └── designs/
        ├── Polynize Homepage B.html    (entry: homepage)
        ├── Polynize Agents.html        (entry: /agents 3-phase flow)
        ├── Polynize Blueprint.html     (entry: /blueprints/[id])
        ├── Polynize Brand.html         (entry: /brand)
        ├── Polynize Links.html         (entry: /links)
        ├── Polynize Email.html         (transactional email template)
        ├── agents/phase-a.jsx          (11-question flow component)
        ├── agents/phase-b.jsx          (heat map reveal + SHAPE_LIBRARY)
        ├── agents/phase-c.jsx          (agent chat component)
        ├── blueprints/                 (5 page components + data + CSS)
        ├── directions/direction-b.jsx  (homepage component tree)
        ├── shared/tokens.css           (brand tokens, source of truth)
        ├── shared/data.js              (example business payload)
        └── uploads/CLAUDE.md           (original product brief)
```

## What Claude Code should do first

It's in `design_handoff/07-opening-prompt.md`. In short:

1. Read a specific sequence of files
2. Open the HTML prototypes in a browser and walk through them
3. Come back with: a one-paragraph summary, the four locked decisions, a proposed Phase 1 scope, and any genuine questions
4. Wait for your sign-off before writing code

## The four locked decisions

These are final, do not let Claude Code revisit them:

1. **Stack:** Next.js App Router
2. **LLM:** Minimax via OpenRouter for v1, Anthropic API as upgrade path
3. **Shape library:** All 8 CWU shapes from `config/cwu-shapes.json`
4. **Pricing:** Map from $5k, Transform from $10k, Operate from $999/mo (baseline, will refine)

## Known coming-soon items

- Refined pricing document from Marrs (baseline bands are in place, calculation logic will upgrade)
- `/console` page design (route reserved, placeholder for now)
- Real proof section data (logos, metrics, testimonial, podcast episodes)

## Good luck

Build it well.
