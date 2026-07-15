# Podcast Clip Extraction — method + prompt (developing)

**Status (2026-07-15):** the intelligence for the first video series, **Podcast Clips**. Loop chosen by Marrs: **agent proposes strong clips → human approves → Descript assembles → enrich (captions, thumbnail) → publish** (through the calendar + Metricool tail already proven). This doc is being developed **prompt-first**: get the editorial judgment right and validated on real episodes *before* wiring Descript to execute the cuts.

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
> 3. For each kept section, find THE hook: the single most arresting line, the one that stops a scroll. This becomes the clip's first line.
> 4. Build the clip as an edit decision list: hook first, then the supporting arc in an order that plays as one coherent thought, with silences, filler, false starts, and tangents removed. Tighten hard. Target 45 to 75 seconds; allow up to 90 only if the content holds. The clip must make full sense to someone who never heard the episode, and it must end on the payoff, not a trailing aside.
> 5. Use ONLY the speaker's real words. Select and order spans; never paraphrase or invent a line. Dropping a false start inside a sentence is fine; changing what they said is not.
>
> For each proposed clip return: a working title; the theme in a phrase; one line on why it will perform; the verbatim hook line with its timecode; the EDL as an ordered list of spans to keep (each with its `[HH:MM:SS]` anchor and the verbatim text, plus a note on what is cut around it); a realistic tightened duration in seconds; a short summary of what you cut; and the platforms it suits. Never use em-dashes.

---

## Open questions (to settle with Marrs as we iterate)

- **How many candidates per episode** — a fixed top-N, or "as many as clear the bar"?
- **Hook criteria** — should this pull from the existing hook-writing skill (`april-skills/hook-writing-v1.0.md`) so "hook" means the same thing across the system?
- **EDL → Descript ops** — the exact mapping from a proposed cut list to Descript's cut/silence-removal operations (the assembly build).
- **Multi-topic overlap** — when a strong line belongs to two themes, does it seed one clip or two?
- **Test material** — the current Descript fixture is a short, already-edited explainer; a genuine raw long-form episode is needed to validate the method properly.

---

*Developing. The prompt above is a first draft; iterate it against real episode output until the proposals match what Marrs would have picked, then build the Descript assembly.*
