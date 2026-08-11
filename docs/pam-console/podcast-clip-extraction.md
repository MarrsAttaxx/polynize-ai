# Podcast Clip Extraction — method + prompt

> **BUILT IN THE CONSOLE 2026-08-10** at `/console/marketing/podcast`. The method below is unchanged
> and is what the build implements; what follows here is what shipped and what the build settled.
>
> **Descript has a REST API.** `descriptapi.com/v1`, personal token in `DESCRIPT_API_TOKEN`, with
> transcript export, project listing and the same natural-language agent used to prove assembly. This
> is the finding that made a full loop possible: assembly had only ever been driven through the MCP,
> which the console cannot reach from Vercel. Client is `lib/descript.ts`.
>
> **The pipeline:** add an episode, point it at its Descript project, pull the transcript (or paste
> one), April proposes ranked clips, Marrs approves, Descript cuts. Store is
> `lib/marketing/podcast-store.ts`; the proposal prompt and the assembly instruction are in
> `lib/marketing/podcast-clips.ts`.
>
> **Job states, checked and counter-intuitive:** `queued`, `running`, `stopped`, `cancelled`.
> **`stopped` does not mean success.** It means no longer running, and the outcome is in
> `result.status`. `jobOutcome` normalises this; a stopped job with no status is treated as FAILED
> because the alternative reading reports failed cuts as finished clips.
>
> **The vertical problem, and how Marrs removed it.** A 9:16 clip from a landscape source needs speaker
> tracking, and Descript's "Center active speaker" is a manual toggle. He solved it upstream instead:
> he exports from Final Cut already 16:9 with both speakers centred, so a plain centre crop keeps them
> both. That is the `pre_framed` flag on an episode, and it is an **operator declaration, not a
> detection** because a landscape frame carries no signal about whether its subjects were placed for a
> vertical crop. With it set, the assembly prompt centre-crops and forbids reframing; without it, the
> cautious speaker-tracking instruction applies and any clip the agent could not finish is flagged
> `needs_reframe` in the UI. **None of this is needed if the podcast is ever recorded 9:16 at source.**
>
> **Captions and title are a SEPARATE FINISH PASS**, re-runnable on its own. One combined prompt asking
> for the cut, the canvas, the title and the captions reported doing all four when it had not, and a
> missed caption track needs the finish run again rather than the whole clip re-cut. Per the house craft
> in `content-series-examples.md`: captions continuous top to tail, added last so they match the locked
> cut, plain white, clear of the bottom strip. The title is the clip's own title, **vertically centred,
> five seconds** (Marrs, 2026-08-10). Filler-word and gap removal are asked for as DESCRIPT'S OWN TOOLS
> by name, since describing the outcome was not landing.
>
> **Reading the agent's report is its own problem.** It is prose, and a keyword scan cannot work: the
> agent lists what it deliberately did NOT do ("plain white, no karaoke") as evidence of success, and an
> early version read that as failure and told Marrs a finished clip had no title and no captions. Only
> the leading clause after each label decides, labels are anchored to line starts (unanchored, `TITLE`
> matched "clear of the title area" in a different paragraph), and "not requested" is a third outcome
> rather than a failure.

**Status (2026-07-15):** the intelligence for the first video series, **Podcast Clips**. Loop chosen by Marrs: **agent proposes strong clips → human approves → Descript assembles → enrich (captions, thumbnail) → publish** (through the calendar + Metricool tail already proven). This doc is being developed **prompt-first**: get the editorial judgment right and validated on real episodes *before* wiring Descript to execute the cuts.

**Update (2026-07-20) — the spine is proven end to end.** The proposal prompt was run on a REAL 54-min episode (Ep02, "AI in education", Marrs + Shourov) and produced 8 ranked clips; Marrs's verdict: "on the money". The **assembly** was then proven: Descript's `prompt_project_agent` (see the Assembly section below) took clip 1's approved EDL and built a real, non-destructive clip composition, hook-first, silences removed, ending on the right line. So both halves (brain + hands) now work on real material; the remaining work is enrichment (9:16, captions, thumbnail) and productizing the loop in the console.

---

## The core principle (Marrs, from editing hundreds of clips by hand)

**A podcast clip is NOT a contiguous slice of the episode. It is a theme, condensed.**

The raw episode meanders. A clip is built by taking a *section where one topic is explored* and reworking it into something that cuts together and stands on its own:

1. **Find the hook** — the single strongest moment in that section.
2. **Move the hook to the front.**
3. **Cut the rest down hard** — remove silences, filler, false starts, and tangents — so what remains plays as one coherent thought.
4. **Target ~1 minute.** Longer only if the content genuinely earns it.
5. The finished clip must make complete sense to someone who never heard the episode.

This is editorial judgment expressed as a **cut list (EDL)**, not a timespan pick. The agent's job is to propose that cut list; a human approves; Descript executes it.

---

## The method (what the agent does)

**Step 1 — Segment by theme.** Read the whole transcript. Break it into sections, each covering one topic / idea / story. Section boundaries are where the subject changes, not fixed time windows.

**Step 2 — Judge clip-worthiness.** Keep only sections that can stand alone AND carry a strong idea: a contrarian take, a surprising stat, a vivid stakes line, a concrete story, a reframe. Discard throat-clearing, logistics, and anything that only makes sense in context. Quality over quantity — better three great clips than ten weak ones.

**Step 3 — Find the hook.** In each kept section, identify THE single most arresting line: the one that makes a scroller stop. Usually a bold claim, a number, a "here's why that's wrong", or a named tension. This becomes the clip's first line.

**Step 4 — Build the EDL (the actual editing).** Order the kept spans so the clip plays as one thought:
- **Hook first** (pulled from wherever it sits in the section).
- Then the supporting arc, tightened aggressively — drop silences, filler ("um", restarts), asides, and any sentence that doesn't serve the single idea.
- End on the payoff or the punch line, not a trailing tangent.
- Target **45–75s**; allow up to ~90s only when the content holds.

**Step 5 — Keep it real (D22).** Use ONLY the speaker's actual words. The agent SELECTS and ORDERS spans; it never paraphrases or invents a line. (Word-level tightening within a sentence, e.g. dropping a false start, is fine; putting words in their mouth is not.)

## The output contract (one object per proposed clip)

- **title** — a working title for the clip.
- **theme** — the one idea in a phrase.
- **why_strong** — one line on why it will perform.
- **hook** — the verbatim hook line + its original timecode.
- **edl** — the ordered list of spans to keep (hook first), each with its `[HH:MM:SS]` anchor + the verbatim text, and a note on what's cut around it.
- **est_duration_seconds** — realistic tightened length.
- **cuts_made** — what was removed (silences, tangents, filler) and why.
- **platforms** — TikTok / Reels / Shorts (and whether a longer cut suits YouTube).

## Assembly (proven 2026-07-20)

The approved EDL is executed by Descript's MCP `prompt_project_agent` (a natural-language project editor that itself runs on Claude models; pass `model: 'claude-opus-4.8'` for best adherence). Give it the EDL as an ordered list of verbatim spans with their timecodes and it builds the clip.

- **Non-destructive:** instruct it to create a NEW composition and leave the source composition intact. Verified: source stayed 54m21s, the clip was a separate composition.
- **It follows the cut faithfully:** it assembled the four segments in the requested order (hook first, even though the hook sits mid-episode), removed silences/filler, and ended on the exact line requested.
- **It is honest about length:** asked for ~55s from segments that were only ~32s of real speech, it refused to pad with silence or invent content and delivered a tight 32s. This is why the prompt's duration guidance above now estimates from real spoken length.
- **Cost:** ~34 Descript AI credits per clip on the account (batch of 8 ≈ 270 credits). Factor this into batch runs.
- **Watch:** `web.descript.com/{project_id}/{5-char-composition-short-id}`.
- **Reframe / captions / thumbnail** (9:16, continuous captions, first-frame thumbnail) are the next agent steps on top of the locked cut, then the piece flows into the calendar + Metricool tail.

### Learnings from the clip 1 review (2026-07-20, Marrs)

- **Aspect ratio: check the SOURCE first, and have the agent REPORT it (never assume).** Target for shorts is 9:16 vertical. If the source is already 9:16, keep it as-is: do NOT reframe or crop (fully automatable). If the source is 16:9, it must be reframed to 9:16 with SPEAKER TRACKING (follow the active speaker), not a static centre crop, which can cut the speaker out (especially in a two-person podcast). (On clip 1 the agent correctly detected the source as 16:9; Marrs had misremembered it as 9:16. The Ep02 source is 16:9.)
- **Reframe automation gap (load-bearing for productizing).** Descript's speaker-tracking reframe is the beta feature **"Center active speaker"** (AI Tools > Look Good), and it is **NOT exposed to the MCP/agent** — it is a manual toggle in the editor. So a 16:9 source clip can be fully assembled by the agent (cut, hook-first order, silences removed, captions, 9:16 canvas) EXCEPT the speaker tracking, which is a ~30 second manual toggle per clip. Implication: **9:16-source recordings are fully automatable end to end; 16:9 sources need that one manual step** (or accept a static crop). Options to weigh when productizing: record/export the podcast 9:16, accept the manual toggle as an operator step in the review screen, or revisit if Descript exposes the effect to automation.
- **Hook = the sharpest declarative line.** Marrs's pick for clip 1 was "You have to train for a skill. Schools don't train skills." over the softer soccer-field setup. Lead with the blunt claim.
- **Operator review = a readable TEXT BLOCK, not an EDL.** When clips are shown for approval, present each as: the hook labelled at the top, then the body as flowing prose in play order (the words as they will be heard). The timecoded EDL is for the assembly engine only; keep it out of the human review view.

## Execution constraints (for the later assembly build)

- **Descript is the cutting engine.** The transcript anchors are paragraph-level `[HH:MM:SS]` text spans (no per-word IDs exposed), so the EDL references text spans + timecodes; Descript maps them to the timeline, removes silences/filler, and assembles the cut. The agent proposes WHAT to cut; Descript does the cut.
- **Hard cuts only, no fades** (house style).
- **Captions are added last**, continuous, after the cut is locked.
- **First frame = the vertical thumbnail** (clean hook frame).
- Human is the final ear/eye: proposals are reviewed and edited before assembly.

---

## First-draft prompt (the thing to get right — iterate on real output)

> You are the podcast-clip editor for Polynize. You turn a long episode transcript into a set of proposed short vertical clips (TikTok / Reels / YouTube Shorts) for a human to approve. You have edited thousands of clips and you know that a great clip is not a slice of the episode: it is a single theme, condensed, opened by its strongest moment.
>
> You are given the full transcript with `[HH:MM:SS]` timecodes on each paragraph. Do this:
>
> 1. Segment the transcript into thematic sections (one topic each). Boundaries are where the subject changes.
> 2. Keep only sections that can stand alone and carry a strong idea (a contrarian take, a surprising number, a vivid stakes line, a concrete story, a reframe). Discard logistics, throat-clearing, and context-dependent chatter. Be selective: propose only genuinely strong clips, ranked strongest first.
> 3. For each kept section, find THE hook: the single most arresting line, the one that stops a scroll. Prefer a blunt, declarative claim (for example "Schools don't train skills") over a softer setup or lead-in line. This becomes the clip's first line.
> 4. Build the clip as an edit decision list: hook first, then the supporting arc in an order that plays as one coherent thought, with silences, filler, false starts, and tangents removed. Tighten hard. Never pad with silence or filler to reach a length, and never add content the speaker did not say. Estimate the finished duration from the actual spoken length of the spans you keep (roughly 2.7 words per second); strong clips commonly land between 30 and 75 seconds, and shorter-but-tight beats longer-but-padded. The clip must make full sense to someone who never heard the episode, and it must end on the payoff, not a trailing aside.
> 5. Use ONLY the speaker's real words. Select and order spans; never paraphrase or invent a line. Dropping a false start inside a sentence is fine; changing what they said is not.
>
> For each proposed clip return: a working title; the theme in a phrase; one line on why it will perform; the verbatim hook line with its timecode; the EDL as an ordered list of spans to keep (each with its `[HH:MM:SS]` anchor and the verbatim text, plus a note on what is cut around it); a realistic tightened duration in seconds; a short summary of what you cut; and the platforms it suits. Never use em-dashes.

---

## Settled by the build (2026-08-10)

- **How many candidates** — "as many as clear the bar", capped at 12 so a runaway reply cannot flood
  the review. The prompt says three great clips beat ten weak ones and to rank strongest first.
- **EDL to Descript ops** — the EDL goes to the agent as a numbered list of verbatim spans with their
  timecodes, and the agent maps them to the timeline. The proof was that it follows this faithfully,
  including taking the hook from mid-episode and placing it first.
- **Test material** — Ep06 (56m03s, 1080p) is the first episode run through the built pipeline.

Still open, and genuinely worth deciding rather than defaulting:

- **Hook criteria** — whether this should pull from `april-skills/hook-writing-v1.0.md` so "hook" means
  the same thing across the system. Currently the clip prompt carries its own definition (the blunt
  declarative line), which matches Marrs's pick on clip 1 but is a second source of truth.
- **Multi-topic overlap** — when a strong line belongs to two themes, one clip or two.
- ~~An approved clip becoming a piece~~ **BUILT 2026-08-10.** "Bring it in" renders the composition
  (`POST /jobs/publish`, 1080p, unlisted), copies the file into our own bucket, adds it to the stream's
  media library, and creates an ordinary marketing piece with the video attached. From there the existing
  calendar and Metricool tail applies with no knowledge of podcasts.

  **Why the file is copied rather than linked.** Descript's `download_url` is a signed link that
  EXPIRES, and `publish.ts` fetches media by url at PUBLISH time, which can be days after scheduling. A
  Descript url would therefore produce posts that die silently between being scheduled and going out.
  The copy is served from `/console/clip-media/{stream}/{id}`, which is unauthenticated by design
  because the thing fetching it is Metricool's server, and unguessable because the id is a uuid. The
  download is size-bounded so publishing the wrong composition (the 56-minute source) is refused rather
  than loaded into a function's memory.

  Also: episodes can be marked **DONE**, which archives them out of the list without deleting the
  clips, exclusions or Descript links that record what was published.

## Guardrails the build added, and why

- **Proposing again never destroys.** Only untouched proposals are replaced; anything approved, cut or
  rejected survives. Re-running is normal when a first pass misses a theme, and a second opinion must
  not eat a decision.
- **Paste is first-class alongside the pull.** The editorial half is the valuable half and a 56-minute
  upload takes half an hour, so clips can be proposed from a transcript in hand meanwhile.
- **A cut is polled, not awaited.** An agent job outlives its request, so the job id is persisted or a
  reload orphans a cut that is running and being paid for. A failed POLL is reported as still running,
  because marking it failed would strand a composition that exists.
- **Cutting is gated behind explicit approval**, at roughly 34 Descript credits a clip.
- **Anchor count is checked and surfaced.** A transcript with no timecodes can still be proposed from
  but cannot be cut, and saying so up front beats discovering it after eight approvals.
- **The transcript never reaches the browser.** Hundreds of kilobytes the page has no use for.
- **The hook is corrected to EDL[0]** when the two disagree, because the EDL is what gets cut and a
  review card that does not describe the clip it builds is worse than no card.
- **Review is a readable text block, never the EDL** (his instruction, and a typography decision as
  much as a data one).
