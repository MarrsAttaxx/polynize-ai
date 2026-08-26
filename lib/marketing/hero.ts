/**
 * THE HERO IMAGE: how many, and what shape.
 *
 * One module because three places have to agree, and two of them are on opposite sides of the
 * network: the route that generates, and the panel that lays out the results. A grid built for
 * four that receives three is a hole, and a tile built at 4:5 holding a 4:3 photograph is a
 * letterbox.
 *
 * CLIENT SAFE and pure. It imports nothing, for the reason spelled out in slide-propose.ts: the
 * gates panel is a `'use client'` component and one store import puts `node:crypto` in the
 * browser bundle, which typechecks and then 500s the page (D47).
 */

/**
 * FOUR AT A TIME. Marrs: "I would like the prompt to generate four images, and then you choose
 * the one you want."
 *
 * Four rather than one is not a small change in cost: it is four generations per attempt instead
 * of one. It is the right trade here and only here, because this is the ONE image the whole
 * narrative is generated against, so the minutes spent settling it are paid back across every
 * slide and post that follows. Nothing else in the console generates a batch.
 */
export const HERO_BATCH = 4;

/**
 * 4:3, and it is a real Soul size rather than a crop. Marrs: "Make those 4:3 ratio."
 *
 * `2048x1536` is `SoulSize.LANDSCAPE_2048x1536` from the SDK's own allow-list, which has 13
 * entries; the four this repo had listed in SOUL_SIZES were a subset, and the missing ones
 * included both of the 4:3s. So this needs no crop, which matters: a crop would mean the
 * photograph he chose is not quite the photograph he gets.
 */
export const HERO_SIZE = '2048x1536';
export const HERO_W = 2048;
export const HERO_H = 1536;
/** For a CSS `aspect-ratio`, so a tile reserves the right space before the image loads. */
export const HERO_ASPECT = '4 / 3';
