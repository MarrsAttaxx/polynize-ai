/**
 * THE TITLE A YOUTUBE POST GOES OUT WITH (D80, corrected D82).
 *
 * Marrs: "Is there a way we can take the first line of the post and make that the YouTube title, or
 * how are we making that up? Are you selecting that yourself?"
 *
 * Fair question, and the answer was worse than his suggestion. It took the piece TITLE first and the
 * first line of the copy only as a fallback, and the piece title is an internal filing name in every
 * case that exists: a post made from finished media is titled with the media library's label (the
 * text typed when pasting a Box link), and a post from a Story is titled
 * "<the headline>: Numbered rules". Neither is a thing anyone would put on YouTube.
 *
 * THE FIRST LINE IS THE ONE PIECE OF WRITING AIMED AT A READER. His own post opens "Is this AI
 * Business Advice BS?", which is a better YouTube title than anything a heuristic would assemble. So
 * the first line wins and the label is the fallback for the one case where there is no copy at all.
 *
 * IT IS ALSO SHOWN ON SCREEN, which is the real answer to "are you selecting that yourself". A
 * derived title nobody can see is a guess with extra steps: the caption screen prints exactly what
 * will be sent, so changing it means changing the first line, which is where a hook belongs anyway.
 *
 * PURE AND CLIENT SAFE, and that is why it is its own file rather than living in metricool-client:
 * the caption screen is a 'use client' island and one import of the API client would put the
 * publishing layer in the browser bundle (D47).
 */

/**
 * YouTube's cap, as Metricool's validator states it: "must be shorter than 100 characters".
 *
 * SHORTER THAN, so 99 (D81). Reading that as inclusive is a rejected post.
 */
export const YOUTUBE_TITLE_MAX = 99;

/**
 * The title, from the post's own first line.
 *
 * `label` is the fallback for a post with no copy yet, which is the only case the first line cannot
 * answer. An empty result means send no title at all, which is better than sending an empty one.
 *
 * ANGLE BRACKETS GO. Metricool refuses them ("The characters < or > are not allowed") and they
 * arrive by accident, out of a pasted fragment, rather than by intent.
 *
 * TRIMMED AT A WORD BOUNDARY, never mid-word: a long opening line cut at exactly 99 characters
 * lands in the middle of a word and reads as a fault rather than as a title. The 60% floor is the
 * same rule the post preview uses for the fold, and for the same reason: backing up to a space is
 * only an improvement while the result is still most of the line.
 */
export function youtubeTitleFrom(copy: string, label?: string): string {
  const firstLine = (copy ?? '')
    .trim()
    .split(/\r?\n/)[0]
    .trim();
  const pick = (firstLine || (label ?? '').trim()).replace(/[<>]/g, '').trim();
  if (pick.length <= YOUTUBE_TITLE_MAX) return pick;

  const slice = pick.slice(0, YOUTUBE_TITLE_MAX);
  const space = slice.lastIndexOf(' ');
  return (space > YOUTUBE_TITLE_MAX * 0.6 ? slice.slice(0, space) : slice).trim();
}
