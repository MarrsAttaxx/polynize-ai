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
- **Select formats**: video, image + text, short-form text, long-form text, carousel, … (the finite catalogue).
- **ICP per output** (ideal customer persona), defaulting from the concept's "Who it is for"; can differ per output (a founder short-form vs an ops-lead LinkedIn post).
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

## Build order (CC's recommendation; Marrs deferred to CC)

1. **Output-plan step + the production/output data model** (the pivot). Video path wired; other formats selectable-but-"coming". This defines the production→outputs shape everything else hangs off.
2. **Per-stream brand voice** — stream-home core docs, April-create + edit, keyed by stream, wired into script authoring + concept synthesis. (Script authoring uses the existing brand-voice read until this lands, then upgrades to per-stream.)
3. **Per-format middle modules** — the short-form (and long-form) video module's post-record stages, starting with the **Treatment Map** (format-specific), built against the real Descript fixture below.
4. **Tail** — Metricool publish/analytics (D18), when Raph/Donnie land.

---

## Real fixture for the Treatment Map (from Descript, verified 2026-07-08)

The console has read-only Descript MCP access (server `4a742644-…`, tools `list_projects` / `get_project` / `export_transcript`).
- Project **"Polynize — Strip the AI out (long-form)"**, id `eeede795-2101-4179-8dfc-97f96d364b07`.
- Composition **"Long-form"**, id `7899c696-4882-450e-976d-e6f01665d402` (278s edited; raw `longform.mp4` is 424s).
- **Proxy for preview:** the published share `https://share.descript.com/view/ADAp0SzDeWa` (no 7GB download needed).
- **Transcript shape:** `export_transcript` returns a **document** (txt/markdown/html/rtf), **paragraph segments** with `[HH:MM:SS]` timecodes on paragraph breaks + speaker labels on change. **No per-word JSON / stable IDs → the segment anchor is TEXT** (matches the "addressed by text, not timecode" rule). ~24 paragraph segments over 4:29. Use this as the treatment-map seed fixture.

---

## Open items (capture before building)
- Marrs's **brand-voice master prompt** (seeds April's brand-voice interview).
- The **format catalogue** (from `content-format-matrix.md`) as the selectable set in the Output-plan step.
- The **polynize.ai/brand** pull mechanism for the Polynize stream's voice.

---

*Aligned 2026-07-08. Next build: the Output-plan step (item 1).*
