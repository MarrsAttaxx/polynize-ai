# Core-concept extraction from meetings — BANKED (not built), method captured

**Status (updated 2026-07-13, Marrs's call):** the in-console Fireflies extractor is **postponed**. Reason: client-data security — meeting transcripts contain client-confidential material, and piping them through the console needs a security posture we haven't designed. Until then, **Marrs runs extraction manually in an isolated Claude session** (with the Fireflies connector), producing one `.md` per concept, and **drops them into the console via the concept Import page** (each stream's Core concepts → Import a concept). Revisit as an in-console feature later (design sketch from the 2026-07-11 alignment: candidate inbox + editable editorial charter + weekly sweep, human promotion gate).

**Method version: v2 (refined after two meetings; supersedes v1 entirely).** The headline change from v1: raw transcripts are **internal by default** — founders talk in deal/sales language because that is genuinely what they discuss — so **translation is a mandatory step for every concept, every time**, not a contamination check. v2 also adds **funnel-stage tagging** and reorders the file template (core value near the top, for scanning).

**Caveat:** the ICP messaging document is **still evolving**; treat current ICP/pillar mappings in extracted concepts as provisional. A further delta is expected when it solidifies.

---

## The working method (v2)

**Core fact this version is built around:** every Fireflies transcript is internal by default. Founders and teams talk in deal language, sales language, "the buyer," "the funnel," "the pitch," because that's genuinely what they're discussing. That's not an occasional contamination to watch for, it's the starting condition of all raw material. Every step below assumes that.

### Step 1 — locate the right transcript
- `fireflies_get_transcripts` with a date range, then confirm by **title and participants**, not timestamp alone. Fireflies timestamps are **UTC**: a "this morning" Melbourne meeting can land on the wrong calendar day if you filter by date without converting.
- Always fetch the **full transcript** (`fireflies_get_transcript`); never work from a summary. The value is the exact language people used — that language becomes quotable hooks (before translation, see Step 4).

### Step 2 — raw extraction (first pass)
Not every interesting business point is a content concept. Scan specifically for:
- **Reframes** — a language shift that changes how something lands (e.g. renaming a technical capability so it stops triggering resistance).
- **Contrarian decisions** — a choice against the obvious default, with the reasoning stated out loud.
- **Reaction moments** — described client/prospect reactions (the "holy shit" moments): what actually lands, not just what's claimed.
- **Named paradoxes or tensions** — a contradiction someone articulates; names something the audience feels but hasn't worded.
- **Clean quotable lines** — flag verbatim lines even when the surrounding idea is mid-strength.

**Known trap:** the first pass skews internal (GTM strategy, partner terms, culture). Keep those — don't discard. They aren't content-viable but may become internal documentation or culture content. Losing them at this stage is a real failure mode.

### Step 3 — filter for fit (second pass)
Every raw concept must clear two filters before moving on to translation:
1. **Core value alignment** — does it embody the company's stated value (human-first, capability over dependency, structure over headcount) or work against it.
2. **ICP + pillar fit** — map against the ICP messaging document (value proposition and content guidance per Ideal Customer Profile). Does it serve a specific ICP's specific problem or pillar, or is it too generic to land anywhere. *(ICP doc still evolving — mappings provisional.)*

Failures go to an **"internal only" bucket**, not the bin. If a meeting yields zero concepts for an ICP, **flag the gap** rather than forcing a weak concept — other meetings will fill it.

**Err inclusive at this stage.** A borderline concept carries forward into translation rather than being dropped: sales-flavoured surface language is not a sign the underlying idea is weak, it usually just hasn't been translated yet. **Judge quality after translation, not before.**

### Step 4 — TRANSLATE (mandatory, every concept, every time — new in v2)
Every concept that clears Step 3 is rewritten before it becomes a file. Not conditional on how internal the raw version sounds; the raw material is internal every time.
- **Strip:** "the buyer," "sales cycle," "the funnel," "the deal," "the pitch," "discovery call," "client relationship," and any other internal sales/delivery-process language.
- **Replace with:** direct address to the ICP, framed around the value or insight *they* get, not around how the company sells or delivers it. The insight's origin (a sales moment, a client story, an internal argument) is fine; the internal framing itself cannot survive into the file.
- **The value proposition stays implicit.** The insight should carry the value on its own. If the translated content reads like it's stating a benefit or making a pitch, it has FAILED this step even if the concept is sound. Rewrite until the value is felt, not announced.

### Step 5 — tag the funnel stage (required field — new in v2)
- **Top of funnel** — pure awareness, viral-style content, podcast clips. Short, punchy, doesn't need to resolve anything.
- **Mid funnel** — hyper-specific, speaks to one ICP's particular problem directly.
- **Trust-building** — long-form, YouTube deep dives, podcasts. Room to fully unpack a paradox or contrarian position.

Some concepts genuinely work at more than one stage (a strong contrarian hook can open top-of-funnel and anchor a trust-building deep dive) — note it when true, but don't default to "works everywhere."

### Step 6 — one file per concept, fixed template (v2 order)
1. **Title**
2. **Core value of the idea** — one paragraph: the strategic/psychological value for the audience. Near the top: it's the first thing read when scanning multiple concepts.
3. **How to frame it for the viewer** — "how do we present this so it lands," not "what is the idea":
   - *Opening tension* — the objection or fear the viewer already holds.
   - *The pivot* — how the reframe answers it.
   - *Landing point* — the stance the viewer is left in (**agency lands better than reassurance**).
   - *Language to use / language to avoid* — two short explicit lists.
   - *Suggested hook* — state the objection out loud, then flip it.
4. **Who it's for** — primary ICP (+ secondary if genuinely relevant), the pillar it serves, plus the **funnel stage** from Step 5.
5. **Core concept** — prose, **translated** (Step 4), grounded with **verbatim transcript quotes** (quotes stay verbatim in the sourcing section even though the surrounding explanation is translated — internal data, so exact quoting applies).

### Step 7 — keep the schema soft
Test the template on new concepts before batch-generating. The structure has changed twice already (framing section after round one; translation + funnel-tagging after round two). Assume it keeps moving for a few more rounds.

### Open questions (unsolved)
- **ICP document not finalised** — mappings provisional; expect a further delta when the ICP messaging document solidifies.
- **Multi-ICP concepts** — primary/secondary in one file vs ICP-specific variants.
- **Living concepts vs one-off extraction** — how a concept accumulates evidence across meetings. *(Console-side, the "Update concept" flow now exists: April restructures a concept doc in place from a conversation — a manual answer to this until extraction automates.)*
- **Source traceability** — meeting name + date should become a structured field (informal/inline so far).
- **Funnel-stage overlap** — a list field vs a primary/secondary split like ICP.

---

## Reference example (extracted 2026-07-11 from the Jul 10 Founder Align — produced under v1, pre-translation-step; still a valid shape reference)

"**Work Patterns, Not Human-Agent Teams**" — Talent Champion primary / Organizational Architect secondary. Core move: "human-agent team" reads as headcount replacement and triggers resistance; "work patterns" describes **structure rather than substitution** — same technical reality, opposite reception. Sits on a real data layer (O*NET job data remapped through capability mapping) and the principle *redefine the work before you redesign it around the human*. Framing: open with the objection ("is this agent going to take someone's job?"), flip to "wrong question — what's the new pattern of work, and who's designing it?". Use: pattern, shape of work, redesign, structure. Avoid: agent joins the team, human-agent team, replace, headcount, automate.

The full example doc lives wherever Marrs drops it (the concept bank via Import); this summary is here so the shape survives.
