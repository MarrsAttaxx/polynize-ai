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
 * SO THESE ARE NOT BRAND COLOURS. They are the documented categorical series palette from the house
 * chart guidance, in its fixed slot order, which is what keeps them apart for colourblind readers.
 * Validated with the guidance's own script against the console's real surfaces rather than eyeballed:
 *
 *   dark  (#1c1c27): every check PASS. Worst adjacent CVD dE 8.4, normal-vision 19.3, contrast all >= 3:1.
 *   light (#f4ece0): every check PASS except contrast, which WARNs on four of five.
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
 * The house categorical slots 1 to 5, both modes. Same five hues stepped for each surface, in the
 * documented order (blue, orange, aqua, yellow, magenta) which is the CVD-safety mechanism and is
 * never re-ordered to taste.
 */
export const SERIES_DARK = ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181'] as const;
export const SERIES_LIGHT = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4'] as const;

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
