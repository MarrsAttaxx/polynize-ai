# PAM Console (Marketing Engine) — Phase 1: the first vertical slice

**The smallest slice that proves the whole architecture. Short-form video.**
**Version 0.1 (draft for review) · July 2026 · Internal · Owner: Marrs Coiro · Author: CC**

> Reads alongside `storage-and-agent-socket.md` (the contract) and the UX flow spec. This is the *what we build first* plan for you and the Build PM to react to.

---

## The goal

Prove the three things the whole console rests on — **cockpit/engine-room split, context-aware chat that drives the interface, and one spine stage crossing the human↔agent boundary** — on the **smallest possible surface**, with something usable on day one.

Not four screens then wiring (that defers the integration risk to the end). **One thin vertical slice** that goes through the boundary once.

The slice: **the Script screen, inside the authed console, with the context chat on it, and one real agent round-trip** (April drafts the short-form script from a concept doc → you edit → autosave), for **short-form video**, using the **existing "Strip the AI out first" concept doc** from the alpha.

---

## The test vehicle — "Strip the AI out first" (one concept → its set)

The end-to-end proof of the system is this one Polynize-brand concept producing its full derivative set from a single 4-min source video (the long-form already exists from the alpha, mid-enrichment — real content to finish, not throwaway):

| Output | Channel(s) |
|---|---|
| Long-form video (~4 min) | YouTube |
| 3× short-form video (same content, 3 hooks) | TikTok · Instagram · YouTube Shorts |
| Short-form video | LinkedIn |
| Image carousel | Instagram |
| Short-form post *(text — to confirm)* | (brand social) |
| Long-form LinkedIn post + image carousel | LinkedIn |

This is the Series One TOF+MOF set for the **Polynize brand** owner. **It is the test target, not the Phase-1 build.** Phase 1 builds only the short-form **Script screen** (one module); the full set comes online as each middle module is built, with this concept flowing through as the proof. The existing long-form is the first real piece to carry through once the medium/long-form module lands.

*(One ambiguity to confirm with Marrs: "a short-form post" — a short written/text post, vs the short-form video already listed.)*

## Why this slice (and why nothing blocks it)

- **Short-form video** is the only fully-proven middle module (alpha), and it is your lane.
- It reuses the most: the biz/00 teleprompter **design**, the autosave pattern, console auth, brand tokens, and the existing `lib/llm` OpenRouter layer.
- **No blockers:** it needs neither the provisioned Hermes agents nor your Personal Brand Voice doc to *start* — "April" runs on the console's OpenRouter layer as the interim, against the existing concept doc. Your voice doc and the real Hermes April slot in right after, behind the socket, with no rework.

---

## Scope

**In:**
1. A `content_pieces` row (owner = Marrs, format = short-form, pillar, `concept_ref` → the existing concept doc).
2. The **Script screen** inside the authed shell (`/console/marketing/piece/[id]`): agent-drafted script from the concept doc, fully editable, autosaving (owner-scoped, uuid PK, off the shared token).
3. **Teleprompter mode with its own URL** (iPad-ready): section-by-section stepping + remote advance (not scrolling), so you can do several takes per section at different tonality, then move on.
4. The **context chat** on the Script screen: interface-driving commands ("tighten this line", "give me three sharper hooks", "cut the intro") that mutate the script in place — proving chat-drives-interface.
5. One **agent round-trip**: April (interim = OpenRouter/DeepSeek) drafts the script from the concept doc, writes it back, you edit, it autosaves — proving the socket end to end.

**Out (later phases):** Treatment Map; Record / Rough cut / Refine (Descript wiring); Treatment execution / captions; the Dashboard (streams/ideas/calendar/analytics/pillars); the publish tail (Blotato) + Donnie (Windsor.ai); every non-short-form format.

---

## What we reuse vs build

| Reuse (exists) | Build (new) |
|---|---|
| biz/00 teleprompter **design** (the HTML look) | The Script screen as a React component in the authed shell |
| Autosave contract (debounced 1s + flush on blur) | `content_pieces` table + owner-scoped, uuid-keyed persistence (off the `?k=` shared token) |
| Console auth (`getCurrentUser`, team/client scope) | The context-chat panel (interface-driving commands only, this phase) |
| `lib/llm` OpenRouter layer | The "April" script-draft round-trip through the job/socket shape |
| Brand tokens / tactile design | The teleprompter's own URL + section-stepping + remote advance |

---

## The teleprompter (your explicit requirements)

- **Its own URL** for the iPad. The existing content-route pattern already serves a clean, chrome-less, standalone URL — the Script screen gets an authed editor *and* a shareable teleprompter view on its own URL.
- **Section-by-section**, not scrolling: one section shown large; advance/back controls; several takes per section before moving on.
- **Remote advance:** drive the section-stepping remotely (phone-as-remote / a big tap zone / a Bluetooth clicker). We prove the section-stepping first, then wire the remote.

---

## Data model touched this phase

Only `content_pieces` (+ `concept_docs` holding the one existing concept). `owner_id` and `descript_project_id` present from this first migration even though Descript isn't wired yet (cheap now). Everything else in the schema (treatment_rows, calendar, pillars, ideas, jobs) is defined in the decision doc but **not built** until its phase.

---

## Definition of done (Phase 1)

You can: open the console → see/start a short-form piece → land on the Script screen with an April-drafted script → edit it directly and via the chat ("tighten that", "three new hooks") → open the teleprompter on your iPad at its own URL → step through it section by section with a remote → and it all survives a reload, scoped to you.

That single slice validates the socket contract, the chat-drives-interface pattern, and the persistence shape — so every later screen (Treatment Map next) builds on proven ground.

---

## Build tickets (Phase 1) — modular, each independently shippable

Ordered so each ticket produces something visible/usable and nothing needs redesigning later.

**T1 — Data foundation.** Migration `0009_marketing_console.sql`: `content_pieces` + `concept_docs`, owner-scoped, uuid PKs, `stage_state jsonb`, `descript_project_id`. Seed the existing "Strip the AI out first" concept doc as row one.
*Done:* the tables exist; the concept doc reads back via the service client.

**T2 — The Script screen (authed).** `/console/marketing/piece/[id]`. Port the biz/00 teleprompter design to a React component inside the authed shell; render the script from the concept doc; owner-scoped autosave (debounced 1s + flush on blur) to `content_pieces.stage_state` — off the `?k=` shared token, on `getCurrentUser`.
*Done:* Marrs opens a piece, edits the script, reloads, edits survive, scoped to him.

**T3 — Teleprompter view (own URL, iPad).** A clean, chrome-less teleprompter URL for the piece; **section-by-section** display (one section large) with advance/back; then **remote advance** (phone-as-remote / big tap zone / clicker).
*Done:* Marrs opens the URL on his iPad and steps section-by-section with a remote, doing multiple takes per section.

**T4 — Context chat on the Script screen (interface-driving).** An embedded chat panel scoped to the script; interface-driving commands ("tighten this line", "three sharper hooks", "cut the intro") mutate the script in place via `lib/llm` (OpenRouter). No external agent runtime.
*Done:* a chat instruction visibly rewrites the script and autosaves.

**T5 — The April round-trip (the socket, proven once).** "April" (interim = OpenRouter/DeepSeek) drafts the short-form script from the concept doc via the `submit → job_id → status` shape, writes it back to the piece, Marrs edits, it autosaves.
*Done:* starting a piece produces an April-drafted script through the job contract; the socket is validated by one real implementation.

**T6 — LLM default repoint.** Flip the repo default from Kimi/Moonshot to OpenRouter (DeepSeek latest) in the provider abstraction; per-agent key slots.
*Done:* all model calls route through OpenRouter; no China-endpoint default.

Each is a shippable step. We build one, prove it, move on. Later phases (Treatment Map, Descript wiring, Dashboard, tail/analytics, other formats) build on this proven base.

---

## After Phase 1

Treatment Map (the key screen, once a real Descript transcript + a proxy video exist to build it against — timing comes from **Descript**, addressed by text, not whisper), then the Record→Refine Descript wiring, then the Dashboard shell, then the tail + Donnie.

---

*Draft for review. Confirm scope + the teleprompter requirements and I will turn this into the concrete build tickets.*
