# PAM — Technical & Project Management Maturity Report

**Purpose:** A living assessment of PAM (Polynize Agent Management) measuring the delta between where the build is now and a world-class, professional-grade, agentic-first system. Track progress against this over time.

**Owner:** Marrs Coiro
**First drafted:** 2026-06-05
**Last updated:** 2026-06-05
**Status legend:** 🔴 Not started · 🟡 In progress / partial · 🟢 Done · ⏸️ Parked (with reason)

---

## How to use this document

This is the single source of truth for PAM's maturity journey. It outlives any one chat. When you start a new conversation, this doc is the warm-start handoff. Update the status markers and the "Last updated" date as items move. Each gap has: what's wrong, why it matters, and what "done" looks like — so progress is measurable, not vibes.

The north star, stated by Marrs: **PAM should be future-proof and agentic-first — agents that run, check, design, and execute updates and suggestions to keep PAM running and evolving with the business.**

The central insight of this report: **that vision cannot sit on a foundation where the only safety net is a careful person (or agent) checking in the moment.** World-class = the system *enforces* safety automatically, so that carelessness fails loudly. Every gap below is, at root, a place where "a careful person checks" needs to become "the system enforces." The agentic-first goal and the professionalization goal want the same infrastructure.

---

## The one-line headline

Everything that currently protects PAM from disaster lives in one place: the in-the-moment judgment of whoever is making the change (you, or CC). There is no automated safety net beneath that judgment. CC typechecks, builds, and runs ~41 hand-written tests before committing — real discipline — but those tests are a thin, hand-curated slice, and there is no way to know what they *don't* cover. The unknown unknowns are unguarded. Moving to world-class is mostly the single substitution of **"a careful person checks" → "the system enforces,"** applied across testing, deployment, security, documentation, and project management.

---

## Maturity scorecard (the delta at a glance)

| Dimension | Where we are | World-class target | Gap | Status |
|---|---|---|---|---|
| Functionality | Real, working, live (4 blueprints, full SoW flow) | — | Small | 🟢 |
| Automated testing | ~41 hand-tests, no enforced CI gate | Comprehensive suite, merge-blocking CI | **Large** | 🔴 |
| Environments | Production only, manual deploy sequencing | Staging → prod promotion | **Large** | 🔴 |
| Monitoring & rollback | None | Error tracking + alerting + tested rollback | **Large** | 🔴 |
| Security | Reasoned, unit-tested, no audit log / threat model | Audited, logged, threat-modeled | Medium | 🟡 |
| Documentation | Lives in chat threads + code | Architecture doc + decision log + runbooks | **Large** | 🟡 |
| Schema & migrations | Manual, per-engagement, by hand | Versioned schema + migration scripts | Medium | 🔴 |
| Project management | Runs through Marrs, in chats | Tracked backlog, written roadmap, survives handoff | Medium | 🟡 |
| Agentic-readiness | Aspirational | Eval-gated self-modification on a safe substrate | **The whole point** | 🔴 |

---

## The gaps, in priority order

### Gap 1 — No safety net beneath CC 🔴
**The big one.**

**What's missing:**
- **No staging/preview environment.** Every change auto-deploys to production. The "deploy Console first, poll Vercel, then push data" routine is a manual workaround for the absence of a staging tier where changes bake before users see them. Effectively testing in production, with careful sequencing as the only buffer.
- **No rollback procedure.** If a deploy breaks prod before a client meeting, the move ("revert the commit, redeploy") exists in principle but is not documented or practiced. Untested rollback is not rollback.
- **Test suite is small and hand-curated.** ~41 assertions for a system with four engagements, a multi-state SoW signing machine, tiered auth, and a merge engine is light. Coverage skews toward "the thing just built," with little regression coverage of *interactions between* features.
- **No error monitoring.** When something breaks for a logged-in client, discovery is "the client tells you." No Sentry-style error tracker or alerting.

**Why it matters:** This is the foundation the agentic-first vision must sit on. An agent modifying PAM with no test net, no staging, no rollback, and no monitoring is not agentic-first — it is unsupervised production edits.

**Done looks like:** A staging environment with promotion to prod; CI that blocks merge on test failure; error monitoring with alerting; a documented and *tested* rollback procedure.

---

### Gap 2 — Security is "reasoned" not "audited" 🟡
**Partial — the per-feature work has been careful; the systemic posture is unmanaged.**

**What's good:** Client-write paths (Questions, SoW fields, signing) were each gated tightly and unit-tested. The cross-tenant audit was real and confirmed no leak. Locks are server-enforced.

**What's missing:**
- **Auth is email-allowlist-in-an-env-var.** Fine for four clients; doesn't scale, and there's **no audit log** of who accessed what, when. For a system holding client commercial agreements (and reMYnd's health-adjacent context), access history can't be reconstructed after the fact.
- **No written threat model.** What is PAM defending against? Cross-tenant URL poking (covered), client editing forbidden fields (covered) — but leaked magic links, session expiry, forwarded access are unenumerated, so it's unknown which are real risks.
- **reMYnd touches mental-health context.** Its own gap register flags GDPR/residency/consent (the *client's* obligation), but PAM now stores and displays that data — worth a deliberate decision on whether PAM itself carries obligations.

**Done looks like:** An access/audit log; a written threat model enumerating risks and which are mitigated; a deliberate data-handling decision for sensitive engagements; an auth model with a path beyond env-var allowlists.

---

### Gap 3 — No durable architecture documentation or decision record 🟡
**Partial — this report begins to address it; the deeper docs don't exist yet.**

**What's missing:**
- **No architecture document.** The system's design lives in code, CC's within-session memory, and chat threads. A new engineer, a cold CC session, or Shourov going deep would have to reverse-engineer it.
- **No decision log.** Load-bearing decisions exist nowhere durable: "strict on generate, liberal on read"; the deploy-ordering rule; the CWU three-tier invariant; phase-relative readiness; why cluster_type is free-string on read but enum on generate; why the modelling fee is always NEEDS INPUT. In six months no one will remember the *why*, and someone will "helpfully" tighten the read schema and break all four blueprints.
- **No runbooks.** How to deploy, roll back, provision a client, rotate a secret — none written down.

**Why it matters:** The entire project's continuity currently depends on Marrs's memory and these chat threads. That is extraordinarily fragile.

**Done looks like:** A maintained architecture overview; a decision log (ADR-style — each entry: decision, context, why, consequences); runbooks for the common operational tasks.

---

### Gap 4 — No schema versioning or migration discipline 🔴
**What's missing:** When the schema shape changes (e.g. Shourov's Cognitive Studio export next week), existing committed blueprints get migrated **by hand, per-engagement, with CC**. No schema version field driving migrations, no migration scripts. This pain was felt four times in one session (the emulator drift, the 83-issue Newkind reconciliation) — that pain *is* the absence of migration discipline.

**Why it matters:** Every schema change is currently a manual, error-prone, multi-engagement operation. As engagements multiply, this scales badly and is a prime source of the "silent failure" class of bugs.

**Done looks like:** A versioned schema with a migration runner; changing the shape means writing one migration that runs against all engagements, not hand-editing each.

---

### Gap 5 — Known, deliberately-accrued technical debt 🟡
**These were good calls to defer — but deferred is a loan, not free.**

- **`blueprint.md` half-real across three engagements** (real JSON, stale 1.x markdown narrative). Parked for Shourov's Cognitive Studio — correct — but if that slips, the debt compounds and every blueprint carries a known-inconsistent layer. ⏸️ (waiting on Cognitive Studio)
- **The four manual emulator builds were throwaway instruments.** Right to build them; they encode the transform logic that must now be rebuilt properly in Ben. The spec exists only as "what we did those four times." ⏸️ (feeds Ben)
- **Single branch, push-straight-through.** `claude/...` tracks `origin/main`, no PR review gate, no *enforced* required checks before merge (checks run, but nothing blocks merge on failure). 🔴
- **No secret rotation discipline.** Shared `testing@polynize.io`, service-role keys, env vars — no record of last rotation or what has access to what. 🔴

**Done looks like:** Debt items either paid (Cognitive Studio lands, Ben built) or explicitly tracked with a payoff trigger; branch protection with required checks; a secrets inventory + rotation cadence.

---

### Gap 6 — Project management runs entirely through Marrs 🟡
**The PM half of the question — as real as the technical half.**

**What's missing:**
- **Single point of failure for context, prioritization, and continuity.** Every decision and CC task routes through Marrs. The "done / parked / blocked" state lives in his head and chat threads. A week away and the project doesn't advance — worse, the *why* behind decisions starts to decay.
- **No written backlog or roadmap outside chats.** "Wiring Ben, blocked on Shourov" is a plan that lives in conversation, not in a tracked system that survives a new chat, a new quarter, or a second person.
- **No pre-written definition of done / acceptance criteria.** "Done" is converged on conversationally — works at this scale, but means quality is defined after the fact.

**Done looks like:** A tracked backlog and roadmap that survive outside any chat (this report is the seed); acceptance criteria written before build, not after; context durable enough that a second person could pick up a thread.

---

## The agentic-first end state (the north star)

Marrs's goal — agents that run, check, design, and execute updates to keep PAM evolving — **runs *through* the gaps above, not around them.** The infrastructure that makes human/CC development safe is exactly the infrastructure an autonomous agent needs. Required, in rough dependency order:

1. **Staging environment + automated promotion** — an agent's change validates somewhere that isn't production before reaching clients. *(Gap 1)*
2. **Real test suite + merge-blocking CI** — "the agent's change passed" becomes enforceable, not "the agent believed it passed." *(Gap 1)*
3. **Error monitoring + alerting** — the *system* catches an agent's breakage, not a client. *(Gap 1)*
4. **Automated rollback** — a bad agentic change reverts on a signal, without a human at the keyboard. *(Gap 1)*
5. **An eval/verification harness as a first-class gate** — the agentic-specific spine. Before any agentic change is accepted, it runs a battery: do all four blueprints still render and parse? does the SoW still lock? does cross-tenant still 404? This is the ~41 tests *elevated* into the mandatory gate every autonomous change must pass. The seed exists; it must become the spine. *(builds on Gaps 1 + 4)*
6. **An audit log of agentic actions** — every agent change to PAM recorded, attributable, reversible. Both a safety mechanism and the data an agent learns from. *(Gap 2)*

> **R2-D2 automating Build Bench is exactly this pattern applied to the build pipeline — the instinct is already right.** What's missing is that the same rigor must apply to PAM modifying *itself*, and the substrate (staging, CI, monitoring, rollback, evals, audit) has to exist first.

---

## Recommended sequence (don't stop feature work to do this)

**Phase A — Make the invisible visible (cheap, high-leverage, low-risk). 🟡 In progress**
Get PAM's state out of Marrs's head and the chat threads into durable docs: this maturity report, an architecture overview, a decision log, and a tracked backlog. Low effort, de-risks everything else (new chat, new engineer, cold CC start). This is writing, not engineering — can be done now, with Claude.

**Phase B — Build the safety substrate (real engineering). 🔴**
Staging environment; CI that blocks on test failure + branch protection; error monitoring + alerting; tested rollback. This is the honest ceiling of "non-engineer + CC" — it likely wants a real engineer or a serious Shourov investment. It is the foundation the agentic vision sits on.

**Phase C — Elevate the eval harness into the spine of agentic self-modification. 🔴**
Once the substrate exists, grow the ~41 tests into a real suite and make it the gate *every* agentic change must pass. This is when "agents run, check, design and execute updates to PAM" becomes safe rather than reckless.

---

## The reframe to hold onto

The gap is **not** that what's built is bad — it's that it's built like a startup proving an idea, and the question is how to make it a system that runs a business. Those are different bars. The move between them is mostly replacing *"a careful person checks"* with *"the system enforces."* That single substitution, applied across testing, deployment, security, schema, and PM, **is the delta to world-class** — and it is the same substitution the agentic-first vision requires.

---

## Change log

| Date | Change |
|---|---|
| 2026-06-05 | Initial report drafted from technical + PM analysis. |
