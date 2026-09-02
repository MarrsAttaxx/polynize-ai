/**
 * A COLOUR PER PERSON, FOR THE ANALYTICS PANEL ONLY (D87).
 *
 * Marrs: "If we had, for instance, a colour for each of us... you could see, even roughly, what
 * percentage of that line was coming from who... I'm not too sure if it's really needed on a global
 * level or if it's just useful on the analytics level."
 *
 * ANALYTICS LEVEL ONLY, and that is a decision rather than a shortcut. The brand already spends
 * colour on a meaning: coral is human, amber is hybrid, mint is agent. Handing coral to Marrs and
 * amber to Shourov would quietly remap the one semantic the brand has, on every screen. Confined to
 * the panel that asks "whose reach is this", a series palette answers a question nothing else on
 * that screen answers, and it never leaves.
 *
 * WHO GETS WHAT IS MARRS'S CALL (D88): "I'd rather the Polynize colour is our brand mint colour
 * instead of the blue. Just swap Shourov to the blue colour and make me (Marrs) a slightly more red
 * colour." So Polynize takes the brand hue, Shourov takes blue, and Marrs moves from orange to red.
 *
 * THE MINT IS THE BRAND HUE, STEPPED DOWN. `#69fccb` itself cannot be a chart fill: OKLCH L 0.898,
 * far above the 0.48-0.67 band a mark has to sit in, and the validator says so as a hard FAIL. So it
 * is the same hue at L 0.65, which reads as the brand's green and is legible as a 14px bar. The
 * brand token is untouched and still paints the chart's own line, where a single colour is checked
 * for contrast rather than for series separation.
 *
 * AND THE RED CAUGHT A REAL PROBLEM, which is the whole reason the validator is run rather than
 * reasoned about. Mint beside red is the classic red/green collapse: the documented red `#e66767`
 * next to a stepped mint scores CVD dE 6.1, under the target of 8, because a deuteranope sees the
 * pair as nearly one colour. And these two slots TOUCH in every bar, since Polynize and Marrs are
 * adjacent in STREAMS. Twenty four combinations were measured; `#cf4436` is a red rather than an
 * orange and clears the target at dE 9.1 in both modes. Coral `#ff7a6b` was the first thing tried
 * and is the worst possible choice here: dE 1.5, effectively invisible as a distinction.
 *
 * Validated with the guidance's own script against the console's real surfaces rather than eyeballed:
 *
 *   dark  (#1c1c27): every check PASS. Worst adjacent CVD dE 9.1, normal-vision 19.3, contrast all >= 3:1.
 *   light (#f4ece0): every check PASS except contrast, which WARNs on three of five.
 *
 * THE LIGHT WARN IS NOT DISMISSABLE and it is answered rather than ignored: the guidance allows a
 * sub-3:1 fill only where the value is readable another way, so every bar carries its total as a
 * visible label, the legend names every person in text, and the table underneath lists the posts.
 * Three relief channels, none of them colour.
 *
 * COLOUR FOLLOWS THE PERSON, NEVER THEIR RANK. The slot is fixed by position in STREAMS, so
 * filtering to a shorter list, or one stream out-performing another, never repaints anybody. A
 * chart where the colours move when the data moves is worse than no colour at all.
 *
 * Pure and client-safe: it imports the stream list and nothing else.
 */

import { STREAMS } from './streams';

/**
 * The five slots, both modes, in STREAMS order: Polynize, Marrs, Shourov, Kristin, Julian.
 *
 * Mint (the brand hue at a legible step) and red hold the same value in both modes because that one
 * pair validates against both surfaces; blue, yellow and magenta take the documented per-mode steps,
 * which is why they differ between the two lines.
 */
export const SERIES_DARK = ['#00a77b', '#cf4436', '#3987e5', '#c98500', '#d55181'] as const;
export const SERIES_LIGHT = ['#00a77b', '#cf4436', '#2a78d6', '#eda100', '#e87ba4'] as const;

/**
 * Which slot a stream owns, 1-based, by its position in STREAMS.
 *
 * A stream we do not know about gets 0, meaning "no slot": the caller paints it in a neutral ink
 * rather than borrowing somebody else's colour. Silently reusing a slot would show two people as
 * one, which is the one failure a colour key must not have.
 */
export function streamSlot(stream: string): number {
  const ix = STREAMS.findIndex((s) => s.id === stream);
  return ix === -1 ? 0 : ix + 1;
}

/** The CSS custom property holding this stream's colour, or the neutral for an unknown one. */
export function streamColorVar(stream: string): string {
  const slot = streamSlot(stream);
  return slot === 0 ? 'var(--sc-none)' : `var(--sc-${slot})`;
}

/** How many slots exist, so the stylesheet and this file cannot disagree about the count. */
export const SERIES_SLOTS = SERIES_DARK.length;
