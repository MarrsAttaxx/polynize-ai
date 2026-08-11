# One-shot prezie prompt

Paste everything between the rulers into a fresh Claude conversation (or Claude Artifacts). Swap the
script at the bottom for whatever piece you are building. Ask for one HTML file, open it on the
touchscreen, film.

**Why this can work where the console has not.** A standalone file is not served through the console's
sanitiser, so **JavaScript is allowed**. Dragging, real sliders, physics, canvas and particles are all
on the table. That ceiling was a property of serving figures from an unauthenticated URL, not of the
medium.

**How to iterate.** Do not re-prompt from scratch. Say "figure 3 only: the columns should fill one cell
at a time, not all at once" and let it edit the file. One figure per message.

---

You are building a PREZIE: a single self-contained HTML page that a presenter operates on a 32 inch
touchscreen while being filmed. It is not a slide deck and not a video. It is a sequence of pictures he
advances by tapping, so his hand entering frame and touching the screen is part of the shot.

Return ONE complete HTML file. Inline everything: CSS, JavaScript, SVG. It must open from a local file
with no server, no build step and no network. Nothing may be fetched at runtime, because it is
performed in a studio and must not depend on the network mid-take.

## THE BRAND. Use only these colours, and they carry MEANING

```
--ink    #0a0a0f   the background, always
--cream  #f4ece4   structure, neutral marks, most text
--coral  #ff7a6b   the problem, the human
--amber  #f0b86b   the tension, the hybrid
--gold   #f0e1b6   proof, data, evidence
--mint   #69fccb   the resolution, the agentic
```

Type is **Space Grotesk 700** for everything except small technical labels, which are monospace. Load
it from a `@font-face` with a base64 woff2 if you can, or fall back to a system geometric sans and say
so. Nothing else. No other colours, no gradients for decoration, no emoji, no icon libraries, no
drop shadows for their own sake.

## LEGIBILITY, because this is filmed and watched on a phone

- It is read from across a room on a 32 inch screen, and the footage is watched at 375px wide.
- Nothing smaller than 3% of the viewport height, ever. Most labels want 5% to 8%. One hero word or
  number can be 20%.
- **Text on a figure is a LABEL, not a sentence.** A word or three. The presenter says the rest. If you
  find yourself writing a phrase longer than four words, that is narration and it belongs in his mouth.
- No paragraphs. No bullet lists of prose. No captions explaining the picture.

## DRAW WITH SVG, NOT WITH BOXES

This is the single most important instruction here. Put the picture inside an `<svg>`. Use HTML around
it only for touch controls.

Drawing with div boxes is what makes a figure miss. Asked for a funnel, boxes can only give a stack of
narrowing bars, because that is the only funnel a box model has. In SVG a funnel is one path with six
points and it reads instantly.

Use this canvas for every figure:

```html
<svg viewBox="0 0 1000 600" preserveAspectRatio="xMidYMid meet"
     style="width:100%;height:100%;display:block">
```

One canvas throughout, deliberately: it roughly matches the screen it is filmed on, `meet` guarantees
the whole drawing stays visible at any size, and coordinates become thousandths of the width so there
is one legibility floor (nothing under 32 units) rather than a per-figure calculation. **Use the whole
canvas.** A drawing composed in one corner looks small and accidental on a 32 inch screen.

Four traps that will bite you, in order of how certainly they will:

1. **A CSS transform on an SVG element rotates about the canvas origin, not the shape.** Set
   `transform-box: fill-box` and `transform-origin` on anything you rotate or scale, every time.
2. **SVG text does not wrap and does not shrink.** A label wider than the shape it sits in hangs out of
   it. Use `textLength` with `lengthAdjust="spacingAndGlyphs"` when a label must fit a known width, and
   `text-anchor="middle"` with `dominant-baseline="central"` to centre in a shape rather than eyeballing
   a y offset.
3. **Check the canvas AFTER every tap, not just at rest.** A tap that moves something can push it off
   the edge from a perfectly framed start, and that only shows up with a camera pointed at it. For each
   tap, add the movement to the coordinates and confirm it still lands inside 0 to 1000 by 0 to 600.
4. **Prefix every id.** Gradients, clip paths and motion paths need ids, and all figures live in one
   document, so an unprefixed `id="grad"` in two figures makes both wrong.

## THE INTERACTION

- **Tap anywhere advances**, because his hand is already at the screen and hunting for a button reads
  badly on camera. Also bind Space, Right arrow and Left arrow so it can be driven from a clicker.
- A figure may need several taps before the next one. Advance within the figure first, then to the next
  figure.
- **A faint mark in the bottom right corner**, cream at about 10% opacity, no animation, large invisible
  hit area with a small visible mark. It is an escape hatch and must not look like a Next button.
- **Swipe or Left arrow goes back**, so a flubbed take can be redone without reloading.
- One small operator cue strip along the very bottom in monospace, about 1.5% of viewport height, dim:
  which figure, how many taps remain. It is for him, not the audience, and it sits in the strip that
  gets cropped or covered anyway.
- **When a figure has its own control** (a slider, several things to hit), tapping the figure must NOT
  advance. Only the corner mark advances then. Say clearly in a comment which figures are which.

## MOTION

- **Hard cuts and decisive moves only.** No crossfades, no gentle dissolves, no slow ease-in-out on
  everything. Things arrive, move and land.
- Objects **persist and transform** where they can, rather than one picture replacing another. If the
  same idea is on screen across two taps, move the existing shape; do not fade out one and fade in a
  near-identical one. That continuity is the whole reason this is not a slide deck.
- **When a grid or matrix fills in, fill it ONE CELL AT A TIME**, roughly 120ms apart, and let the last
  cell land before anything else happens. Then hold. The reveal is the point and rushing it kills it.
- A continuous loop (a pulse, a slow drift) is fine for a resting state.

## THE ONE RULE THAT MATTERS MOST

**Draw only what the beat needs, and nothing else.** One figure is one picture making one argument. Do
not add a heading that was not asked for, do not add a caption, do not add a legend, do not add a second
idea because there is space. If a beat is a single static image, that is the whole figure and it takes
zero taps. Empty space on a figure is not a problem to solve.

## WHAT TO BUILD FROM THE SCRIPT

Below is the script. Build one figure per BEAT, plus the CTA. Skip the HOOK: that is him talking to
camera before the screen is used.

For each figure, write in a comment: what the picture is, what each tap does, and what the picture
MEANS. If you cannot say what it means in one line, it is decoration and should be simpler.

Here is the figure spine. Follow it unless you can see something clearly stronger, in which case say
what you changed and why:

**Figure 1, from BEAT 1: THE FORCE MULTIPLIER.** A small input block on the left, an amplifier wedge in
the middle, a large output on the right. Tap 1: a mint input feeds through and the output arrives large
and mint, labelled with a multiple. Tap 2: the input is REPLACED by a coral broken one, the same
amplifier runs, and the output arrives just as large and coral. Same machine, opposite result. The
argument: it does not care what you point it at. Do not label it "force multiplier"; he says that.

**Figure 2, from BEAT 2: CAPABILITY MAPPING.** Open on a disordered cloud of small shapes, the work as
it actually is. Tap 1: they snap into a tidy grid of identical cells, one at a time, fast. Tap 2: the
cells migrate into three columns and take their colour ONE CELL AT A TIME, coral, amber, mint. Column
headings appear only as they fill: HUMAN, HYBRID, AGENTIC. The argument: the mess resolves into
classified capability. This is the figure the whole piece turns on, so it gets the most taps and the
most care.

**Figure 3, from BEAT 3: THE MIDDLE IS THE WORK.** The three columns persist from figure 2, in place, no
re-entry. Tap 1: the mint column lights, everything else dims. Tap 2: the coral column lights instead.
Tap 3: the amber middle lights and the columns either side lean toward it. The argument: the hybrid
middle is where workflows get redesigned.

**Figure 4, from BEAT 4: WHERE THE MONEY GOES.** The columns shrink to the top and one cell is ringed in
gold. The argument: clarity about where to spend. Keep this one nearly still; it is the calm before the
CTA.

**Figure 5, CTA.** The single word MAP, huge, in mint, on ink. Nothing else. He says the rest.

Then a final state for the CLOSE: hold figure 4's picture, or return to the whole map. His close is "once
you see it, you can't unsee it", so the last thing on screen should be the thing he wants unseeable.

---

## THE SCRIPT

```
HOOK 1
ON-SCREEN TEXT: The smartest companies do this before touching any AI.
SPOKEN: The smartest companies in the world are doing this right now before touching any AI

HOOK 2
ON-SCREEN TEXT: The Key to Unlocking AI in Your Company
SPOKEN: If you're company's struggling to Implement AI in any meaningful way, you're most likely missing this important first step.

HOOK 3
ON-SCREEN TEXT: The right & wrong way to Agentify your company
SPOKEN: There's a right way and a very wrong way of implementing AI in your company, so let me show you the difference.

BEAT 1
But, first you have to understand one thing, AI is a force multiplier, meaning it doesn't care what you
point it at, i'ts just going to exponentially amplify that process whether its good or bad.
So if you dont even know what good looks like in your people, processes and tech, and then your just
pointing AI blindly at all of it.
You're most liekly going to do more harm than good.
So what's the solution?

BEAT 2
Well there's really only one proper fix for this and its what we're doing with one of the big 4 global
consulting firms and one of the biggest global tech brands, we can't name drop just yet.
But the fix I can tell you, its called Capability Mapping.
Which is the system of breaking down your workflows, people and processes down into their core
capabilities and classifing each into three distinct columns: human, hybrid or agentic.
And this is the point, you have to capability map the work before you can understand what to amplify
with AI.

BEAT 3
This way, you understand exactly where AI belongs, and you know exactly where humans need to stay in
control. and the space in the middle, the hybrid piece, is all about redesigning workflows that touch
both human and agentic work.

BEAT 4
This is the key to unlocking real AI capability in your organisation, it gives you the clarity and
cetainty you need to understand where to focus your finacial and human captial.

CTA
So, if you want to capablity map one of your business bottlenecks agaist 100 million data poinst we've
collected over the past 3 years, comment 'map' below and I'll send you the link.

CLOSE
It's one of those things that once you see it, you can't unsee it.
```

---

Build it. Return the single HTML file and nothing else. Then tell me, in five lines, what each figure is
and how many taps it takes, so I can rehearse it before I film.
