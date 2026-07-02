# PAM Console (Marketing Engine) — Storage & Agent-Socket Decision

**The load-bearing architecture decisions for the marketing console build.**
**Version 0.1 (draft for review) · July 2026 · Internal · Owner: Marrs Coiro · Author: CC**

> This is the "agent-shared-storage decision doc" the UX flow spec (§7) refers to, expanded to also settle the central-agent question and the agent socket. Nothing here is code yet; it is the contract the build follows. Reacts wanted before we start.

---

## D1 — No central agent. The console is the conductor.

**Decision:** We do **not** build a central "PAM agent." The console itself is the orchestrator; the four agents (April / Mikey / Raph / Donnie) stay as **section specialists that plug into a fixed socket** at their stages.

**Why:** The spec's own principles (cockpit/engine-room, agents as swappable plugs) already point here. A central agent would sit *between* the console and the specialists, reintroducing the monolith and bottleneck we are trying to avoid, and binding orchestration to one runtime (breaking Hermes→Agentforce agnosticism). The coordination lives in the **console**, not an agent:

- a **routing layer** (a thin LLM layer, ours) that reads the current screen and dispatches a chat request to the right specialist/tool;
- a **job queue** for the long (10-15 min) steps;
- the **shared store** (below) the specialists read/write.

**Consequence / door left open:** if we ever want fully autonomous, human-out-of-the-loop, cross-piece runs, we add a "chief of staff" agent as **another plug** — no rebuild, because the console is the socket. Starting without one costs nothing.

**Interim runtime (important):** we do **not** need all four Hermes agents provisioned to start. Text stages (e.g. script draft) run on the console's own **OpenRouter** layer as a stand-in; the real Hermes agent swaps in behind the socket when ready. Media stages (cut, generation) dispatch to the Hermes worker on Lightsail when it exists.

### The marketing team (who plugs in where)

| Agent | Role in this system |
|---|---|
| **April** | Interview / intake → concept doc; copy, language, voice. Also owns the Team re-voicing skill and the Kit.com newsletter. |
| **Mikey** | Production machinery — rough cut, Treatment Map, treatment execution, captions. Drives Descript + asset generation. |
| **Raph** | Publish — across accounts via Blotato. |
| **Donnie** | Analytics — populates the dashboard, closes the loop via Windsor.ai. |
| **Splinter** | Team lead / manager of the whole marketing team. Role in the console is **TBD** — noted for a possible future coordination slot; if one lands, he plugs in as another socket (per D1), not as a rebuild. |
| **Leo** | Leads. A **separate** lead-gen system, **not** part of this content engine. Noted for awareness only. |

---

## D2 — Two stores: Supabase (system-of-record) + the Lightsail bucket (media)

No new patterns. Everything queryable is relational in Supabase (where we already are); everything heavy is a blob in the Lightsail bucket (S3-compatible — this *is* the spec's "agent-shared storage" bucket).

The two stores map to **two distinct concerns** (confirmed with the PM):

| Concern | Where | What |
|---|---|---|
| **Console app data** (queryable) | **Supabase Postgres** | Pieces, stages, streams, ideas, calendar, pillar index, treatment rows, jobs, owner records — everything the Dashboard queries by owner/stage/date/platform. The swappable middle's per-stage payload rides in a `stage_state jsonb` column on the piece. |
| **Agent-shared state + media** (durable, outlives disposable compute) | **The Lightsail bucket** — this **is** the `polynize-agents` S3-compatible bucket, prefix-partitioned | The **concept bank** (`pam/concept-bank/{owner}/...`), **brand-voice docs** (`pam/brand-voice-docs/{owner}/...`), the **pattern/rules library** (`pam/pattern-library/...`), and heavy media — renders, generated b-roll, proxy videos, face-bank, masters (`pam/media/{owner}/{piece}/...`). Agents on the Lightsail box read/write directly; the console serves via signed URLs and keeps a lightweight **index row** in Supabase for anything it must list (e.g. a `concepts` index → `bucket_key`). |

> **Provisioned (2026-07):** the bucket exists — `polynize-agents`, region `ap-southeast-2` (Sydney), all objects private, with the folder skeleton `pam/brand-voice-docs`, `pam/concept-bank`, `pam/pattern-library`. **These are the canonical folder names** (the earlier drafts said `brand-voice` / `patterns` — the bucket is the source of truth). Still pending: the bucket access keys (into `AGENTS_S3_ACCESS_KEY_ID` / `AGENTS_S3_SECRET_ACCESS_KEY` on Vercel + the agent runtimes; bucket = `AGENTS_BUCKET`, region = `AGENTS_BUCKET_REGION`), and the **owner-key convention** under each prefix (recommended: signed-in email, to match the interim store's `marketing/{owner}/` keying). Until the keys land, concept/brand-voice bodies ride in the interim store.

**The rule:** console app data + queryable indexes are Postgres **columns**; the swappable middle is a **jsonb column**; agent-shared artifacts + media are **bucket objects, prefix-partitioned by owner**. Two concerns, two stores. State it once, hold it.

### Schema sketch (new migration, `0009_marketing_console.sql`)

```
content_pieces
  id uuid pk · owner_id text · stream text · title text
  concept_ref text · framing text · format text · pillar text
  current_stage text · status text
  descript_project_id text null          -- links a piece to its Descript project across stages
  stage_state jsonb default '{}'          -- the swappable middle payload
  scheduled_at timestamptz null
  created_at · updated_at

concepts                                              -- INDEX; the doc BODY lives in the bucket (pam/concept-bank/{owner}/)
  id uuid pk · owner_id text · concept text · framing text
  bucket_key text · status text · created_at · updated_at
  body_md text null                                   -- Phase-1 interim only (until the bucket is wired)

pillars
  id uuid pk · name text · format text · state text  -- active | developing
  blueprint jsonb                                     -- format module + treatment sub-modules + specifics
  owner_id text null                                  -- null = brand-level

ideas
  id uuid pk · owner_id text · stream text · title text · notes text · status text · created_at

treatment_rows                                        -- Treatment Map (later phase; defined now)
  id uuid pk · piece_id uuid fk · ord int
  segment_anchor text                                 -- stable transcript-text anchor (NOT a timecode)
  line_text text · treatment jsonb · broll_concept text · updated_at

calendar_entries
  id uuid pk · piece_id uuid fk · owner_id text · channel text
  scheduled_at timestamptz · status text              -- draft | scheduled | published
  variant jsonb null                                  -- per-channel mechanical variant (crop/caption/register)
  external_ref text null                              -- Blotato post id

jobs                                                  -- the agent socket's async backbone
  id uuid pk · piece_id uuid fk · stage text · agent text
  status text                                         -- queued | running | done | failed
  input_ref text · output_ref text · error text · created_at · updated_at
```

**`owner_id` is non-null on every content row from day one** (see D4). The **concept bank, brand-voice docs, and pattern library live in the bucket** (agent-shared, durable, outlives compute); Supabase holds only the queryable **index** (`concepts.bucket_key`). **Phase-1 interim:** until the bucket is wired, the concept body sits in `concepts.body_md`, and the piece store uses the existing `content_shoot_sheets` table so the Script screen works **without waiting on this migration being applied** (see the Phase-1 plan). Both swap to the bucket / `content_pieces` when provisioned — one store module, no screen rework.

### D2.1 — A piece is the production unit; a channel is a publish unit

Per the Content Format Matrix (`content-format-matrix.md`), one production fans out to many channels — a single short-form master becomes the IG Reel + TikTok + YouTube Short + LinkedIn video. So:

- **`content_pieces` = one row per (owner, concept, framing, format, pillar)** — the production unit. The swappable middle runs *once* here.
- **`calendar_entries` = one row per (piece × channel)** — the publish unit. Per-channel mechanical variants (aspect-ratio crop, caption, register tweak) hang off `variant jsonb` here; they are re-frames, **not** re-productions.
- **Pillar drives channel + register, not just format.** "Short-form video" on TikTok as *Marrs Attacks* is a *different production* (different concept, sharper register) from "short-form video" on YouTube as the thesis. So the Format-variations list is filtered by owner → channel and shaped by pillar.

The matrix's **format catalogue** (channel-agnostic) is the registry of swappable-middle modules; its **containment rule** (only built modules are selectable) is the gate. Short-form video is the only proven module today.

---

## D3 — The agent socket is a narrow async job contract

Not a rich per-agent API. Every agent — Hermes, the interim OpenRouter stand-in, or a future Agentforce agent — satisfies the same shape:

```
submit(job_type, input_ref)  -> { job_id }
status(job_id)               -> { status, output_ref, error }
```

- The console writes a `jobs` row and dispatches. The worker reads its input (a Supabase row or a bucket object), does the work, writes the output (bucket object or DB row), and updates the job. The console polls the `jobs` table and surfaces completion on the piece + the in-development list, so a refresh or a navigate-away always shows truth.
- **Chat splits into two capabilities:**
  - **Interface-driving commands** ("tighten this line", "split that row", "reorder") = console-side LLM **tool-calls that mutate the DB directly**. These work today with no agent runtime — this is how we prove "chat drives the interface" in Phase 1.
  - **Production commands** ("generate the b-roll", "run the rough cut") = **enqueue a job** to a worker. Deferred until the worker exists.
- Model the **first** plug concretely (April drafting a script) before generalising, so the abstraction is validated by a real implementation instead of designed against nothing.

> **Expanded into a full spec:** `agent-socket-contract.md` details the two capabilities (sync `converse` for the interview + script-chat; async jobs for productions), the `AgentProvider` seam, the job lifecycle, the job types (`concept_finalize`, `script_draft`), and the pull-vs-push worker wiring. Per D16, April's **concept interview now runs in-console** (the intake screen, top of the spine) — the console hosts the interview via its own context-chat and calls April through this socket; the interview produces `core-concept-{framing}.md` into `pam/concept-bank/{owner}/`.

---

## D4 — `owner_id` and streams from day one (session continuity, not permissions)

**Decision:** every content row carries `owner_id`/stream from the first migration. No permissions UI, no RLS policies yet.

**Why:** you asked to find your sessions where you left them, and to keep your work separate from Shourov's as the team grows. That is a **data-model** decision (an owner column), not a permissions feature — and it is near-impossible to retrofit once concept docs, pieces, and bucket paths exist without an owner dimension. Cheap now, expensive later. Team users can still read across owners in v1; isolation later becomes a policy flip, not a migration.

**Threaded from ticket one (confirmed with the PM), in all three places:**
- **Data model** — `owner_id` non-null on every table (`0009`), resolved from `getCurrentUser()`.
- **Agent context / socket** — the job contract's input carries `owner`, so April writes to *that owner's* concept-bank prefix and reads *that owner's* brand-voice doc.
- **Bucket paths** — every prefix is owner-partitioned (`pam/{kind}/{owner}/...`).

Build Marrs-first, multi-tenant by design. **Do NOT build the team-admin / permissions layer yet.**

---

## D5 — LLM via OpenRouter; per-agent keys; DeepSeek default

**Decision:** all model calls route through **OpenRouter** so we pick the model programmatically. Default base model **DeepSeek (latest)**; each agent gets its own API key. Repoint the repo default off Kimi/Moonshot (the provider abstraction in `lib/llm/` already supports this — a small change). Data residency is a non-issue (internal marketing data).

---

## D6 — Brand is a live dependency; add the b-roll master prompt to it

Agents read `polynize.ai/brand` fresh before each job. The machine-readable mechanism already exists (the `#brand-tokens` JSON block + `lib/brand/tokens.ts`). **Add a `brollMasterPrompt` field** (the hyperreal Stälenhag / teal-amber / "slightly satirical" tonal constant, per spec §5.4.1) into the brand tokens so the "combine master + per-clip" step has a real source — today it resolves to nothing.

---

## Deferred / not prioritised

- **Security & compliance** — deprioritised per Marrs (marketing data, not sensitive). The one survivor is `owner_id` (D4), which is continuity, not security.
- **Team-admin / permissions UI** — later.
- **Concept-doc git-style versioning** — later if needed.

---

## Open items to confirm

1. Bucket details: ~~name~~ **done** (`polynize-agents`, `ap-southeast-2`, private, folders `pam/{brand-voice-docs,concept-bank,pattern-library}`). **Still pending:** the bucket access keys (into env), and the owner-key convention (email vs slug).
2. Per-agent OpenRouter keys (one per April/Mikey/Raph/Donnie) — naming/provisioning.
3. Confirm Blotato is the sole publish authz surface (Raph plugs into it) and Windsor.ai is the analytics source (Donnie).
4. Personal Brand Voice docs live in the **private** store (Supabase/bucket), NOT the public `polynize-ai` repo (they contain personal content).

---

*Draft for review. Once confirmed, D1-D6 become the contract the Phase-1 build follows, and this doc moves into the durable decision log.*
