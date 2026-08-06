# The short-form script shape

The house standard for short-form video, taken verbatim from a script Marrs wrote
(2026-08-04). It is not a suggestion and it was not designed by an agent: it is the shape
he arrived at by writing, and it is encoded in `FormatDef.scriptShape` for the short-form
formats plus `HOOK_CRAFT` in `lib/marketing/output-plan.ts`.

```
HOOK 1:
ON-SCREEN TEXT: <headline claim, 6 to 10 words>

SPOKEN:
<one breath, 15 to 25 words>

----

HOOK 2:
(same two lines)

----

HOOK 3:
(same two lines)

----

BEAT 1
<spoken prose, one or two short paragraphs, one idea>

BEAT 2
BEAT 3
BEAT 4 (only if the argument has a fourth move)

CTA
<the ask>

CLOSE
<one line after the CTA, the last thing said, punched in the edit>
```

## Why each part is the way it is

- **Several hooks, one body.** Every hook is a different way IN to the same argument and
  must hand over cleanly to BEAT 1, because only one survives each edit. Recording all of
  them in one session is what turns one shoot into several scheduled posts.
- **The beats carry SPOKEN WORDS ONLY.** No screen notes, no stage directions, no shot
  marks: the beats are read off a teleprompter, and the screen is the prezie, planned
  separately. The `ON-SCREEN TEXT` line inside a hook is the one exception, because that
  text is part of the hook itself rather than a direction about the screen.
- **CTA and CLOSE are separate.** The CTA is the ask; the CLOSE is one line after it and is
  the actual last thing said. It gets an emphasis punch in the edit, so it has to be worth
  punching. This is the standing "punch the last line" rule expressed in the script shape.
- **Three beats, four when earned.** One idea per beat.

## The hooks, and why they work

His three, verbatim, are the reference set:

| On-screen text | Spoken |
|---|---|
| The smartest companies do this before touching any AI. | The smartest companies in the world are doing this right now before touching any AI |
| The Key to Unlocking AI in Your Company | If your company is struggling to implement AI in any meaningful way, you're most likely missing this important first step. |
| Why Buying More AI Licences Makes things worse | If your company keeps buying more AI licences and you haven't seen any ROI yet, I guarantee THIS is the problem. |

What they have in common, which is what `HOOK_CRAFT` encodes:

1. **They withhold the payload.** All three point at an unnamed thing ("do THIS", "missing
   THIS first step", "THIS is the problem"). A hook that contains the answer is a summary.
2. **They qualify the audience out loud.** "If your company is struggling to...", "If your
   company keeps buying...". The wrong viewer scrolls on; the right one stays.
3. **They carry authority or a guarantee.** "The smartest companies in the world", "I
   guarantee".
4. **The two lines do different jobs.** On-screen is the headline that stops a scroll on
   mute; spoken qualifies and guarantees. They must not be the same sentence reworded.

The three entry points, one per hook: **the elite already do it**, **the missing first
step**, **the counterproductive action**.

## A note on how this went wrong first

The earlier version of this guidance used three hook examples that an agent invented, one
of which was a draft Marrs had already rejected as a bad hook, pulled out of the starter
library and recommended back to him as an exemplar. It kept resurfacing in his drafts for
exactly that reason.

**The rule that follows: exemplars come from work the operator has approved, never from
generated drafts.** A rejected draft sitting in a repo is not evidence of anything.


## The teleprompter

A CONTINUOUS SCROLL of the whole script, not a paged sequence of sections (changed 2026-08-06
after Marrs used it: *"instead of tapped for next section, can we just make it a straight scroll,
because I have a mouse that I'm hiding on my desk"*).

It matters for the same reason the prezie beats a deck: he stops executing steps and reads at his
own pace, embellishing where he wants without falling out of sync with a mechanism.

- **The wheel scrolls it**, with no code: it is an ordinary scroll container, so a hidden mouse
  on the desk works by itself.
- **Auto-scroll** at an adjustable speed (12 to 120 px/sec), started and stopped with space.
  Manual scrolling is never blocked while it runs, and it carries on from wherever he leaves it.
- **Mirrored** for beam-splitter glass, **sized** in seven steps, both remembered per DEVICE
  rather than per piece: the iPad in the rig is always mirrored and the laptop never is.
- Controls hide with one tap, because anything bright is a reflection in the shot.
- Half a screen of padding top and bottom, so the first line starts at eye level and the last can
  be read without sitting on the bottom edge.

**Two things this removed.** The fit-down that shrank a long beat to fit one screen is gone, and
so is the problem it solved: nothing has to fit any more. And the tap zones are gone, because a
stray touch on a prompter costs you your place in the script.

**One implementation note worth keeping.** Auto-scroll accumulates FRACTIONAL pixels between
frames. A readable pace is well under one pixel per frame (20px/s is a third of a pixel at 60fps),
so rounding each frame independently gives zero movement forever. Verified: the naive version
moves 0px in a second where the accumulator moves 19 of an intended 20.
