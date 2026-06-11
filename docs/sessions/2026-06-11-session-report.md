# Session report — 2026-06-11 — /docs onboarding set, ep00 shoot-sheet hosting, /agents pricing removal + 1→1→3 team + Day-in-Life merge, site-wide grid fix, homepage copy

**Branch:** `claude/upbeat-mahavira-4837b2` → pushed to `origin/main` after every commit.
**Repos touched:** only `polynize-agentic/polynize-ai` (Console + public website) for code. No engagement-data repo was written this session (Roxbury/EverStock were read-only via `gh`). One Supabase table (`content_shoot_sheets`) was created by Marrs out-of-band for the shoot sheet.
**End state:** all work pushed; gates green at the last code change (typecheck clean, `next build` 15/15 static, `npm run test:blueprint` 41/41). **polynize-ai `HEAD = origin/main = 558e74e`.** Every code change was deployed (Vercel success) and live-verified by curl / CSS-bundle / `gh` deployment status (CC has no prod or Supabase creds locally; Marrs does final visual eyeballs).

This session followed the 2026-06-10 compaction. It was mostly public-website + delivery polish plus durable documentation. The "strict on generate, liberal on read" invariant (D1) held; the CWU three-tier invariant (D4) was *extended to the public renderers*. One locked decision was deliberately reversed by Marrs (Blueprint pricing — see §4).

---

## 1. SoW §9.1 fee schedule → 4-row Operate lifecycle — `c6ea104`

Restructured the Statement of Works fee table (`lib/sow/template.ts` + `SowDocument.tsx`) from 3 rows to 4, matching Modelling → Build → Operate. Template-wide (all engagements render via the shared `SowDocument` + `HUMAN_FIELDS`).

- New HUMAN fields (both polynize-owned/mint, NEEDS INPUT): **`modelling_fee`** and **`operate_start_date`**.
- The Support fee row became **Operate (monthly)** — display label only; the underlying keys `support_fee` / `support_period` were **kept** so any filled data isn't orphaned.
- Modelling row carries a static **"Paid"** tag (settled pre-signing); amount stays a fillable mint field. New `.paidTag` CSS (neutral grey, distinct from the mint/amber NEEDS-INPUT badges).
- **Print fix (in scope, broader):** the print rule converted only `.needsInput` (orange) to blank underscores and *omitted* `.needsInputMint` (mint). Added `.needsInputMint` so unfilled Polynize fields print as blanks too (fixed for all mint fields).
- Counter / preserve / `seedHuman` are generic over `HUMAN_FIELDS`, so the two new fields count toward Polynize-remaining and survive regenerate automatically. "Support" stays the defined **legal** term in the Service Agreement clauses (D13) — only the fee-row + field labels moved to Operate.
- Verified on EverStock's real data (13-assertion throwaway script): seed, counter (+2), preserve all green.

## 2. ep00 shoot sheet hosted at `/content/pam/ep00` with Supabase persistence — `d0c967c`

Temporary semi-build (pre real content-system). Served Marrs's single-file HTML shoot sheet verbatim with autosave.

- **Served from a Route Handler** `app/console/content/[show]/[episode]/route.ts` (GET returns the HTML). A route handler bypasses the console layout entirely → no sign-in gate, no chrome, exact look. Reachable at `pam.polynize.ai/content/pam/ep00` via the existing middleware rewrite (`pam.* → /console/*`).
- **State API** `…/[episode]/state/route.ts` (GET load / PUT save). Persists to a new Supabase table **`content_shoot_sheets`** (`episode_id` PK = the slug `pam/ep00`, `state` jsonb, `updated_at`). Helpers in `lib/content/{shoot-sheet-store,sheets,sheet-auth}.ts`; template in `lib/content/ep00.ts`.
- **Migratable shape** stored verbatim: `{ episode_id, show, prep{date,wardrobe,location,hours}, scripts{"say.*":{text,edited}}, shots{"shotNN":{done,filename,description}}, checks{"chk.*"} }`. Migration file `supabase/migrations/0007_content_shoot_sheets.sql`.
- **Persistence baked into the served HTML**: `data-key`/`data-shot`/`data-check` attributes, debounced (1s) autosave + flush-on-blur, load-on-open, a Saved/Saving indicator by the progress counter, and a print rule expanding collapsed sections so edits show in the PDF.
- **Guard:** shared token (`?k=` or `x-sheet-token` header), env `CONTENT_SHEET_TOKEN` overridable, baked default `7b9e2f4a6c1d8035e94a7c2b5f0d6e13` so it works immediately and is never publicly writable.
- **Verified end-to-end** after Marrs created the table: live PUT→GET round-trip durable, all field types intact, unauthenticated PUT → 401, then cleaned the test row.
- **Export:** `curl -H "x-sheet-token: <token>" https://pam.polynize.ai/content/pam/ep00/state` returns the JSON blob; or `select state from content_shoot_sheets where episode_id='pam/ep00';`.

## 3. Durable `/docs` onboarding set + docs-sync standing rule — `2b5273e`, `ee83e3b`, `558e74e`

Committed the warm-start docs for any human or cold agent:
- `2b5273e` — `docs/START-HERE.md`, `docs/architecture.md`, `docs/decisions.md` (D1–D14), `docs/maturity-report.md` (all verbatim from Marrs's sources).
- `ee83e3b` — README "Understanding PAM" pointer to `docs/START-HERE.md`; and a top-of-file **PAM section in `CLAUDE.md`** stating the two standing rules: **(1)** update the relevant `docs/` file in the *same commit* as a PAM change; **(2)** if a change would contradict `docs/decisions.md`, stop and flag.
- `558e74e` — `docs/glossary.md` (closed the one dangling link from START-HERE/architecture).
- `/docs` on main now: START-HERE, architecture, decisions, maturity-report, glossary (+ pre-existing ben-console-api, stage2-build-report). Still **to-be-written:** `runbooks.md` (START-HERE marks it pending).

## 4. All pricing removed from the public /agents flow — `cb12b84`, `f2bac72`

**Reverses the CLAUDE.md "Pricing bands in the Blueprint" locked decision (Marrs-directed).** Kept reversible/dormant per Marrs's choice (display + prompts removed; data plumbing dormant).

- `cb12b84`: deleted the Blueprint "Map, Transform, Operate" Pricing section (`Pricing.tsx` + its render; page counters 04→03); removed the Phase B "Indicative pricing $5K + $399/mo" footnote; scrubbed `pricing_indicative` from the capability-map generation prompt; made `pricing_indicative` **optional** in the generation schema + read types (not required, not generated, not displayed); kept `lib/pricing.ts` + `pricing_version` stamp dormant. `CLAUDE.md` locked-decision + CC-TODO updated to record the removal and the re-enable path.
- `f2bac72`: the leverage-rationale prose *also* quoted Polynize price ("equivalent throughput for a $10,000 build + $999/mo") and renders in the Heatmap (outside the removed section) — caught only by live verification. Stripped that clause from `demo-default` and forbade Polynize-price mentions in the prompt's leverage_rationale. Kept the FTE/hiring-cost comparison (ROI, not Polynize pricing).
- Verified live: 0 pricing terms on the demo blueprint; leverage/value content intact.

## 5. CWU 1→1→3 team formation on the public blueprint + Phase B — `d609027`

Marrs flagged the Busy B map showing a flat "1 human + 4 agents" instead of 1→1→3. **Root cause: a renderer gap, not data.** The public `Team.tsx` and the Phase B reveal rendered `human_owner` + all `agents` flat and never read `team_leader`; the 3-tier org chart only existed in the PAM Console.

- Both public renderers now read `team_leader`, draw the lead as a middle tier (human → lead → workers), with a **graceful fallback to flat** if `team_leader` doesn't match an agent (D4). Headline copy unchanged.
- Exposed `team_leader?: string` on `CapabilityMapData.team` / `CapabilityMapV05.team` (the v05 adapter already passed it at runtime); set `team_leader: 'Flow'` on the demo. `phase-b.module.css` got a `.dossierBadge` for the LEAD marker. `docs/architecture.md` updated to note the public renderers now render 3-tier.
- Verified live: Busy B and the demo render 1 human → 1 LEAD → 3 workers (Busy B's stored data carried a valid `team_leader` all along; generation has required it since D4).

## 6. Phase B reveal = animation + team + Day-in-the-Life + Ready-to-build — `01eb80b`

Marrs wanted the post-questions reveal to keep its animated cell reveal + hover + the 1→1→3 team, *and* gain the blueprint's Day-in-the-Life section and a closing CTA.

- Extracted the Day-in-the-Life body (timeline + "the shift" close) into a **shared component** `app/_components/DayInLife.tsx` (+ `day-in-life.module.css`, styling copied verbatim) so the blueprint page and the flow render it identically (no drift). Blueprint `Day.tsx` now uses it (heading unchanged, page looks the same).
- `PhaseB.tsx` gained the Day section + a "Ready to build this, &lt;name&gt;?" heading/lede above the existing Book-a-call / Send-this-to-someone buttons; it fades in with the rest of the reveal.
- Softened the closing lede (per Marrs) in **both** the flow and the blueprint final CTA: "…walk you through the blueprint, sharpen the shape, and discuss the most effective way to unblock this bottleneck with an agentic team."

## 7. Drafting-grid hatch fixed site-wide (the load-bearing one) — `6b6e91c`, `8c8d99f`

Marrs asked for the console blueprint's hatch on all public pages, then reported he couldn't see it.

- `6b6e91c`: added `<DraftingGrid />` to `/brand` and `/links` (the two public pages that lacked it), content wrappers lifted with `position: relative; z-index: 1`.
- `8c8d99f` — **root-cause fix:** `tactile.css` has a global `body[data-depth="tactile"] > * { position: relative; z-index: 1 }` (specificity 0,1,1). `DraftingGrid` renders as a *direct child of body*, and its CSS-module `.grid { position: fixed }` is only (0,1,0) — so the global rule was overriding it to `position: relative`, collapsing the grid to a 0-height in-flow div. **The hatch was invisible on every public page** (homepage, /agents, /blueprints, /brand, /links). The console's `.bgPattern` is nested deeper (not a direct body child), so it was unaffected — which is exactly why it showed there but not on polynize.ai. Forced `position: fixed !important` + `z-index: 0 !important` on `.grid`. One change restored the hatch site-wide. Verified the deployed CSS chunk now contains `drafting-grid_grid__sFGME{position:fixed!important;…}`. (Hatch is intentionally faint — 5.5% mint — identical to the console.)

## 8. Homepage "How we work" section copy — `3564c3a`, `93fc9ce`

`app/page.tsx`, the Optio Capital section: eyebrow "Where we started" → "How we work" (eyebrow CSS uppercases it); heading "Every deal needed weeks of groundwork." → "A Real Customer Journey" ("Journey" in the mint accent); added a lede "This is how we mapped, modelled and rectified Optio Capitals real capability bottleneck." (`93fc9ce` lowercased "real capability" per Marrs). AJ's testimonial quote below was left untouched.

---

## Investigations with no code change

- **Roxbury SoW `signatory_name`** — Marrs asked to regenerate to seed it. Found it was **already** `"Marrs Coiro"` (set 2026-06-04, commit `1c6eb89`); the file has no `signing` block (old schema 1.0) but reads unlocked. A regenerate would be a no-op for that field. Per Marrs's choice: **skipped** (no prod write).
- **Blueprint "can't be found"** — the shared URL had a trailing `…d5c`**`a`** (37 chars, invalid UUID → 404). The correct 36-char id returns 200. Not a bug, no data loss.

## Key decisions / gotchas to remember

- **The public DraftingGrid must keep `!important` on position/z-index** (§7). It's a direct body child caught by the global `body[data-depth] > *` rule. Do not "clean up" the !important.
- **Pricing is dormant, not deleted** (§4). `lib/pricing.ts`, `pricing_version`, and the (now optional) `pricing_indicative` field remain. Re-enable path is in `CLAUDE.md`. Generation no longer emits pricing; leverage_rationale must not quote Polynize price.
- **Public blueprint vs PAM Console are two different renderers.** Team 3-tier and Day-in-the-Life are now shared/parity, but they're separate code paths — changes may need both.
- **CC verifies live by curl / CSS-bundle / gh deployment status**, not a local prod run (no Supabase/prod creds). Pattern held all session.

## Outstanding / open items

- **`runbooks.md`** — referenced by START-HERE as "to be written"; not yet provided.
- **`docs/polynize-website-visual-brand-guidelines.md`** — written in the prior session, still **untracked** (handoff artifact). Decision pending whether to commit it.
- **Old stored public blueprints** may still carry pricing text in their `leverage_rationale` (new ones are clean). Marrs **declined** a render-time scrub — accepted as-is (ephemeral per-session artifacts at unguessable URLs).
- **"Optio Capitals"** (no apostrophe) in the homepage lede was kept deliberately by Marrs (he re-supplied it without the apostrophe after I flagged it).
- **ep00 shoot sheet** is a temporary semi-build; `CONTENT_SHEET_TOKEN` is on the baked default (set the env to rotate). Adding ep01 = author its HTML, register in `lib/content/sheets.ts`, it gets its own row.

---

## Change log

| Date | Change |
|---|---|
| 2026-06-11 | Session report: SoW Operate fee, ep00 hosting, /docs set + docs-sync rule, /agents pricing removal, public 1→1→3 team, Phase B Day-in-Life merge, site-wide grid fix, homepage copy. |
