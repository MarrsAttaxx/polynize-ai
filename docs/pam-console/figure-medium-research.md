# Is CSS the wrong tool for figures? (research, 2026-08-06)

**Status: research, not a decision.** Nothing here has been built. When Marrs picks, the choice
becomes D34 in [`decisions.md`](../decisions.md) and this note becomes its evidence.

Marrs's question, in his words: *"are we just simply using the wrong tool for this? Maybe CSS is
not the right tool. I know that there's a model in Higgsfield that does graphics beautifully,
obviously way better than this and way more accurately."* And what he is actually chasing: *"I hit
a button, it reads a script, and it does most of the work, and then I only have to do the
tweaking."* Four criteria: **more creative, faster, more accurate, more interactive.**

---

## 1. The finding that reframes the question

The bottleneck is not CSS. It is that **there is no pipeline**. Today he describes one figure to
April, waits, looks, corrects, and repeats, six or eight times per piece. Every medium below is
subject to that same serial loop, so changing the medium alone cannot deliver "hit a button and it
does most of the work". The fan-out is a separate build from the medium, and it is the larger win.

That said, the medium question is real, and the answer is not one medium. It is a **medium per
beat**, chosen by what the beat has to do:

| The beat has to... | Right material | Why |
| --- | --- | --- |
| Say a word, a number, a label | code (HTML type) | exact copy, exact brand font, free, instant |
| Be a diagram, mechanism or shape that MEANS something | **SVG** | see §2 |
| Respond to touch: a control, a reveal, a state change | code, and **JS if sandboxed** | see §3 |
| Show a world, a texture, a place, a person | generated still | code cannot draw these at all |
| Show real motion, weight, consequence | generated video, driven from code-rendered frames | see §5 |

The current system offers only one of these five, and it is not even the best form of the one it
offers.

---

## 2. The div box is the wrong primitive. SVG is already allowed.

April is instructed to draw with rectangles, circles and transforms, which means the CSS box model.
That is the actual cause of the failures Marrs has been hitting. His funnel came back as a stack of
narrowing bars because **a stack of narrowing bars is what boxes can do**. It was not disobedience.

Rendered comparison, same two asks, same tokens, hand-authored in both primitives:

- **Funnel.** Boxes give four bars of decreasing width. SVG gives one continuous vessel with walls,
  a throat and a spout, because a funnel is one `path` with six points.
- **Lever.** Boxes give a rotated bar and a circle floating near it, with labels hard to attach.
  SVG puts "YOU" inside the weight and "10x" inside the output, because text and geometry are the
  same coordinate space.

Four mechanical advantages, none of which are matters of taste:

1. **`viewBox` removes the whole class of layout failure.** One number scales the entire drawing.
   Nothing runs off the display, and the "size everything in vh, never px, nothing under 3vh" rules
   the prompt currently spends a paragraph on stop being necessary.
2. **Path beats box.** A funnel, a curve, an arc, a lever, an arrow, a bracket, a spiral, a
   silhouette are all one path. In boxes they are `clip-path` tricks or they are impossible.
3. **Every element is still a DOM node**, so the existing `s1..sN` tap contract, the snap control
   and the CSS scoping all keep working unchanged. This is additive, not a rewrite.
4. **It is already permitted.** `sanitiseFigureHtml` strips `script`, `iframe`, `object`, `embed`,
   `link`, `meta`, `base`, `form` and `svg:script`. It has never stripped `<svg>`. She simply has
   never been told she may use it.

**Cost to try: a paragraph in the system prompt.** This is the cheapest item on the page and it
targets "more accurate" directly. What it does not prove is how good the model is at SVG, which is
why it should be tested before it is trusted. `foreignObject` should be added to the sanitiser's
strip list when SVG is opened up, since it can host arbitrary HTML.

---

## 3. Sandboxing removes the JavaScript ceiling entirely

The ceiling that cost Marrs an hour ("is a slider even possible in CSS, or am I just wasting my
time") exists because April may not write JavaScript, which is because figures are served from the
unauthenticated prezie URL on the same origin as the console.

**An iframe with `sandbox="allow-scripts"` and NOT `allow-same-origin` runs in an opaque origin: it
cannot reach the parent DOM, `document.cookie`, or `localStorage`.** This is the mechanism CodePen
and JSFiddle rely on to run untrusted code safely. Verified against MDN, not assumed.

The engine already owns and injects `ENGINE_JS` in `figure-scene.ts`, so the change is contained:
put each figure in an iframe via `srcdoc`, and let the figure `postMessage` up when it is done so
the board advances.

What that unlocks, all of it currently impossible and some of it already asked for:

- real continuous **dragging** and sliders that follow a finger
- **physics**: falling, bouncing, momentum, a lever that genuinely throws something
- canvas, particles, generative motion, live counters
- anything where the presenter manipulates rather than advances

This is the single largest capability gain available, it is cheap, and it is the honest answer to
"more interactive". It also retires the most awkward paragraph in April's prompt.

---

## 4. What Higgsfield actually offers, checked rather than assumed

Queried live through the Higgsfield MCP.

**Video models with usable control surfaces:** FLUX 3 Video (5-20s, 1080p, `start_image` AND
`end_image`, multi-frame), MiniMax H3 (5-15s, 2K, start+end+references), Seedance 1.5 Pro (4/8/12s,
start+end), Kling 3.0 Turbo (3-15s, start frame, fast), Veo 3, Grok Video 1.5, Gemini Omni Flash.

**Explainer presets** (25 of them: Editorial Motion Graphics, Dynamic Motion Design, Isometric Flat
Vector, Whiteboard Doodle, Poster Vector, Claymotion, and so on). Previews pulled and inspected.

Two honest observations from looking at them:

1. **Text renders legibly now.** The old objection that generative video cannot hold type is out of
   date. "A SILK MERCHANT" and "AI Explained" both came back crisp and correctly spelled.
2. **The register is wrong for this brand.** The previews are consumer explainer: cartoon fruit with
   faces, pastel storybook, glassmorphic Apple-keynote. Beautiful, and a different genre from ink +
   coral/mint + tactile authority to founders. The repo's own anti-goals name this ("faux-brand AI
   slop decoration"). Brand control is only reachable by supplying a style reference image, not by
   picking a preset.

**And the structural problem: the explainer presets make the whole video instead of him.** They take
a script and produce a finished narrated piece. His format is him on camera, present, in front of a
screen he operates. Handing the video to a generator does not improve that format, it deletes it.
Right product, wrong job. (It is a good fit for **b-roll and cutaways**, which the asset kit already
has a path for.)

---

## 5. Where generated pixels genuinely win, and what they cost

Two places code cannot compete, and should not try:

- **A world, a texture, a place, a person, a product.** Code cannot draw these. Generate the still,
  composite the type over it in the engine so the words stay exact and on-brand.
- **Real motion with weight.** The lever that actually throws. Code tweens; the eye reads a tween as
  a sticker sliding. This is exactly what "she's just not good at physics" was about.

The technique that makes motion usable without losing brand control, and the most interesting thing
in this note: **FLUX 3 Video, MiniMax H3 and Seedance 1.5 Pro all accept `start_image` AND
`end_image`.** So render the before and after states in code (exact tokens, exact copy, correct
labels) and let the model interpolate only the motion between them. Brand accuracy comes from the
frames; weight and beauty come from the model. The still frames stay as the fallback if a clip is
poor.

The costs, stated plainly because they bear on his actual working loop:

- **A generated clip is a re-roll, not an edit.** "Make the coral box smaller" cannot be done. Every
  correction returns a different world. His entire loop this session has been *change one thing,
  leave the rest*, and video breaks that loop.
- **Latency.** Tens of seconds to minutes per clip, against instant for code.
- **It cannot be interactive.** A clip plays; it does not respond. The snap control, the toggle, the
  before/after he operates on camera cannot be video.
- **Credits per generation**, against free for code.

So: video is a real addition for specific beats, and a bad default.

---

## 6. Recommendation, in build order

Ordered by value over effort, and each one ships independently.

1. **Script to whole prezie in one pass.** The button he asked for. `scriptSections` already splits
   the script; one planner call decides the picture, the taps and the medium per beat; fan out and
   generate every figure in parallel; open the result in the editor that already exists for tweaking
   one figure at a time. Medium-agnostic, so it is worth doing first whatever else is decided.
2. **Let her draw in SVG.** Biggest accuracy gain per unit of work. A prompt change plus
   `foreignObject` in the sanitiser. Test before trusting.
3. **Sandbox the figure and allow JavaScript.** Removes the drag, slider and physics ceiling
   completely. Verified safe.
4. **Generated stills for illustration beats**, composited under engine-owned type.
5. **Video only where motion is the point**, from code-rendered start and end frames.

Not recommended: the explainer-video presets for prezies. They replace the presenter, in a register
that is not this brand.

The through-line: **code for anything that must be exact, editable or touchable; generated pixels
for anything that must be beautiful, textured or physical.** The current system uses the weakest
form of the first and none of the second.
