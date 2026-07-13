# PAM Console — Production Model (aligned 2026-07-08)

**The revised spine, aligned with Marrs in the design discussion. This supersedes the "one concept → one short-form piece" shortcut and guides the next builds. Read with `pam-console-ux-flow-v1.0.md` (the north star) and `decisions.md` D19/D20.**

---

## The spine (revised)

```
TOP (format-agnostic)        OUTPUT PLAN (the pivot)         MIDDLE (per-format)              TAIL (per output)
Idea → Interview (April)  →   select platforms + formats  →  format-specific modules      →   Schedule → Publish → Track
  → Core concept doc          + ICP (per output)             (video = shoot-once-cut-many)
```

### 1. Top — unchanged, format-agnostic
Idea → April interview → **core concept doc**. One concept, no format assumptions. Built + live.

### 2. Output plan — THE missing, load-bearing step (build next)
A screen after the concept: the owner selects **which content to make**, and that choice drives everything downstream (which middle modules run, AND how the script is written).
- **Select platforms** to post on (IG, TikTok, LinkedIn, YouTube, …).
- **Select formats**: video, image + text, short-form text, long-form text, carousel, … (the finite catalogue, from `content-format-matrix.md`).
- **Select the content pillar** per output (see "Content pillars" below) — the pillar sits inside a format and carries the predefined style/recipe.
- **ICP per output** (ideal customer persona), defaulting from the concept's "Who it is for"; can differ per output. Canonical archetype set (from the brand-voice builder): **Organisational Architect · High-Stakes Operator · Revenue Accelerator · Talent Champion · Service Ops Leader** (+ custom).
- **Next** → creates the production + drives the script.
- Users differ: most (Marrs / Shourov / Patricia via their streams) will lean non-video; **the flow must not assume video**. Marrs is the main video user.

### 3. Middle — format-specific, "shoot once, cut many" for video
- **Unit model:** a concept → **one "production"** that owns (for the video family) a **single canonical 16:9 recording** + a set of **format outputs**. Each output is a "piece" that runs its format's middle module. **Video outputs (long-form + N short-forms + b-roll + stills) share the one recording.** Text/image outputs (carousel, LinkedIn post) derive from the concept + script, not the recording.
- **Script authoring inputs (D19):** concept + selected formats + ICP + **the stream's brand voice** → the script is the **shot-list** that yields the canonical recording (all sections needed for long-form + the short-form cuts).
- **Asset-development order matters and is per-selection:** if video is selected, **do video first** — its b-roll, stills and graphics get reused for the image/carousel/text posts. Order can vary per user/selection.
- **Treatment is format-specific, NOT format-agnostic.** It lives *inside* a format's module, post-record. (Correction: an earlier note called the treatment map format-agnostic — it is not. The transcript export is generic; the treatment decisions are per-output.)
- Each output ends as a real **social post with its post copy**, not just a media file.
- **v1 scope:** the **video module** is fully wired; other formats are **selectable but "module coming"** so the step + script logic are real now without spawning dead pieces.

### 4. Tail — per output
Schedule → Publish → Track, via Metricool (D18), deferred until Raph/Donnie.

---

## Brand voice, per stream (D20)

Content in a stream must be written in **that stream's** voice. Today `getBrandVoice()` keys on the signed-in **owner email**; it must move to **per-stream** (Polynize / Marrs / Shourov / Patricia), because a concept is *for* a stream regardless of who is signed in.

- **Each stream's home** surfaces its **core docs**: a **brand voice** doc (+ **brand guidelines**). Proposed affordance: a "{Stream} brand voice" action (top-right of the stream page) → **April interviews** the owner → produces the brand-voice doc → **editable / updatable** over time.
- **Polynize stream:** source the brand voice from **polynize.ai/brand** (D6 — brand is a live dependency) if it can be pulled into the read path; otherwise bring a copy into the platform.
- **Other streams:** a bucket doc created via the April brand-voice interview. Marrs has a **master prompt** users run to create their brand voice — feed it into April's brand-voice-interview cognition (capture at build time).
- **Referenced on every content creation** in that stream: concept synthesis, the April interview register, and script authoring all read the stream's brand voice.

---

## Content pillars — the style layer (already in the plan; confirmed 2026-07-08)

Pillars were fully specified in the original spec (`ux-flow-v1.0.md` §4.7 + §5, `content-format-matrix.md`, and the `pillars` table in migration `0009`). Reaffirmed + integrated into this model:

- **A content pillar = a recurring STYLE within a format** (e.g. "Marrs Attacks", "Show and Tell", the podcast pillar). Production logic: **core concept → framing → expressed via a content pillar (which sits inside a format) → on a platform.**
- **Each pillar has a blueprint** = *which format module + which treatment sub-modules + the pillar-specific specifics/style*. The blueprint IS the pillar's production recipe.
- **The Treatment stage swaps by pillar** — the pillar's fingerprint (split-screen / b-roll / cards / layout / overlays) is what makes one short-form pillar differ from another. Build a format's middle module once; each new pillar is a light specialisation (mainly its treatment recipe).
- **Referenced on content creation** (this is the point Marrs raised): if a piece is for a specific pillar, it must follow that pillar's predefined **style and format** — especially for video (the script style + the treatment recipe come from the pillar blueprint). So the Output-plan carries the pillar, and script authoring + treatment read its blueprint.
- **Content-pillar library** (`ux-flow-v1.0.md` §4.7): a per-stream library of pillars, each blueprinted, with two states — **active** (in production) and **developing** (an idea being worked up). Demoted in the layout (config + ideation, not a daily-driver). Sits alongside the brand-voice + guidelines docs as a **stream-home core asset**. Owner adds/edits pillars here.

So a **stream home** now surfaces three core things: **brand voice · brand guidelines · content-pillar library**. And the Output-plan inputs are: platforms + format + **pillar** + ICP, all feeding script authoring, which also reads the stream's brand voice.

## The creative loop (D25, aligned 2026-07-11 — supersedes the Output-plan form as the default path)

**Pick a core concept → pick a Content Pillar Template → the console asks only for what the template can't know → queue.** A CPT is a D21 pillar made concrete: it declares *what you bring* (inputs), *what you get* (outputs: formats + platforms), *how it's made* (the production recipe agents run), plus ICP, register, an example, and a lifecycle (active/developing/retired, performance-driven). Per-stream library alongside brand voice + a built-in starter library to borrow from. Concepts are **living master documents** (multi-input, appendable, Import door for externally-extracted .md concepts). Media library is per-stream (banked). Fireflies extraction postponed (see `concept-extraction.md`).

**Next builds (agreed 2026-07-11):** 1) template library + template-driven creation + concept Import — *built 2026-07-11*; 2) living concepts — *built 2026-07-13* as **Update concept**: an April conversation ("what's changed?") on the concept page, then Apply has April restructure the WHOLE doc (woven in, not appended; same slug, no versioning; echo/length backstop so a bad rewrite never blanks a concept; runs console-side on April's key); 3) per-stream media library; 4) video templates via the video middle (Treatment/edit), starting with Podcast Clips (episode in → hook-first captioned short out); Marrs Attacks is the north-star template, after the machinery proves. (Fireflies extractor: postponed.)

**In-development grouping (2026-07-13):** the stream page's "In development" section shows **one card per core concept** (pieces grouped by `concept_ref`), drilling into a per-concept **development hub** (`concept/[slug]/develop`) that lists that concept's pieces + next moves. The concept page itself stays clean (doc + Create/Update/Delete only).

---

## Build order (REVISED 2026-07-08 — prove the spine with text first, D23)

The earlier order (below, struck) led with the video middle. Marrs approved reversing it: **text is the cheapest way to prove the shared spine** (Output-plan + approve gate + tail + data model) — all of which video needs too — without also debugging the Treatment Map. Video routing to the Script screen stays live throughout; video is de-risked, not deprioritized. See D23.

1. **Output-plan step + the output data model** (the pivot). A one-tap pre-filled confirm (platforms + formats + pillar + ICP) that spawns one piece per selected **built** output, all sharing the concept. Keyed to the `0009` `content_pieces` columns so the DB swap is clean; no separate productions table (siblings share `concept_ref`; the video family later shares `descript_project_id`). Replaces the hardcoded "Develop into a script" shortcut (D19). *(In progress.)*
2. **One text output module** — concept + script → post copy (one April LLM call), editable + approvable. This completes a full idea→published loop on the cheapest format.
3. **Tail — publishing (D24).** Two layers: **brains = Raph** (proposes/rearranges the schedule) and **hands = console** (makes the Metricool REST call, holds the creds). Three steps:
   - *Step 1 (built 2026-07-09):* per-platform captions (April adapts the approved post per channel) + the **console-owned calendar** (`calendar_entries`, grouped by date, platform marks, manual date-set, links back to the piece). Usable before Metricool is wired.
   - *Step 2 (built 2026-07-09, pending the schedule test):* console → Metricool **REST** (not MCP: headless-safe + controls payload shape, D18 update). `metricool-client.ts` (schedulePost/listBrands/bestTimes), a **Connect Metricool** screen (`/console/marketing/metricool`) that lists brands (verifies the token) and maps each **stream → Metricool brand (blogId)** stored as team config, and a per-entry **Schedule** button (`calendar/[entryId]/schedule`) that resolves stream→blogId + channel→network + date→dateTime(+`Australia/Sydney`) and posts, marking the entry `scheduled` with `external_ref`. **Gate: run the D18 schedule test** (one real post to a safe channel) before relying on it. Env: `METRICOOL_USER_TOKEN` + `METRICOOL_USER_ID` (blogIds discovered, not env).
   - *Queue (built 2026-07-09):* Metricool has no queue API, so it is **console-side** — per-stream **ideal time slots + timezone** (Connect screen) drive an **"Add to queue"** button that appends each post to the next open slot and schedules it. Plus a **time picker** on each post for manual scheduling. Timezone gotcha: Metricool defaults brands to Madrid, so set each brand's tz to Sydney to match.
   - *Step 3 — Raph: DEFERRED (maybe unneeded).* The console-side queue covers the "post at ideal times" value, so Raph the conversational scheduler is not being built now (Marrs's call, 2026-07-09); revisit only if the queue proves insufficient.
   - *Analytics* is **per-stream** (each stream = a Metricool brand), lands on the stream dashboard (Donnie); the loop back to the top is a later intelligence layer.
4. **Stream-home core assets** — per-stream **brand voice**: *done* — `getBrandVoiceForStream(stream)` reads/saves `pam/brand-voice-docs/{stream}/brand-voice.md` (bucket-or-interim); wired into concept synthesis (finalize), the interview register (converse carries `stream`), and post authoring (text-draft); editable at `stream/{stream}/brand-voice`. Deferred as planned: the April brand-voice *interview flow* (paste the `brand-voice-builder-prompt.md` output for now) + brand guidelines (link to polynize.ai/brand, D6) + a doc-per-pillar picker (library UI deferred until >3 pillars).
5. **Video middle modules** — the Treatment Map (format-specific) built against the real Descript fixture below, with Descript orchestrated (test-first per D23), then the rest of the video post-record stages.

*Prior order (superseded): 1) Output-plan; 2) stream-home assets; 3) Treatment Map; 4) tail.*

---

## Real fixture for the Treatment Map (from Descript, verified 2026-07-08)

The console has read-only Descript MCP access (server `4a742644-…`, tools `list_projects` / `get_project` / `export_transcript`).
- Project **"Polynize — Strip the AI out (long-form)"**, id `eeede795-2101-4179-8dfc-97f96d364b07`.
- Composition **"Long-form"**, id `7899c696-4882-450e-976d-e6f01665d402` (278s edited; raw `longform.mp4` is 424s).
- **Proxy for preview:** the published share `https://share.descript.com/view/ADAp0SzDeWa` (no 7GB download needed).
- **Transcript shape:** `export_transcript` returns a **document** (txt/markdown/html/rtf), **paragraph segments** with `[HH:MM:SS]` timecodes on paragraph breaks + speaker labels on change. **No per-word JSON / stable IDs → the segment anchor is TEXT** (matches the "addressed by text, not timecode" rule). ~24 paragraph segments over 4:29. Use this as the treatment-map seed fixture.

---

## Open items
- ~~Marrs's brand-voice master prompt~~ **captured** → `brand-voice-builder-prompt.md` (source for April's brand-voice interview; also defines the 5 ICP archetypes).
- The **format catalogue + pillar definitions** come from `content-format-matrix.md` (the format/style surface) + the `pillars` table (`0009`). Confirm the initial active pillars per stream at build time.
- The **polynize.ai/brand** pull mechanism for the Polynize stream's voice.
- Marrs's confirmation of the initial pillar set (e.g. Marrs Attacks, Show and Tell, podcast) and which are `active` vs `developing`.

---

*Aligned 2026-07-08. Next build: the Output-plan step (item 1).*
