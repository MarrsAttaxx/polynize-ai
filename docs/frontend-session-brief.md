# polynize.ai frontend — session brief (paste this to seed a fresh Claude Code session)

You are a Claude Code session working on the **public polynize.ai website and its `/agents` flow**. You have the repo root. Read this brief, then `CLAUDE.md`, then triage the immediate task below.

---

## The one thing to understand first

This repo is **two surfaces in one codebase, one deployment**:
- The **public site** (polynize.ai): `/`, `/agents`, `/blueprints/[id]`, `/brand`, `/links`, `/proposals`. **This is your surface.**
- The **PAM console** (pam.polynize.ai): everything under `app/console/` + `lib/marketing/`. **A parallel Claude Code session is actively building this. Stay out of it** unless explicitly asked.

`middleware.ts` rewrites `pam.polynize.ai/*` → `/console/*`; every other host is the public site. **One `git push` to `main` ships BOTH surfaces at once.** So: build green before you push, and know that your pushes also carry the console (and its pushes carry your site).

**Parallel-session etiquette:** the only real collision zone is **shared files** — `app/globals.css` and `app/tactile.css` (brand tokens + theming), `middleware.ts`, and `app/layout.tsx` (root layout). If you need to change one of those, flag it (Marrs can relay to the console session) so the two of you don't clobber each other. Do not edit `app/console/`, `lib/marketing/`, or `docs/pam-console/`.

---

## Required reading (in order, before writing code)

1. `CLAUDE.md` (repo root) — the build bible: locked decisions, non-negotiables, scope, anti-goals. **It is mostly about YOUR surface (the public-site rebuild from the design handoff).**
2. `design_handoff/README.md`, `design_handoff/STATE-OF-WORK.md`, `design_handoff/00-architecture.md` (data contract + state flow), `design_handoff/04-gotchas.md` (what the prototype fakes).
3. `app/globals.css` + `app/tactile.css` — the brand tokens and depth language. **Load-bearing; do not remap** (coral = human, amber = hybrid, mint = agent).

---

## Architecture facts you need

- **Next.js (App Router), TypeScript.** RSC server components + `'use client'` islands.
- **The `/agents` flow** (the heart of the public site) is a **3-phase narrative** in `app/agents/`:
  - `AgentsController.tsx` orchestrates; `PhaseA.tsx` (the 11 questions), `PhaseB.tsx` (the heat-map reveal), and Phase C (the chat with the derived agent team). Styles: `phase-a.module.css`, `phase-b.module.css`.
  - Its API routes: `app/api/session/*` (session + answers + capability-map persistence), `app/api/capability-map/generate/route.ts` (**the LLM-backed heat-map/team generation — the flow's brain**), `app/api/bottleneck/probe/route.ts`, `app/api/blueprints/*` (blueprint generation + lookup).
  - **Timing is part of the design (CLAUDE.md §4):** Phase B's one-cell-at-a-time reveal + the ~4s pause before the chat nudge pulses; Phase C's system-prompt shape conditioned on the user's answers + derived team. Do not shortcut these.
  - **State persists across reloads:** a session uuid in a cookie, writes go through the server (Supabase-backed). Reloading mid-flow must not lose state.
- **LLM layer:** `lib/llm/` behind a thin provider seam (`complete()`), default provider OpenRouter. Env: `LLM_PROVIDER`, `OPENROUTER_API_KEY`, `OPENROUTER_MODEL` (v1 uses Minimax via OpenRouter per the locked LLM decision), with `OPENAI_*` / `KIMI_*` as alternates. All LLM calls are server-side API routes; keys never reach the browser.
- **Data:** Supabase (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY`). Email: Resend. Leads: kit.com (Supabase is source of truth).
- **Diagnostics:** `app/api/diagnostics/env/route.ts` reports which env keys are present — your first stop when something "is down".

## Non-negotiables (from CLAUDE.md — do not violate)

- **Brand tokens are load-bearing.** No new design system, no remapped colours.
- **Copy is final. Do not paraphrase** user-facing text. If it feels off, flag it; don't silently rewrite.
- **No em-dashes in user-facing copy** (helper: `lib/em-dash.ts`; enforce in any LLM prompt you touch).
- **The `/agents` flow is a narrative** — preserve the Phase B animation timing and the Phase C system-prompt shape.
- Pricing is **removed** from the `/agents` flow (dormant/reversible per CLAUDE.md — don't reintroduce it without asking).

---

## Deploy + verify (same discipline as the console session)

- You're in a git worktree on a `claude/*` branch. **Commit only when Marrs asks.** End commit messages with `Co-Authored-By: Claude <noreply@anthropic.com>`.
- Before any push: `npx next build` must be green (it compiles BOTH surfaces).
- Ship to prod: `git push origin HEAD:main` (production deploys from `main`; no staging).
- Verify the deploy: `gh api repos/polynize-agentic/polynize-ai/commits/<sha>/status --jq '.state'` → `success` (poll until it resolves), or use the Vercel MCP tools.

---

## IMMEDIATE TASK (today, ahead of an afternoon meeting)

Two things, in order:

### 1. Triage "the `/agents` flow may be down" — diagnose before changing anything
Do NOT restart/redeploy/change env on a hunch. Establish what's actually broken first:
- **Is the latest prod deploy green?** `gh api repos/polynize-agentic/polynize-ai/deployments?environment=Production` → newest id → `.../deployments/{id}/statuses`. A red deploy means the site is serving an old build or erroring.
- **Reproduce it.** Open `polynize.ai/agents` in the browser preview tools; walk Phase A → B → C; watch the browser console (`read_console_messages`) and network (`read_network_requests`) for the failing request. Identify WHICH call fails: `/api/session*`, `/api/capability-map/generate`, `/api/bottleneck/probe`, or `/api/blueprints`.
- **Check runtime logs** for that route (Vercel MCP `get_runtime_logs` / `get_runtime_errors`).
- **Check env** at `/api/diagnostics/env` (or Vercel env). The most common "flow is down" causes: an expired or quota'd `OPENROUTER_API_KEY` (the capability-map generation 500s), a **paused Supabase project** (session writes fail), or a changed model id in `OPENROUTER_MODEL`.
- **Report the root cause to Marrs with the evidence** (the failing call + the log line) before applying a fix. Some fixes (rotating a key, unpausing Supabase) are Marrs's to do, not yours.

### 2. Make the agent-flow edits Marrs needs for the meeting
He'll describe these in chat. Keep the flow's narrative timing and the copy rules intact. Verify each change in the browser preview (walk the actual flow) before pushing, and confirm the prod deploy goes green.

## LATER TASK (after the meeting)

A **full website revamp** is coming. When it starts: the design authority is `design_handoff/` + Marrs directly (ask before inventing UI). Reuse the brand tokens; do not restyle with a different system. Treat it as its own phased effort — align on scope with Marrs before building.

---

## How to work with Marrs (he is a PM, not a coder)

- Explain in plain, advanced-layman terms; when he needs to do something in Vercel/Supabase/etc., spell it out step by step.
- Never paste secrets in chat — env values go into Vercel by him, not to you.
- Lead with the outcome; verify in the real running site, don't ask him to check manually.
- For anything destructive or outward-facing (deploys to prod, deleting data), confirm first.

**Start by reading `CLAUDE.md` and the design-handoff docs above, then run the `/agents` triage.**
