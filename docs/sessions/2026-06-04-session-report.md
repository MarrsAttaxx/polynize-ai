# Session report — 2026-06-04 — sprint model, gap-split + unified readiness, three 2.0 migrations

**Branch:** `claude/upbeat-mahavira-4837b2` → pushed to `origin/main` after every commit.
**Repos touched:** `polynize-agentic/polynize-ai` (Console) + three engagement-data repos (`roxburys`, `everstock`, `newkind`). reMYnd migration is queued, NOT started (see Outstanding).
**End state:** all work pushed; gates green (typecheck clean, `next build` 15/15, `npm run test:blueprint` 41/41). polynize-ai `HEAD = origin/main = 12a97f7`. Data repos: my commits are ancestors of origin (origin since advanced with Console-side RAG/gap edits by Marrs).

This session followed the 2026-06-03 compaction. It made one system-wide structural change (sprint model), two cross-cutting Console features (gap-register split, single readiness source), a schema cap raise, and migrated EverStock and Newkind to 2.0 (with Roxbury retrofitted to the new gap-split). "Strict on generate, liberal on read" held throughout: the website's `validateCapabilityMapV05` generation gate was never loosened.

---

## 1. Canonical sprint model replaced (system-wide) — `fc07ab9`

Replaced the 8-stage sprint everywhere (schema, weights, stepper, stage constants, route enum, fixtures, regression tests):

| # | stage | weight |
|---|---|---|
| 1 | sprint_map | 10 |
| 2 | cognition_design | 18 |
| 3 | **skills_design** (new) | 12 |
| 4 | cognition_install | 15 |
| 5 | **skills_install** (new) | 12 |
| 6 | **sandbox_testing** (was internal_testing) | 13 |
| 7 | **live_testing** (was external_testing) | 12 |
| 8 | handoff (now final) | 8 |

`refine` and the `operate` *stage* removed (sum = 100). `operate` survives as an engagement *phase* and work-plan *status*. `deriveProgressPct` keeps weighted complete + active partial-credit; the old operate-active full-credit special case is gone. Regression assertions reweighted (4 complete = 55, 3 = 40, half-credit = 61, handoff-active = 96).

## 2. Capability-map display — `2e4c6dd`

- **Completeness** moved to its own column rendered as a low/mid/full meter + label (STUB = Needs detail, PARTIAL = Partly mapped, COMPLETE = Fully mapped, GHOST = Ghost). Display-only; underlying values unchanged. Neutral palette on purpose (the coral/amber/mint allocation colours are load-bearing).
- **Risk** (`failure_cost`) removed from the map row; lives in the click-to-open modal only. Orphaned tag/risk CSS removed.

## 3. Gap-register split (C1) — `0dbb9ff`

Gap register now renders two groups driven by a per-row **Blocking** column: "Critical blockers" (gate sign-off) and "Gaps to resolve in build". `parseGapRegister` is header-aware (maps columns by name, falls back to legacy positions), reads the blocking flag, derives blocking/resolved counts from rows when the column exists (else the footer, for legacy). `mutate-blueprint` mirrors this so editing a gap preserves the column. Legacy tables with no Blocking column render flat, unchanged (Newkind 1.x rendered flat until its V4 refresh; legacy generally unaffected).

## 4. One readiness source + weighted Modelling calc (B + C3) — `df5e8de`

Fixed the dashboard-vs-blueprint readiness split (EverStock had shown 40 on the dashboard, 66 on the blueprint — two separate calcs). Both surfaces now read one shared module `lib/blueprint/readiness.ts`:
- **Build / Operate** → active work plan's weighted sprint progress (`deriveProgressPct`).
- **Modelling** → `0.80 × avg capability completeness (STUB .15 / PARTIAL .55 / COMPLETE 1.0) + 0.20 × (critical blockers resolved ÷ total)`. Completeness scale marked **provisional** in code (pending Ben / Cognitive Studio).

Dashboard pipeline now loads readiness live per engagement (`load-readiness.ts` → `load-clients`), replacing the coarse phase constant; the Blueprint passes the same number via `completionPercentOverride`. Legacy 1.x `computeReadiness` untouched.

## 5. Team agents cap 5 → 6 — `c4f1f5c`, `12a97f7`

`TeamSchema` (strict generation schema) agents array → `.min(2).max(6)`; lenient read schema stays unbounded. Fixture boundary assertion added (6 valid, 7 invalid, 1 invalid). Generator prompt bumped "2-5 agents" → "2-6 agents" in both places so newly generated maps can propose six. Strict generator otherwise untouched.

## 6. Lenient read schema widened for Shourov string-vocab — `c76ab17`

For EverStock (emulator/Shourov vocabulary): `evidence`, `gaps_to_close`, and `map_reflection` (scope_uncertainty / cross_cutting_candidates / decisions_deferred) accept string-or-object via union+transform, normalizing to canonical shapes. Read path only; the strict generation gate still rejects the loose vocabulary.

## 7. Roxbury — `3814baa`, `c77d45a` (roxburys)

Lead → "Scott / Jayden"; Roxy work plan covers ["01","02"] (Triage, Routing and Intake Vetting); sprint remapped to the new 8 stages at Live Testing (progress_pct 100) → **92% readiness**; timeline simplified to two phases. Then retrofitted the gap-register Blocking column (all No → 0 critical blockers, 3 in-build). Build phase, so readiness stays work-plan-driven at 92. (Marrs has since closed G01-G03 and set RAG green via the Console.)

## 8. EverStock — 2.0 migration + platform swap + 6th agent (everstock)

Migrated 1.x → 2.0 (capability-map.json + engagement-model.json + config 2.0/client/modelling), parsing via the widened lenient schema. Then: cap 03 → STUB; platform swap kit.com → **mailerlite.com** and the Survival Plan checkout → **Stripe on everstock.au**; gap register Blocking column (blockers 10/11, resolved 06/13). Later added the **6th agent Echo** (Copy & Social), Scout keeping lead/brand-brain/strategy. **Readiness 45%**, three-tier org-chart AJ Milne → Scout → Echo/Ember/Pulse/Vlad/Atlas. (RAG green via Console since.)

## 9. Newkind — 2.0 migration, V4 renames, V4 blueprint refresh (newkind)

- **Migration** (`966b7fe`): the emulator output had 83 schema failures, **all drift** (not Shourov vocabulary). Per Marrs's call, fixed the **data** to EverStock's canonical shape (zero schema widening): scope_brief object, cluster order/cluster_type, work_shape.inputs/edge_cases arrays, human_handoff canonical, scope_uncertainty array, excluded_capabilities {name,reason}, shape_internal string; engagement-model lock_state object, motions label+accent, uplift_needed enum (provisional). 14 caps / 3 clusters / 6 Agent · 6 Hybrid · 2 Human.
- **V4 renames** (`554a16a`): Scout → Don, Echo → Emily, Warden → April, Atlas (Lite) → Vlad (Lite); team_leader "Don" (exact match → three-tier). April's scope expanded.
- **V4 blueprint.md refresh** (`9ae2393`): rewrote the 5 rendered sections (Infrastructure with Master Brand Brain / Hindsight / ACTA; Integrations; Throughput; the **G1-G32 gap register** with Blocking column — 3 critical (G4/G5/G14), 4 resolved, 25 in-build; Sign-off). Removed the 6 dead 1.x sections. All Mailchimp → **MailerLite** in the data files (blueprint.md keeps two deliberate "migrated from Mailchimp" notes). **Readiness 44%**. (RAG green via Console since.)

---

## Current live state (dashboard pipeline)

Roxbury's **92** · Newkind **44** · EverStock **45** · reMYnd **0** (still 1.x, unmigrated). Verified on `www.polynize.ai/console` (live deploy serving `12a97f7`).

---

## Outstanding / for the next session

**reMYnd 2.0 migration — queued, NOT started.** Files staged in `/Users/marrscoiro/Downloads/Remynd v2 for cc/` (capability-map.json + engagement-model.json), built from EverStock's canonical template, plus a security-hardening pass bundled into Modelling. The plan:
- Verify empirically against the live schema before committing (as always).
- **One legitimate widen flagged by Marrs:** clusters use `cluster_type: "parallel"` (C2-C4 are genuinely concurrent). Roxbury/EverStock only used `sequential` / `off_cycle`. If the lenient read schema rejects `parallel`, **widen the lenient read path to accept it** (it is a real, valid value — concurrent clusters) and **deploy Console first**. Do not change the data to fit. This is the one real widen, unlike Newkind's drift.
- Set config 2.0 / client / modelling.
- Expected on confirm: 10 caps / 4 clusters / **1 Agent · 7 Hybrid · 2 Human**; three-tier org-chart **Naomi Ferstera → Joy (team leader) → Executive Assistant** (only 2 agents, so one worker — correct, single-agent beta); benchmarking / uplift / 3 motions; Modelling state (no work plan/timeline); readiness likely low-mid (9 PARTIAL / 1 STUB, no COMPLETE); Roxbury 92 / EverStock 45 / Newkind 44 unaffected.

**Provisional / deferred (documented):**
- Modelling `uplift_needed` levels for EverStock and Newkind are provisional inferences for Marrs to tune.
- Completeness scale (STUB/PARTIAL/COMPLETE → 0-1) is a provisional AI judgment until Ben / Cognitive Studio land a rigorous metric.
- EverStock/Newkind `shape_id`: EverStock has a real id; Newkind's was omitted (emulator value was not a valid CWU shape id) — assign later.
- Console deploy ordering: any schema widen (e.g. reMYnd `parallel`) must deploy before the data that depends on it. Data-only changes need no deploy.

**Key files for a fresh session:**
- Readiness: `lib/blueprint/readiness.ts` (+ `app/console/_lib/load-readiness.ts`). Gap register: `app/console/_lib/parse-blueprint.ts` (`parseGapRegister`, header-aware + Blocking) and `_components/blueprint/GapRegister.tsx` (split). Lenient vs strict capability-map schema: `lib/blueprint/schema-v2.ts` (lenient) vs `lib/agents/capability-map-schema-v05.ts` (strict generate gate, `.max(6)`).
- The 5 blueprint.md sections the 2.0 view renders: infrastructure (Polynize|Client H3 split), integrations, throughput, gap-register, sign-off. Everything else (summary, capability map, team) comes from the JSON.
