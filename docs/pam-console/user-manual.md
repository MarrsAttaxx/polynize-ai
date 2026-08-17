# Polynize Marketing Console (PAM) — User Manual (Master)

**The complete reference for what the console does and how to use it.** This is the *master* version: it covers every function plus the model and gotchas behind it. A simplified team-facing version will be distilled from this later (strip the "how it works" notes, keep the "how to use it").

**Status key:** ✅ shipped · 🔜 next build · 🧪 shipped, pending human test (see `testing-checklist.md`)

---

## 1. What PAM is

PAM (Polynize Agent Management) is the marketing engine: it takes an idea, shapes it into a reusable **core concept**, turns that into finished **pieces** of content, and publishes them on a schedule. The console is the cockpit; specialist agents (April for copy/voice, and later Mikey/Raph/Donnie) plug in at their stages.

**The spine (memorise this):**

> **Concept → Piece → Publish**
> A core concept feeds many pieces. Each piece is produced for one or more platforms. Finished pieces are prepared into per-channel posts, scheduled on the calendar, and pushed to the socials via Metricool.

**Streams** are brand buckets — who the content is *for*. There are five: **Polynize, Marrs, Shourov, Kristin, Julian**. Almost everything (concepts, brand voice, content series, media, pieces) is scoped to a stream.

---

## 2. Access ✅

- The console lives at **pam.polynize.ai**. Sign in with an approved team email.
- Team members see everything across all streams. (Client accounts are redirected to their own blueprint and never see the marketing console.)
- Top-left **"PAM control centre"** link is always the way home.

---

## 3. The dashboard (control centre) ✅

The landing page. Shows a card per **stream**, each with the brand's avatar. Click a stream to open its home. There's also a **Calendar** button for the publishing calendar.

---

## 4. A stream's home ✅

Opening a stream shows three zones:

**Stream setup** (top — the assets that shape everything downstream):
- **Brand voice** — the register every piece in this stream is written in.
- **Content series** — the repeatable post formats this stream makes.
- **Media library** — the reusable photos and video this stream's posts are built from. 🧪 *(new)*

**Core concepts** — the stream's concept docs, with three actions: **Develop a concept**, **Import a concept**, **Concept library**.

**In development** — one card per concept that has pieces in progress; click in to that concept's development hub.

---

## 5. Brand voice ✅

Each stream has one brand-voice document (`Stream setup → Brand voice`). Paste or edit it; April reads it whenever she interviews, synthesises a concept, or drafts a post, so everything in that stream sounds like the brand. Autosaves.

*How it works:* per-stream (not per-person), so a stream sounds consistent no matter who produces for it.

---

## 6. Concepts

A **core concept** is a living master document — a strategic idea, framed for an audience, that many pieces draw from.

- **Develop a concept** ✅ — opens an interview with **April**. Give her your idea; she draws it out and writes the concept doc. Opener: *"Give me your idea for a core concept and we can shape it into something great together."* Includes a working-framing field and a Start-over button; the interview survives a reload.
- **Import a concept** ✅ — paste a finished `.md` (e.g. one you extracted from a meeting in a separate, secure session) and it becomes a concept in the stream. A same-title import asks before overwriting.
- **Update concept** ✅ — on a concept page, tell April *what's changed* and she restructures the whole doc in place (same concept, no version history kept).
- **Concept library** ✅ — browse the concepts in *other* streams and **copy** one into yours. It's a copy, never a move — the original stays put.

*Note on meeting extraction:* pulling concepts straight from Fireflies transcripts is **postponed** for client-data security. For now, extract manually in an isolated session and use **Import**. The method is captured in `concept-extraction.md`.

---

## 7. Content Series (templates) ✅

A **content series** is a repeatable recipe: it carries the plan (format + platforms + ICP) and the production instructions, so "concept + series" is enough to make a piece. Manage them at `Stream setup → Content series`.

Each series declares: **what you bring** (inputs), **what you get** (outputs), **how it's made** (the production recipe April follows), plus an example and a lifecycle status (**active / developing / retired** — kept or killed on real performance).

There's a **built-in starter library** you can copy series from, and a series doesn't go *active* until one real piece made from it was good.

---

## 8. Producing content

From a concept's development hub, click **Create content**.

- The default path is **pick a content series** (its template carries the plan). The fallback is a **custom plan** (choose platforms, format, ICP yourself).
- This creates one **piece** per selected format. Video pieces open the **Script screen**; text/image pieces open the **Text screen**.

### 8a. Text screen (posts) ✅
- **Draft from the concept** — April writes the post copy (in the stream's brand voice). Edit freely; everything autosaves.
- **Copy post** — copy the text out.
- **Mark approved** — locks it as ready; then **Prepare posts for N channels** builds the per-channel calendar entries.
- **Media** — attach images/video from this stream's library (see §9). 🧪

### 8b. Script screen (video) ✅
- An editable **script** with an on-screen **chat** that rewrites it by command (every chat edit is one-click undoable; the editor locks while the chat is working).
- **Teleprompter** — a recording view at its own URL. Continuous scroll of the whole script;
  space starts and stops it, up/down set the speed, `+`/`-` the size, `Home` returns to the top.
  **`m` mirrors left to right and `f` flips top to bottom, independently.** A beam-splitter rig
  needs one, the other, or both depending on its geometry (a single reflection off the glass
  flips one axis; an iPad mounted the other way up in the hood adds the other, and both together
  is a 180 degree turn), so set them once by looking at the glass. Both persist **per device**,
  not per piece, because they belong to the rig: the iPad in the hood stays set and the laptop
  stays plain. In a flipped state the first line sits at the bottom of the physical screen and at
  the top through the glass, which is correct; scrolling always advances the script.
- **Media** — attach the recorded video / b-roll from this stream's library. 🧪
- *Note:* the automated **video cut / treatment middle** (Descript-orchestrated Podcast Clips, etc.) is 🔜 **the next build**. Today the script screen + teleprompter are the video tools; the finished video is added to the piece via the media library.

---

## 9. Media library 🧪 (new — D27)

Reusable photos and video per stream, at `Stream setup → Media library`.

**The model:** a media asset is a **link**, not an upload. The file lives in **Box.com** (or any host that gives a public direct link); the console stores only the link + a label. Box hosts and serves the file; Metricool fetches it by that link when the post goes out. So there's no upload limit in the console and nothing to store here — Box does the heavy lifting.

**Adding media:**
1. In **Box**, upload your file (per-file limit on this account is **5GB** — plenty for podcast video).
2. Open the file's **Share → Link Settings → copy the Direct Link** (the `/shared/static/…` one that ends in the file type — *not* the default `box.com/s/…` preview link).
3. In the console's Media library, **paste the link**, leave type on **Auto** (it detects image vs video), add an optional label, **Add**.

**Using media:** on any piece, the **media picker** shows that stream's library; click to attach. Attached media rides through **Prepare → calendar → Metricool** onto the real post. **One post = one video on its own, OR multiple images** — the picker enforces this because the platforms reject mixing media types or more than one video in a single post.

**Wrong library?** Tick the assets you want (the checkbox sits on each thumbnail, and there's a **Select all**), choose the stream from **Move to…**, and hit **Move**. Because an asset is only a link, nothing is re-uploaded and the Box file never moves. Soul IDs are unaffected: they live on the Higgsfield account and were trained on the link, which does not change. The one thing to know is that if the asset was already **attached** to a piece or calendar entry in the library you're moving it *out of*, that attachment quietly drops, since attachments resolve per stream. Move first, attach after.

**Delete** removes the reference from the library only; the Box file is untouched.

**Fast-follows (🔜, not built yet):** uploading straight from the console into Box, and auto-syncing a Box folder so files appear in the library automatically.

---

## 10. Calendar & scheduling ✅

The publishing calendar (top-level **Calendar** button, or after **Prepare posts**).

- **Prepare posts** (from an approved piece) creates one **calendar entry per channel**, with April adapting the copy to each platform's register, and copies any attached media onto each entry.
- **Views:** List, Month, Day.
- **Set a time** on an entry, then **Schedule** — it posts to Metricool at that local time.
- **Add to queue** — drops it into the next open **ideal-time slot** for that stream (per the posting schedule), instead of a time you pick.
- Each entry links out to Metricool and back to its piece.

*Timezone gotcha:* Metricool defaults brands to Madrid; the console sends each stream's own timezone (default Sydney) and the brand's Metricool timezone should match, so a 9am post doesn't land at 1am.

---

## 11. Metricool connection ✅

Publishing runs through **Metricool** (via its REST API, server-side — the console holds the credentials).

- **Connect Metricool** lists your Metricool brands and maps each **stream → Metricool brand**.
- Set each stream's **posting timezone + ideal-time slots** (these drive Add-to-queue).
- Credentials live in Vercel (added by Marrs, never pasted in chat).
- substack / newsletter aren't Metricool networks and are skipped automatically.

*Publishing model:* the console is the **hands** (makes the call, holds the creds); a future **Raph** agent could be the **brains** (proposing/rearranging the schedule) but is deferred — the console-side queue covers his near-term value.

---

## 12. Per-stream tracking ✅ / 🔜

Analytics land per stream (the loop-closing intelligence layer, "Donnie", is a **later build**). Today the per-stream structure is in place; the populated analytics dashboard is 🔜.

---

## Appendix

### The eight streams
Polynize (the company) · Marrs · Shourov · Kristin · Julian.

Patricia, Dhamiri and Avik were removed on 2026-07-28 when they left the team. Removing a stream only hides it: anything those streams owned still exists in storage and is untouched, it simply no longer appears on the dashboard and its stream pages report "unknown stream". Restoring one is a single line in `lib/marketing/streams.ts`. (The old "Team" stream was removed earlier.)

### ICP archetypes (used in the Output-plan / content-series ICP field)
Organisational Architect · High-Stakes Operator · Revenue Accelerator · Talent Champion · Service Ops Leader. *(Not final; firm up as the ICP messaging doc solidifies.)*

### Where things are stored (plain version)
- **Concepts, brand voice, content series** live in Polynize's private storage, keyed per stream.
- **Media files** live in **Box** (the console stores only the links).
- **Pieces, calendar entries** are the working records the console reads and writes.
- Nothing sensitive is ever pasted into chat; credentials go into Vercel directly.

### Non-negotiables that shape the copy
- Brand tokens are load-bearing (coral = human, amber = hybrid, mint = agent).
- User-facing copy is final and contains **no em-dashes**.
- State survives a reload at every step.

### Deeper references
- `decisions.md` — the load-bearing decision log (D1–D27).
- `production-model.md` — the concept→piece→publish model in detail.
- `testing-checklist.md` — what to verify in the running console.
- `concept-extraction.md`, `brand-voice-builder-prompt.md`, `april-skills/` — the intelligence behind April.

---

*Master reference. Keep it in sync as functions land; distil the team version from it when the feature set settles.*
