# Content Series — worked examples + field spec

Seven fully-structured content series in the console's real format, to seed a series-building chat with a good spread of structure. The **production recipe** is the load-bearing part: it is the standing instruction the agent follows to one-shot the piece, refined run over run. Everything else sets expectations and routing.

## The fields (a ContentTemplate)

| Field | What it is | Constraint |
|---|---|---|
| **name** | Display name of the series | short |
| **status** | Lifecycle | `active` \| `developing` \| `retired` |
| **format** | The output module it makes | one id from the catalogue below |
| **platforms** | Where it publishes | a subset of that format's channels |
| **audience (icp)** | Who it is for | one archetype id below, or none |
| **description** | One line shown in the picker | one sentence |
| **inputs** | "You bring" | one line |
| **outputs** | "You get" | one line |
| **example** | A link to / description of a piece made this way | optional |
| **recipe** | The production recipe the agent follows | multi-line, the important part |

**Valid formats** (id · kind · module): `linkedin_text` (text · built) · `short_form_video` (video · built) · `medium_video` (video · coming) · `long_form_text` (text · coming) · `pdf_carousel` (image · coming) · `image_carousel` (image · coming) · `single_image` (image · coming) · `newsletter` (text · coming) · `long_form_written` (text · coming). Only **built** modules create pieces today; `coming` ones (all the image formats) become live when the image module ships (the Higgsfield build). `single_image` and `pdf_carousel` below are marked `developing` for that reason.

**Channels per format:** linkedin_text -> linkedin · short_form_video -> instagram, tiktok, youtube, linkedin · single_image -> instagram, linkedin · pdf_carousel -> linkedin.

**ICP archetypes:** `organisational_architect` · `high_stakes_operator` · `revenue_accelerator` · `talent_champion` · `service_ops_leader`.

**House craft (applies to every series, do not restate in each recipe):** no em-dashes; every visual transition is a hard cut (no fades); captions run continuous top to tail; the first frame is the vertical thumbnail (clean hook frame, no captions); always write a final line worth punching, because the last line always gets the emphasis in the edit.

---

## 1. Show and Tell

- **Name:** Show and Tell
- **Status:** active
- **Format:** Short-form video (`short_form_video`)
- **Platforms:** instagram, tiktok, youtube
- **Audience (ICP):** Organisational Architect (`organisational_architect`)
- **Description:** Corrects a wrong mental model, warmly: show the misconception, then hand over a clearer frame.
- **You bring:** A core concept that contains a common misunderstanding.
- **You get:** A talking-head short that leaves the viewer holding a better model, not feeling corrected.
- **Example:** (link a strong Show and Tell once one exists)
- **Production recipe:**

```
Voice: warm, generous, teacherly. You are handing someone a better map, not scoring a point. No smugness, no gotcha.

HOOK (first spoken line): name the wrong mental model the viewer probably holds, out loud and plainly. "You think [X] works like [wrong model]." No wind-up, no "in this video".
BEAT 1 (validate): show why that model feels right, so the viewer never feels stupid for holding it.
BEAT 2 (the turn): "here is what is actually happening." Hand over the clearer frame, concretely, with one simple example or analogy.
BEAT 3 (show it): the new frame in action, one quick before/after so the viewer sees the difference, not just hears it.
CTA: one action that only makes sense once you hold the new frame.
FINAL LINE: a single warm restatement of the new frame, the sentence they will remember. This gets punched.

Length: 45 to 75 seconds. B-roll in setup/resolve pairs: establish the misconception, then resolve it on the turn.
```

---

## 2. Reality Check

- **Name:** Reality Check
- **Status:** active
- **Format:** Short-form video (`short_form_video`)
- **Platforms:** instagram, tiktok, youtube
- **Audience (ICP):** High-Stakes Operator (`high_stakes_operator`)
- **Description:** Punctures a hype belief. Dry, one hard turn, done.
- **You bring:** A core concept that contradicts a popular piece of AI hype.
- **You get:** A short, restrained puncture that lands harder for saying less.
- **Example:** (link once one exists)
- **Production recipe:**

```
Voice: dry, flat, almost deadpan. You fight hype with restraint, not more volume. Zero adjectives.

HOOK: state the hyped belief as if quoting it, then puncture it in the same breath. "Everyone says [hype]. It is wrong." Under 12 words if you can.
ONE HARD TURN: the single reason it is wrong, said once, concretely. No list. No hedging. No "but of course it depends". One turn, that is the whole spine.
LAND: the plain cost of believing the hype, then stop mid-momentum.
CTA: usually none, the puncture is the value. If one is needed, a single line.
FINAL LINE: the driest possible restatement. Punched.

Length: 20 to 40 seconds, deliberately short. Cut anything that softens the turn: no music swell, no reassurance, no second example. The restraint is the format.
```

---

## 3. Teardown

- **Name:** Teardown
- **Status:** developing
- **Format:** Short-form video (`short_form_video`)
- **Platforms:** youtube, instagram, tiktok
- **Audience (ICP):** Organisational Architect (`organisational_architect`)
- **Description:** Maps the hidden structure under something familiar. The blueprint assembles part by part.
- **You bring:** A core concept with an underlying system most people do not see.
- **You get:** A short where a blueprint visibly builds on screen, one component at a time.
- **Example:** (video sibling of the Carousel Teardown, #6)
- **Production recipe:**

```
Voice: analytical, calm, confident. You are lifting the lid on machinery the viewer sees the output of but never the workings.

HOOK: name the familiar thing and claim a hidden structure. "This looks like [luck / chaos / talent]. It is a system. Here is the blueprint."
BUILD: assemble the structure PART BY PART, one component per beat. Each beat adds exactly one piece and names it, with an on-screen label or diagram fragment that stays as the next piece lands, so the blueprint visibly accumulates.
ASSEMBLED: step back and show the whole thing built, then name the one principle that holds it together.
CTA: "map your own [X]" or the concept's natural next step.
FINAL LINE: the principle in one line. Punched.

Length: 60 to 90 seconds (it needs room to build). The cumulative on-screen diagram is the signature: never clear the board between beats. This is the same skeleton as the Carousel Teardown, one is watched, one is swiped.
```

---

## 4. Contrarian Post

- **Name:** Contrarian Post
- **Status:** active
- **Format:** LinkedIn post (text) (`linkedin_text`)
- **Platforms:** linkedin
- **Audience (ICP):** Revenue Accelerator (`revenue_accelerator`)
- **Description:** A written reframe that moves from a small story to a sharp point. Reflective, not a hot take.
- **You bring:** A core concept and, ideally, a real moment that surfaced it.
- **You get:** One LinkedIn post that reframes something the reader thought was settled.
- **Example:** (link once one exists)
- **Production recipe:**

```
Voice: reflective, measured, first person. A considered reframe delivered as a realization, not a dunk. Earned, not loud.

OPEN: a small, concrete moment (two or three lines) that sets up the tension. Specific and real, not a hypothetical.
TURN: the reframe the moment reveals, stated plainly. This is the contrarian point, but it reads as something you worked out, not something you are throwing.
MIDDLE: two or three short paragraphs grounding the reframe: why it holds, what it changes.
LAND: on agency, what the reader can now see or do differently. Not reassurance, not a summary.

Rules: first line must earn the second. Line breaks between thoughts. No hashtags unless one is genuinely natural. No emoji. Concrete over abstract everywhere.
```

---

## 5. One Chart

- **Name:** One Chart
- **Status:** developing
- **Format:** Single image (`single_image`)
- **Platforms:** linkedin, instagram
- **Audience (ICP):** Organisational Architect (`organisational_architect`)
- **Description:** One diagram proves one idea; the caption carries the words.
- **You bring:** A core concept with a single claim a picture can make undeniable.
- **You get:** One clean diagram plus a caption that does the depth.
- **Example:** (link once the image module ships)
- **Production recipe:**

```
Principle: one image, one idea. The diagram does the proving, the caption does the talking. If it needs two diagrams, it is two posts.

THE IMAGE: a single clean diagram that makes ONE idea obvious at a glance (a 2x2, a before/after, a curve, a short flow). Brand tokens carry meaning: coral = human, amber = hybrid, mint = agent. No decoration, no clutter, legible on a phone. It must stand alone: someone who only sees the image gets the idea.
PICK THE CLAIM: from the concept, take the single sharpest thing a diagram can prove. Resist cramming.
CAPTION: carries what the image cannot. Open on the claim, one short paragraph of proof or context, land on the implication. The image is the hook, the caption rewards the reader who stops.

Image generation note: this is the Higgsfield image module's territory (text-on-image for labels, a clean generated or composed diagram).
```

---

## 6. Carousel Teardown

- **Name:** Carousel Teardown
- **Status:** developing
- **Format:** PDF / document carousel (`pdf_carousel`)
- **Platforms:** linkedin
- **Audience (ICP):** Organisational Architect (`organisational_architect`)
- **Description:** Pulls a framework apart slide by slide, so the reader assembles it as they swipe. The silent sibling of the video Teardown.
- **You bring:** A core concept with a framework worth unpacking.
- **You get:** A LinkedIn carousel that builds a framework across slides.
- **Example:** (same skeleton as Teardown, #3)
- **Production recipe:**

```
Structure: take one framework and pull it apart, ONE component per slide, so the reader builds it in their head as they swipe.

SLIDE 1 (cover): name the thing and promise the hidden structure. The scroll-stopper. Few words, large.
SLIDES 2..n (one each): one component per slide: its name, one line on what it does, a minimal diagram fragment. The framework visibly accumulates across slides, so keep the layout consistent and the fragments cumulative.
PENULTIMATE SLIDE: the whole framework assembled, the payoff view.
FINAL SLIDE: the principle that holds it together, plus a soft CTA (map your own, or talk to us).

Rules: one idea per slide, never two. Minimal words per slide, this is a carousel not an essay. Brand tokens (coral/amber/mint) carry meaning. Same skeleton as the video Teardown so the two can share a concept.
```

---

## 7. Case Note

- **Name:** Case Note
- **Status:** active
- **Format:** LinkedIn post (text) (`linkedin_text`)
- **Platforms:** linkedin
- **Audience (ICP):** Service Ops Leader (`service_ops_leader`)
- **Description:** An anonymised client proof story: situation, what was done, outcome, lesson.
- **You bring:** A real client engagement you can anonymise.
- **You get:** A credible proof post that sells by showing, not claiming.
- **Example:** (link once one is cleared for use)
- **Production recipe:**

```
Purpose: proof through a real, anonymised client story. Credibility, not bragging. The specifics and the number do the selling.

SITUATION: the client's problem, anonymised but specific in shape (industry, size, the bottleneck), so the reader recognizes themselves. Never anything that identifies them.
WHAT WAS DONE: the move, concretely, in plain language. Name the actual intervention (the capability mapping, the specific change), no jargon dump.
OUTCOME: the result, with a real number where there is one (hours saved per week, throughput, error rate). Concrete beats adjectives.
LESSON: the transferable principle the reader can apply to their own business, stated plainly.

Rules: anonymise properly, no identifying details. Four clear beats with line breaks between them. Land on the lesson, not a pitch. One soft CTA at most. Let the numbers carry it, no hype words.
```

---

*These are structure references, not final copy. The recipe field is where the real leverage is: it is the standing brief the agent one-shots from, so it should read like instructions to a skilled operator, refined every time a piece from it lands well or badly.*
