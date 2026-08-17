# The content quality formula

**Written 2026-08-12**, after Marrs: *"I'm generating split-screen scripts from the core concept of capability mapping and they're really bad. The hooks are bad and the beats aren't great so something's not working there."*

This is the document to argue with. It states the formula, what was actually wrong, what changed, and what is still missing.

---

## The formula

Every piece of content is one function call:

```
piece = write(concept, brand_voice, template_recipe, angle, format)
```

with four hard rules that were already right and have not changed:

- **The concept is the only source of truth.** No fact, name, number or story may come from anywhere else.
- **The recipe governs structure.** Its beats, in its order, with its own ending.
- **The brand voice governs sound**, and overrides the default Polynize register.
- **The angle governs emphasis.** It selects and orders what matters; it cannot add facts.

The output quality is bounded by the *worst* of the four inputs, and there was no term in the function for **what good looks like**. That was Marrs's own diagnosis and it was correct.

---

## What was actually wrong

Three findings, all from reading the code rather than guessing.

### 1. The prompt kept every rule about quality and threw away every example of it

`lib/marketing/hook-guidance.ts` was an eight-bullet distillation of the two canonical skill docs, compressed under D26 to avoid "bloating" the system prompt. The compression kept the rules and discarded **the entire seven-pattern library and every worked example**.

That is exactly the wrong half to drop. Rules are compressible; examples are not. *"Be concrete, not abstract"* is an adjective a model agrees with and then writes abstractly anyway. *"CONTRARIAN REFRAME: state the common belief, then break it. 'Everyone starts their AI project by picking a tool. That is exactly why most of them fail.'"* is something it can imitate.

The canonical doc predicted this failure **by name**. Its opening line: *"A hook like 'This is why capability mapping matters' is dead on arrival."* Capability mapping is the concept that was producing bad scripts.

**Fixed.** The prompt now carries all seven patterns with their model lines, the paired text/verbal hook example, the three real failed hooks with their rewrites, and the eight-point gate.

### 2. The concept doc captured the argument and none of the ammunition

The seven sections were Framing, Core thesis, Who it is for, Key beats, Proof or story, Where it lands, Source voice. Every one of them is **explanatory**. The only concrete slot was "Proof or story", and the authoring prompt explicitly permitted it to be empty.

Meanwhile the script prompt forbids inventing specifics. So:

> thin concept → nothing concrete to point at → prompt forbids invention → generic hook

The system was working exactly as designed, and the design was starved. **This is the root cause**, and it is why better prompt wording alone would not have fixed it.

**Fixed.** Four sections added, and the interview now refuses to finalise without chasing them:

| Section | Why it exists |
|---|---|
| **What they believe instead** | The wrong belief, as a sentence the audience would nod along to. Fuel for the contrarian reframe, which the doc calls the signature move. |
| **Concrete specifics** | A required list of numbers, named moments, mistakes, images. Named in the prompt as *the entire budget of hard material* every downstream hook has. |
| **What it costs them** | The stakes. A curiosity gap needs them. |
| **Lines worth keeping** | Verbatim phrasing from his own mouth. Paraphrase is where the edge gets sanded off. |

### 3. A one-line loophole that licensed vagueness

Both prompts ended the hook instruction with *"If the concept holds no such number or proof, do not manufacture one."* Correct about fabrication, but it reads as permission to retreat to a general statement, which is the failure he actually got.

**Fixed.** It now says: pick a pattern that does not need a number (contrarian reframe from the wrong belief, provocative image, reframe by analogy, costly-mistake from the stakes), and **a vague hook fails with the same consequence as an invented one, so it is not the safe option.**

---

## What good looks like: the new term in the function

The missing term, added as `lib/marketing/exemplars.ts`.

Mark a piece **"This one is good"** on the script or text screen, with an optional one-line note on *why*. That piece becomes a worked example in every later draft for the same stream and format.

Three deliberate choices:

1. **Good is what Marrs blesses**, not anyone's opinion of good, and not an imported "industry standard" that has never been tested against this audience.
2. **It works from the first piece.** The analytics loop cannot start until things have been posted and measured; better scripts are needed this week.
3. **The analytics loop plugs into the same flag.** A post that actually performs should set `exemplar` automatically. One definition of good, two sources of evidence: taste now, measured traction later. Nothing in `exemplars.ts` changes for that, only the thing that sets the flag.

The real hazard of few-shot prompting is the model copying **material** instead of **craft**. Shown a good script about capability mapping it will cheerfully write another one about capability mapping when the brief was something else. So the block restates the concept's primacy immediately after the examples and gives the model a self-test: *if you find yourself writing a line that would fit the example as well as it fits this concept, you have copied instead of learned.*

---

## Brand voice

Voice docs are freeform Markdown, so what they contain varies, and the difference between a weak one and a strong one is the same difference as in finding 1: **adjectives versus real sentences.**

Two changes:

- **The injection now says how to use the doc.** If it contains actual sentences in the voice, those are the strongest signal: match their length, rhythm, bluntness and recurring words. Adjectives in the doc are treated as a *description* of that sound rather than as the instruction. Sample lines demonstrate sound, never subject matter.
- **The editor now carries an authoring guide** (collapsed) naming what a working voice doc contains, with *five to ten lines you would actually say, quoted exactly* as the highest-value section by a distance.

The existing voice docs are untouched. That copy is Marrs's.

---

## Still missing, in priority order

### 1. The analytics loop (the real answer)

Marrs: *"That's the ultimate sign of success: if the post actually works and gets traction, then we can copy that structure."* Agreed, and it is the only term in the formula that is not somebody's opinion.

The wiring is: Metricool per-post metrics → a per-stream baseline → a post that clears the baseline auto-nominates itself as an exemplar. The flag already exists, so this is a reader and a threshold, not an architecture.

**The open question is the threshold**, and it is a judgment call, not a technical one: how much better than a stream's own median does a post have to be before it is allowed to teach the prompt? Too low and the standard becomes the average, which is the thing we are trying to beat. My suggestion is roughly 2x median on completion or sends, with a floor on impressions so a post nobody saw cannot win on a ratio, and a cap of about five auto-nominated exemplars per stream so the prompt stays a standard rather than an archive.

**Sandcastles was the obvious source for an external benchmark and it is not reachable.** The skills are installed but their MCP server is not connected in this session, so no live hook or format data could be pulled. If it is worth having, that connector needs authorising; `higgsfield` and `figma` need the same. I did not substitute my own numbers for it.

### 2. The model bake-off

Marrs: *"test two different models with the same prompt once we get it refined, Sonnet, Deepseek v4 pro, chatgpt and see which produces the best results, then we program that switch in Openrouter if its worth it."*

Right instinct, and the sequencing in that sentence is the important part: **refined first, then compare.** Comparing models on a starved prompt measures which model best disguises missing input, which is worth nothing. Now that the prompt carries the pattern library and the concept carries ammunition, a comparison means something.

The shape when it is built: one route, one concept, one recipe, N models, output side by side and unlabelled so the judgment is not primed by knowing which is which.

**The switch itself is now in place.** `SCRIPT_MODEL` (in `lib/marketing/draft.ts`) overrides the model for drafting only, falling through to `OPENROUTER_MODEL` when unset, the same per-task shape as `FIGURE_MODEL` and `PODCAST_MODEL`. It is an env var rather than a constant so the same concept can be run through two models back to back without a deploy in between, which is the whole point of a bake-off.

**Cost turned out not to be the constraint, and the reason is worth recording.** Live OpenRouter list prices, per million tokens in / out:

| Model | In | Out | Per draft (~8k in / 6k out) |
| --- | --- | --- | --- |
| `deepseek/deepseek-v4-flash` | $0.08 | $0.17 | ~$0.002 |
| `deepseek/deepseek-v4-pro` | $1.32 | $3.96 | ~$0.03 |
| `google/gemini-3.5-flash` | $1.50 | $9.00 | ~$0.07 |
| `anthropic/claude-sonnet-5` | $2.00 | $10.00 | ~$0.08 |
| `anthropic/claude-opus-5` | $5.00 | $25.00 | ~$0.19 |

Two things fall out of that table. **Gemini 3.5 Flash is not a cheap model.** It is a *fast* model priced within about ten percent of Sonnet 5, so the implicit trade of "we accept weaker writing to keep the bill down" was never actually being made. Its 800 to 950 mandatory reasoning tokens are also billed at the $9 output rate and cannot be turned off, so roughly a cent of every call buys reasoning nobody reads. **And DeepSeek v4 Pro is about half the price of the model in front of it**, which makes it the obvious third leg of the comparison rather than a budget compromise.

Marrs's assumption was that April was already on DeepSeek. That the question could not be answered from inside the console is its own finding, and `scriptModelInUse()` now fixes it: both draft routes return the resolved model alongside the draft, the same way the figure and clip routes already did. The definitive answer for any past draft is the OpenRouter activity log, which lists the model per call.

None of this touches the Claude Max subscription, which is a developer tool and not API credit (see the root `CLAUDE.md` anti-goals). It is the OpenRouter bill either way.

**One trap closed on the way.** Anthropic removed `temperature` / `top_p` / `top_k` on its current models: sending them is a 400, not a silently ignored field. Every call in `lib/llm/openrouter.ts` had always sent `temperature: 0.7`, so pointing any `*_MODEL` variable at an Anthropic model would have hard-failed with an error that reads like a key or quota problem. `samplingFor()` now omits the sampling block for `anthropic/` models on both the streaming and blocking paths. Matched on the vendor prefix rather than a list of model ids: on models that still accept temperature, omitting it just takes the provider default, so there is no list to keep in sync as models ship.

Not run yet: the comparison itself. The next real signal is what the fixed prompt produces from a concept that has its ammunition filled in, on both models.

### 3. The concept backfill

Every existing concept predates the four new sections. They will still draft (the parser is tolerant and the prompts name a fallback), but they will draft *without ammunition*, which is the original problem.

Capability mapping is the one to do first, since it is the concept that surfaced this. Filling in **What they believe instead** and **Concrete specifics** by hand, on one concept, is the fastest test of whether this diagnosis is right.

---

## The one-line summary

The prompt was not under-instructed, it was **under-supplied**: it had been told what good looks like in adjectives, shown no examples of it, and pointed at a concept document with no concrete material in it. All three are now fixed at the source. The remaining work is measuring rather than guessing, and that starts with Metricool.
