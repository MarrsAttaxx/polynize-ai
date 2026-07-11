# Core-concept extraction from meetings — BANKED (not built), method captured

**Status (2026-07-11, Marrs's call):** the in-console Fireflies extractor is **postponed**. Reason: client-data security — meeting transcripts contain client-confidential material, and piping them through the console needs a security posture we haven't designed. Until then, **Marrs runs extraction manually in an isolated Claude session** (with the Fireflies connector), producing one `.md` per concept, and **drops them into the console via the concept Import page**. Revisit as an in-console feature later (the design sketch from the 2026-07-11 alignment: candidate inbox + editable editorial charter + weekly sweep, human promotion gate).

**Caveat:** the ICP archetypes referenced in extracted concepts are **not 100% confirmed yet**. Once the ICP set is locked, extracted concepts become solid.

---

## The working method (from Marrs's Claude-session agent, tested on one meeting — expect drift)

### Step 1 — locate the right transcript
- `fireflies_get_transcripts` with a date range, then confirm by **title and participants**, not timestamp alone. Fireflies timestamps are **UTC**: a "this morning" Melbourne meeting can land on the wrong calendar day if you filter by date without converting.
- Always fetch the **full transcript** (`fireflies_get_transcript`); never work from a summary. The value is the exact language people used — that language becomes the quotable hooks.

### Step 2 — raw extraction (first pass)
Not every interesting business point is a content concept. Scan specifically for:
- **Reframes** — a language shift that changes how something lands.
- **Contrarian decisions** — a choice against the obvious default, with the reasoning stated out loud.
- **Reaction moments** — described client/prospect reactions (the "holy shit" moments): what actually lands.
- **Named paradoxes or tensions** — a contradiction someone articulates; names something the audience feels but hasn't worded.
- **Clean quotable lines** — flag verbatim lines even when the surrounding idea is mid-strength.

**Known trap:** the first pass skews internal (GTM strategy, partner terms, culture). Keep those — don't discard. They aren't content-viable but may become internal documentation or culture content. Losing them at this stage is a real failure mode.

### Step 3 — brand-fit filter (second pass, do not skip)
Every raw concept must clear two filters:
1. **Core value alignment** — does it embody the company's stated value (human-first, capability over dependency, structure over headcount) or work against it.
2. **Persona + pillar fit** — map against the persona engagement matrix. Does it serve a specific persona's specific messaging pillar, or is it too generic to land anywhere.

Failures go to an **"internal only" bucket**, not the bin. And if a meeting yields zero concepts for a persona, **flag the gap** rather than forcing a weak concept — other meetings will fill it.

### Step 4 — one file per concept, fixed template
1. **Title**
2. **Who it's for** — primary persona (+ secondary if genuinely relevant), tied to the messaging pillar it serves.
3. **Core concept** — prose, grounded with **verbatim transcript quotes** (internal data, so quote exactly; no paraphrase).
4. **Core value of the idea** — one paragraph: the strategic/psychological value for the audience.
5. **How to frame it for the viewer** — distinct from the concept itself ("how do we present this so it lands"):
   - *Opening tension* — the objection/fear the viewer already holds.
   - *The pivot* — how the reframe answers it.
   - *Landing point* — the stance the viewer is left in (**agency lands better than reassurance**).
   - *Language to use / language to avoid* — two short explicit lists.
   - *Suggested hook* — state the objection out loud, then flip it.

### Step 5 — keep the schema soft
Test the template on one concept before batch-generating. The structure changed after round one (the framing section didn't exist until requested). Assume the schema keeps moving for a few rounds.

### Open questions (unsolved)
- **Multi-persona concepts** — primary/secondary in one file vs persona-specific variants.
- **Living concepts** — how a concept file accumulates evidence across multiple meetings vs staying tied to one source (connects to the "living master document" model, D25).
- **Source traceability** — meeting name + date should become a structured field (informal/inline so far).

---

## Reference example (extracted 2026-07-11 from the Jul 10 Founder Align)

"**Work Patterns, Not Human-Agent Teams**" — Talent Champion primary / Organizational Architect secondary. Core move: "human-agent team" reads as headcount replacement and triggers resistance; "work patterns" describes **structure rather than substitution** — same technical reality, opposite reception. Sits on a real data layer (O*NET job data remapped through capability mapping) and the principle *redefine the work before you redesign it around the human*. Framing: open with the objection ("is this agent going to take someone's job?"), flip to "wrong question — what's the new pattern of work, and who's designing it?". Use: pattern, shape of work, redesign, structure. Avoid: agent joins the team, human-agent team, replace, headcount, automate.

The full example doc lives wherever Marrs drops it (the concept bank via Import); this summary is here so the shape survives.
