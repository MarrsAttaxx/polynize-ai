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

## 3. The marketing home: the board 🧪 (D40, replaces the stream dashboard)

`/console/marketing` is now **the board**: every Narrative sitting at its gate, in gate order, with **New narrative** as the primary action. A Narrative is one idea exploited into a week of content, and it moves through five gates: **Idea → Article → Kit → Create → Ship**. One gate on screen at a time, one decision per screen, back goes back.

- **Gate 1 · Idea**: type a fresh idea or pick from the inbox, then pick the lane (**Marrs** = opinion in his own voice, **Polynize** = educational). The lane sets channels, voice and CTA downstream.
- **Gate 2 · Article**: April drafts the long form (300 to 450 words) on first view; edit it directly or give her one instruction at a time in the docked chat. The article is the source of truth for every piece cut from it, and it publishes as-is. The interview step is retired.
- **Gate 3 · Kit**: per-platform ticks, and each one now names the actual post rather than a count (D42). LinkedIn gives you the **Article**, a **Contrarian post**, a **Hard moment** (or a **Field report** on the Polynize lane), **Numbered rules**, and the **Document carousel** (off, no PDF builder yet). Instagram gives **Reels x3**, the **Carousel** and one **Image**. TikTok and YouTube carry the same three cuts. Defaults total **15 posts**, and the button says so. Confirming creates one piece per thing that has to be written, so three named LinkedIn posts are three pieces with three drafts, not one draft shown three times.
- **Gate 4 · Create**: one card per thing to make, video first because it is the long pole. Seven cards on the default kit. April is told what each one has to BE: the contrarian post gets "state the belief, then break it" and a 1,300 to 2,500 character band; the numbered rules post gets a different instruction; the video script is told there is no target duration and where on-screen text is allowed to sit.
- **Gate 5 · Ship**: the week laid out from each channel's ideal slots (two a day, morning and early afternoon, per `channel-schedule`), queued as **drafts** first. One button ships the wave: scheduled posts go live through Metricool, hand-posts are emailed to you (see §3c).

### 3b2. What the kit knows about each post 🧪 (D42)

Every tick carries the finished post's real spec, and the spec reaches April rather than sitting in a document. What that buys you:

- **Length** comes from the data, not a guess. A LinkedIn post targets 1,300 to 2,500 characters and never under 400. (That band is the overlap of two large studies that disagree with each other, so it is a hint. The 400 floor is the one thing every study agrees on.)
- **The link never goes in the body** on LinkedIn. One body link costs about 18.8% of median reach, and you cannot have a link preview and an image in the same post. It goes in the first comment.
- **Every post ships with an image.** 1080 x 1350 does double duty: it is LinkedIn's tallest legal ratio and Instagram's recommended format at once.
- **Hashtags are off** on Instagram, against common practice, on a 24 million post study measuring 31.70% fewer views on posts that carry them.
- **Captions are counted in the platform's own unit.** LinkedIn 3,000 characters, Instagram and TikTok 2,200, and YouTube's description is 5,000 **bytes**, where an emoji costs three or four.
- **What we do not know is passed on as an instruction.** April is told not to claim a target video duration (no platform publishes one), not to treat the character band as best practice, and not to repeat the "single images get 30% less reach" line, which has no dataset behind it.

*Where the numbers live:* `docs/pam-console/output-spec.md` is the research, `lib/marketing/kit.ts` is the version the code reads, and `lib/marketing/safe-area.ts` holds the vertical safe area. Change one, change the others.

### 3c. Two ways a post can ship 🧪 (D41)

Not everything goes through Metricool. Each channel in a lane has a **publish mode**:

- **Scheduled (auto)** the console pushes it to Metricool at its slot. This is everything by default.
- **Hand-post (manual)** the console prepares the post and **emails it to you to publish yourself**. The default for **Marrs + LinkedIn only**, because posting natively from the phone reaches further than posting through a scheduler.

At Gate 5 the hand-posts are marked ✋ in the week grid and the button says exactly what it will do, for example **"Ship · schedule 16, send me 3"**. If a whole wave is hand-posted, Metricool does not need to be connected at all.

**The email** arrives once per wave, not once per post, and is built to be used on a phone: the post copy sits in one grey block so a long-press selects the whole thing, the **first comment** (where the link goes) is separate, and media are plain links you can open and save to the camera roll. Nothing in that email is scheduled. Nothing goes out until you post it.

*How it works:* the mode is stamped onto each calendar entry when the wave is **planned**, so changing a lane's setting later never rewrites how an already-planned wave goes out. Entries planned before this existed are treated as scheduled, which is how they were already behaving.

The old stream dashboard is intact at **`/console/marketing/streams`** (brand voice, series, media library and concepts all still live there); parts of it will be repurposed into the gates.

## 3b. The old dashboard ✅ (now at /streams)

Shows a card per **stream**, each with the brand's avatar. Click a stream to open its home. There's also a **Calendar** button for the publishing calendar.

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
  **`f` (or the `flip` button) flips top to bottom for the beam-splitter glass.** That is the
  one axis this rig needs: the original single control had been applying the horizontal flip
  instead, which is why it never worked. Horizontal is deliberately gone rather than hidden, on
  the same principle as the rest of the strip: on set a button that does nothing useful is worse
  than a missing one. Flip persists **per device**, not per piece, because it belongs to the rig:
  the iPad in the hood stays set and the laptop stays plain. When flipped, the first line sits at
  the bottom of the physical screen and at the top through the glass, which is correct, and
  scrolling always advances the script.
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
- `decisions.md` — the load-bearing decision log (D1 to D41).
- `production-model.md` — the concept→piece→publish model in detail.
- `testing-checklist.md` — what to verify in the running console.
- `output-spec.md` — what a finished post must look like per platform (sizes, safe areas, post types).
- `concept-extraction.md`, `brand-voice-builder-prompt.md`, `april-skills/` — the intelligence behind April.

---

*Master reference. Keep it in sync as functions land; distil the team version from it when the feature set settles.*
