# START HERE — PAM

**You are working on PAM (Polynize Agent Management).** This doc is the index to everything. Read this first, then pull the specific doc you need for your task. The goal is that a reader (human or agent) with zero prior context can get oriented from here.

**Last updated:** 2026-06-05

---

## What PAM is, in three paragraphs

PAM is the system that both *runs* Polynize as a business and *is* the delivery product for clients. It manages teams of AI agents (Cognitive Work Units) across the client engagement lifecycle: **Modelling → Build → Operate**. For each engagement, PAM holds a **Blueprint** (the analysis of the client's business work, decomposed into capabilities allocated across Human / Hybrid / Agent) and, once ready, a **Statement of Works** (the commercial agreement, merged from the Blueprint, that the client signs).

The human-facing surface is the **PAM Console** — a Next.js app (the `polynize-ai` project, which also serves the public polynize.ai website), deployed on Vercel, that renders each engagement's Blueprint and SoW with role-based access (Polynize team sees/edits all; a client sees only their own engagement, read-only except two narrow write paths). The content for each engagement lives as JSON + markdown in a **per-engagement GitHub repo** — the Console reads these live on each request. **The repos are the source of truth; committing is how content changes.**

**2026-06 pivot:** PAM is becoming the **marketing engine**. Capability mapping / blueprinting is moving to **Cognitive Studio on polynize.io**, and the **Newkind, reMYnd, and Roxbury** repos were **hard-deleted** for the SOC 2 audit and off-boarding (Roxbury continues as a client outside PAM). See `decisions.md` D15. The Console home is now a three-section launcher: **Marketing** (primary), **Leads**, **Blueprinting** (legacy). The one live engagement left in PAM is **EverStock** (active build).

Historically PAM's long-term direction was **agentic-first**: agents (notably **Ben**) that ingest transcripts and write/maintain the Blueprints automatically, gated by automated checks — that work now sits with Cognitive Studio on polynize.io. See the maturity report for the honest gap.

---

## If you need X, read Y

| If you need to… | Read |
|---|---|
| Understand how PAM is built (systems, data flow, repos, the Console, the SoW system) | **`architecture.md`** |
| Understand *why* something is the way it is (before changing it) | **`decisions.md`** — load-bearing decisions; do not violate without flagging |
| Know where the project stands vs world-class, and what's being worked toward | **`maturity-report.md`** |
| Learn the vocabulary (CWU, ACTA, blueprint, motions, the named systems, the agents) | **`glossary.md`** |
| Do a common operational task (deploy, roll back, provision a client, rotate a secret) | **`runbooks.md`** *(to be written)* |

---

## The non-negotiables (read before you change anything)

These are the rules most likely to be violated by someone acting cold. Full detail in `decisions.md`:

1. **Strict on generate, liberal on read.** Two schemas. Never tighten the read/render path toward the generation gate — it breaks live blueprints. (D1)
2. **The CWU invariant.** Every team is three tiers: human lead → team-leader agent → workers. `team_leader` must exactly match an agent's name or the org chart silently drops to two tiers. (D4)
3. **Deploy Console before data** when a change touches both and the schema changed; poll the deploy to success, then push data. (D9)
4. **Client-write paths are narrow + unit-tested.** Clients are read-only except adding Questions and filling/signing their own SoW fields. Every other mutation is team-only, server-enforced. (D11)
5. **A signed SoW locks server-side; never silently overwrite one.** (D12)
6. **Never fabricate; mark inferred/provisional.** A partial-but-honest blueprint beats a complete-but-fabricated one. (D8)

---

## Working conventions

- **When you make a change, update the relevant doc in this folder in the SAME commit**, so the docs never drift from the code. A drifted doc is worse than no doc — it confidently misleads.
- **If a change would contradict a decision in `decisions.md`, stop and flag it** rather than proceeding.
- **No em-dashes in client-facing copy.**
- **Responses to Marrs: lead with the takeaway/decision, keep skimmable, detail below.** (Marrs has ADHD and works as a non-engineer — favour clarity, options + a recommendation before generating, and confirm before overwriting.)
- **The repos are the source of truth.** Content changes = commits. The Console renders live (`force-dynamic`).

---

## Current state (snapshot — keep this fresh)

- **EverStock's blueprint** is live on the 2.0 structure (active build) — the sole remaining engagement. Newkind, reMYnd, and Roxbury were hard-deleted in the 2026-06 pivot (see `decisions.md` D15).
- **The SoW flow is complete:** Blueprint→agreement merge, two-colour fields (mint=Polynize/orange=client), counters, send-to-client, DocuSign-style signing + server-enforced lock, print-to-PDF.
- **Client read-only access** is live (test emails provisioned; real client emails held back until the experience is polished). Cross-tenant access is sealed (no leak).
- **Waiting on:** Shourov's **Cognitive Studio** (the rigorous transform engine, ~next week) — the upstream dependency for wiring **Ben** (the automated transform that replaces the manual emulator builds).
- **The big known gap:** no automated safety net (staging, merge-blocking CI, monitoring, rollback). See `maturity-report.md`. This is the foundation the agentic-first vision requires.

---

## Orientation check

Before acting on any task, confirm your understanding back to Marrs: what you take PAM to be, and what the task touches. A cold session acting confidently on a half-read doc is a real risk — the check catches a misread before it becomes a bad commit.
