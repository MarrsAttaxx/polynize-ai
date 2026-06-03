# Session report — 2026-06-03 — Stage 2 PAM Console build + Roxbury convergence

**Branch:** `claude/upbeat-mahavira-4837b2` → pushed to `origin/main` after every commit.
**Repos touched:** `polynize-agentic/polynize-ai` (Console + website) and `polynize-agentic/roxburys` (engagement data).
**End state:** both repos clean and synced. polynize-ai `HEAD = origin/main = 11d449c`. roxburys `HEAD = 6a5372e`. typecheck + `next build` clean; `npm run test:blueprint` = 41 assertions pass.

This session ran the entire Stage 2 build (Landmarks 1–17 + Amendment 1) autonomously, then handled a series of interactive triage + refinement requests, ending with the Roxbury 2.0 Blueprint fully converged onto Shourov's real capability data.

---

## 1. Stage 2 build — Landmarks 1–17 + Amendment 1 (the two-layer Blueprint)

Built the unified Capability Blueprint per `stage2-data-model.md` / `stage2-build-plan.md`. Renderer branches on `blueprint_schema_version`: `1.x` → unchanged `LegacyView`; `2.0` → new `V2View`. Commits `150bb1c` → `6ab4616` (+ `72cd950`, `1f343e2`).

- **L1 schemas/validators** (`lib/blueprint/schema-v2.ts`), **L2 loaders** (`load-v2.ts`: `loadBlueprintV2`, `deriveGapRegister`, `deriveProgressPct`), **L3 renderer branch**.
- **L4** `GET /api/blueprints/lookup` (website, Bearer `POLYNIZE_LOOKUP_KEY`). **L5** `POST /api/console/[slug]/seed`.
- **L6** capability-map heatmap, **L7** benchmarking/uplift/next-steps, **L8** glance modal, **L9** derived gap register, **L10** work-plan + 8-stage stepper, **L11** project timeline (Gantt; drag deferred), **L11.5** context export (`/export` + button), **L12** dashboard (leads/clients + pipeline + convert), **L13** team-scope inline editing + 7 write endpoints, **L14** lock/unlock (CR-gated, unlock human-only), **L15** full Ben API surface + `docs/ben-console-api.md`, **L16** Roxbury migration, **L17** end-to-end + `docs/stage2-build-report.md`.
- Added `npm run test:blueprint` (schema fixtures + derive/export harness).

## 2. Production triage (interactive)

- **Seed envelope path bug** (`3cdaf43`): Supabase stores the map BARE (`stage` at top), not enveloped. `normalizeToV05Envelope` wraps/normalizes; lookup 422s legacy rows. Verified against Carl's real row (37/50/13). `firstName` disambiguation is load-bearing.
- **Apex→www redirect** (`75bc0f2`, docs): `polynize.ai` 307s to `www`, dropping the bearer; Ben's lookup must use `www.polynize.ai`. Seed is unaffected (same-origin).
- **Lock control invisible** (`317330b`): root cause was placement in a wrap-prone header pill row, not gating. Moved to a dedicated engagement-status strip. (Marrs later exercised lock→unlock live; `lock_version` reached 1.)
- **Seed repo-create on a USER account** (`82d9cbb`): `polynize-agentic` is a personal account, so `createInOrg` 404s. Now detects account type (`getAccountType`) and uses `createForAuthenticatedUser` for users. Repo creation needs the App's **Administration: write** permission (beyond Contents) — flagged to Marrs; error path surfaces the exact GitHub status + remediation.
- **Seeded leads invisible** (`d5ad05c`): discovery was the hardcoded 4-slug `CONSOLE_CLIENTS`. Now dynamic via `listAccessibleRepoSlugs` (installation repos filtered by the `.polynize/client-config.yaml` marker); routes use `isValidConsoleSlug` (format guard) instead of an allowlist. Fallback to `CONSOLE_CLIENTS` if discovery fails. `[PERF]` flag: reads config per accessible repo; cache/registry later if the install grows.

## 3. Roxbury 2.0 convergence ("best of both")

Six-part convergence (`4c665c5`–`f0086d0`) merging good 2.0 sections with restored 1.x ones:
- **R1 readiness** (restored, top + sign-off), **R2** removed the always-open capability detail block (detail lives in the modal), **R3** unified team org-chart (3-tier CWU canonical; Roxbury 2-tier exception), **R4** reverted gap register to the 1.x add-note + status (lock-gated), **R5** restored sign-off, **R6** restored Infrastructure (Polynize|Client) / Integration / Throughput.

## 4. team_leader schema field (`cc1ebe5`)

Added optional `team.team_leader` to the v0.5 `TeamSchema` (string = an agent's name). Without it the field was stripped on parse and the org-chart stayed 2-tier. Tidied the V2View reader to the typed field. Backward-compatible.

## 5. Real Roxbury data (Shourov source) + liberal read schema (`de62433`, roxburys `b15829b`+)

- Committed the **real** `capability-map.json` + `engagement-model.json` (13 capabilities / 4 clusters / 5-6-2 allocation; team Scott → Mable (leader) → Roxy/Hammond/Baxter/Percy; three real motions).
- The real data uses Shourov's **broader vocabulary** (work_shape.type beyond the strict enum, `delta_status: "unchanged"`, free-text `shape_internal`, no pricing/hiring). Resolved with **"strict on generate, liberal on read"**: added `LenientCapabilityMapV05EnvelopeSchema` used by the Console loader + capability-map read endpoint; the website's strict `validateCapabilityMapV05` (`/api/capability-map/generate`) is **untouched**. Verified: real map VALID against lenient, still INVALID against strict (intended).

## 6. Five Roxbury changes (`c8344d2`) + weighted progress (`11d449c`)

- **#1 Phase-relative readiness:** in build/operate, readiness = the active work plan's stage progress (not a phase constant). Modelling → `computeReadiness`. `ReadinessStrip` gained optional `completionPercentOverride` + `subtextOverride` (legacy omits them).
- **#2 Timeline** (roxburys `01c1fa8`): real phasing (Agent Deploy → Training → Transform → milestone); removed fabricated Cat/Diary/lot-system.
- **#3 Section reorder:** Infrastructure/Integration/Throughput moved below the team org-chart (final order below).
- **#4 Next Steps motion order:** Training → Transform → Agent Deploy (mirrors Human→Hybrid→Agentic).
- **#5 blueprint.md refresh** (roxburys `53a00a9`): real gap register (3 non-blocking items: VIP segmentation, Transform shape, Phase-two team), sign-off, and provisional infra/integration/throughput. No em-dashes; no Cat/Diary.
- **Weighted work-plan progress** (`11d449c`): replaced `complete/8` in `deriveProgressPct` with weighted stages (`STAGE_WEIGHTS` sum 100: sprint_map 10 / cog_design 20 / cog_install 20 / internal_testing 15 / external_testing 20 / refine 8 / handoff 5 / operate 2). Active stage earns its optional `progress_pct` (new optional `SprintStage` field) or 50% default; `operate` active counts full. `recomputeDerived` delegates to it. Universal across all work plans.
- **Re-scoped Roxy work plan** (roxburys `6a5372e`): `covers_capabilities ["01"]`, title "Roxy: Triage and Routing", requirements reframed to the real role (Zendesk + Gmail → Slack, quarterly cycle). Registry entry in client-config updated to match.

---

## Roxbury 2.0 — current rendered state

Section order: **Readiness → Engagement summary → Capability map → Benchmarking → Uplift → Next steps → Team org-chart → Infrastructure → Integration → Throughput → Gap register → Work plan → Project timeline → Sign-off.**

- **Readiness: 85%** — Roxy work plan: sprint_map/cog_design/cog_install/internal_testing complete (65 weighted) + external_testing active credited full (20, `progress_pct: 100`, near-done); the remaining 15% = the refine/handoff/operate tail. Stage states honest (external_testing still `active`).
- **Org-chart: three tiers** — Scott → Mable (team leader agent) → Roxy / Hammond / Baxter / Percy.
- **Gap register:** 3 non-blocking items. **Motions:** Training / Transform / Agent Deploy. **Timeline:** Agent Deploy (in progress) → Training → Transform → first-wave-live.
- All Roxbury data (map, model, timeline, blueprint.md, work plan, config registry) consistent with the real Brisbane quarterly-auction engagement. No Cat/Diary/fortnightly remnants.

---

## Outstanding / for the next session

**Operational (Marrs / Vercel, blocking live use):**
- **`POLYNIZE_LOOKUP_KEY`** — set in the polynize-ai Vercel project (serves all three domains from one app). Seed's lookup hop 503s without it.
- **GitHub App "Administration: write"** — add it + re-approve the `polynize-agentic` installation so seed can create repos. Until then, create repos manually (`gh repo create polynize-agentic/<slug> --private`) and re-run seed (idempotent).
- **`tailor-co`** test Lead repo is **public** (manual `gh` create missed `--private`) — flip to private. Seed itself creates private.

**Live confirmations not runnable here (no prod GitHub App creds in this env):**
- End-to-end seed (create repo from Carl's row), in-browser edit→lock→423→unlock cycle, dashboard Leads + convert. All verified deterministically (schema + derive + build); confirm in the running Console.

**Deferred features (documented, not blocking):**
- Timeline drag-to-reschedule (data model supports it). `delta_summary` auto-update on re-lock. `POST /capability/[capId]/allocation` (allocation change via unlock). Pipeline birds-eye % is coarse (registry-based). Migrate Newkind/reMYnd/EverStock to 2.0 as their Modelling deep-dives happen. Ben's cognition update (separate workstream; surface is in `docs/ben-console-api.md`).
- Roxbury infra/integration/throughput sections are **provisional** (flagged in-content) for Marrs hand-tuning / eventual Ben maintenance.

**Key files for a fresh session:**
- `docs/stage2-build-report.md` (full landmark report), `docs/ben-console-api.md` (agent surface).
- Console renderer: `app/console/[slug]/blueprint/V2View.tsx` + `_components/v2/`. Loader/schema: `lib/blueprint/{load-v2,schema-v2,engagement-model-io,work-plan-io,lock-io,export-context}.ts`. Lenient vs strict capability-map schema is the key "read vs generate" split.
