import { listSavedPieces, type MarketingPiece } from './piece-store';

/**
 * WHAT GOOD LOOKS LIKE.
 *
 * Marrs named the gap exactly: "in that calculation, we don't have something that indicates
 * what good looks like, whether that's industry standard or past work."
 *
 * The prompt is full of instructions ABOUT quality and, until now, contained not one
 * instance OF it. That is the weakest possible way to steer a writer: a model asked to be
 * "concrete and ownable" agrees and then regresses to the mean of everything it has read,
 * which for business content is LinkedIn filler. One real example of the house standard
 * moves output further than another paragraph of adjectives.
 *
 * SO GOOD IS DEFINED BY WHAT HE MARKS AS GOOD, not by my opinion of it. Marking a piece
 * exemplary makes it a worked example in every later draft for the same stream and format.
 * That works from the first piece, which matters because the analytics loop he wants
 * ("once we're posting, we're seeing that analytics and bringing that back in") cannot start
 * until things have been posted and measured.
 *
 * THE ANALYTICS LOOP PLUGS IN HERE, and this is the shape it should take: a post that
 * actually performed gets nominated automatically by stamping the same `exemplar` flag, so
 * the prompt improves without anybody curating it. That keeps one definition of good with
 * two sources of evidence (his taste now, measured traction later) instead of two competing
 * systems. Nothing in this file needs to change for that; only the thing that sets the flag.
 */

export type Exemplar = {
  piece_id: string;
  title: string;
  format: string;
  /** Why this one is good, in his words. The most valuable part, and usually the shortest. */
  note?: string;
  /** The piece itself: the script for video, the body for text. */
  body: string;
};

/** An exemplar is only useful if it has something to read. */
function bodyOf(p: MarketingPiece, kind: 'video' | 'text'): string {
  const raw = kind === 'video' ? p.script : p.body;
  return typeof raw === 'string' ? raw.trim() : '';
}

/**
 * The best examples to show a writer drafting this piece.
 *
 * MATCHED ON FORMAT FIRST, then widened to the same kind. A 45-second split-screen short
 * and a 6-minute screen recording are different crafts, so a long-form example shown to a
 * short-form writer teaches the wrong rhythm. But one imperfectly matched example still
 * beats none, so rather than showing nothing it falls back to any exemplar of the same
 * kind and says so in the prompt.
 *
 * Never throws: a missing example must not stop a draft.
 */
export async function pickExemplars(
  owner: string,
  opts: { stream?: string; format: string; kind: 'video' | 'text'; excludePieceId?: string; limit?: number }
): Promise<{ items: Exemplar[]; exactFormat: boolean }> {
  const limit = opts.limit ?? 2;
  let pieces: MarketingPiece[] = [];
  try {
    pieces = await listSavedPieces(owner);
  } catch (err) {
    console.error('[exemplars] could not list pieces:', err);
    return { items: [], exactFormat: true };
  }

  const candidates = pieces.filter(
    (p) =>
      p.exemplar === true &&
      p.piece_id !== opts.excludePieceId &&
      // Same stream only. A Polynize exemplar shown while drafting for a client stream
      // would teach the wrong voice, which is the failure D25's brand-voice work exists to
      // prevent.
      (!opts.stream || (p.stream ?? '') === opts.stream) &&
      bodyOf(p, opts.kind) !== ''
  );

  const toExemplar = (p: MarketingPiece): Exemplar => ({
    piece_id: p.piece_id,
    title: typeof p.title === 'string' ? p.title : '',
    format: typeof p.format === 'string' ? p.format : '',
    note: typeof p.exemplar_note === 'string' && p.exemplar_note.trim() ? p.exemplar_note.trim() : undefined,
    body: bodyOf(p, opts.kind),
  });

  // Newest first: the house standard moves, and the most recent thing he blessed is the
  // best evidence of where it is now.
  const recent = (a: MarketingPiece, b: MarketingPiece) =>
    String(b.exemplar_at ?? b.updated_at ?? '').localeCompare(String(a.exemplar_at ?? a.updated_at ?? ''));

  const sameFormat = candidates.filter((p) => p.format === opts.format).sort(recent);
  if (sameFormat.length > 0) {
    return { items: sameFormat.slice(0, limit).map(toExemplar), exactFormat: true };
  }
  return { items: candidates.sort(recent).slice(0, limit).map(toExemplar), exactFormat: false };
}

/**
 * The prompt fragment.
 *
 * THE DANGEROUS PART OF FEW-SHOT PROMPTING IS THAT A MODEL COPIES THE MATERIAL, not the
 * craft: shown a good script about capability mapping, it will happily write another script
 * about capability mapping when the brief was something else. So the framing here is
 * emphatic and repeated, and the concept's primacy as the only source of truth is restated
 * immediately after the examples rather than left implied.
 */
export function exemplarBlock(
  items: Exemplar[],
  opts: { exactFormat: boolean; formatLabel: string }
): string {
  if (items.length === 0) return '';

  const shown = items
    .map(
      (e, i) =>
        `EXAMPLE ${i + 1}${e.title ? ` (${e.title})` : ''}${
          opts.exactFormat ? '' : ` [a ${e.format} piece, so take its craft and not its rhythm]`
        }\n${e.note ? `Why this one is good, in the operator's words: ${e.note}\n` : ''}"""\n${e.body}\n"""`
    )
    .join('\n\n');

  return `\n\nWHAT GOOD LOOKS LIKE HERE. ${
    items.length === 1 ? 'This is a piece' : 'These are pieces'
  } the operator marked as hitting the standard${
    opts.exactFormat ? ` for this exact format` : ''
  }. Read ${items.length === 1 ? 'it' : 'them'} for the level to clear: how fast the opening gets to the point, how concrete the lines are, the rhythm of the beats, where the emphasis falls, and how the voice actually sounds on the page. This is the bar.

${shown}

NOW THE PART THAT MATTERS MOST ABOUT ${items.length === 1 ? 'THAT EXAMPLE' : 'THOSE EXAMPLES'}: take the CRAFT, never the CONTENT. Do not reuse ${
    items.length === 1 ? 'its' : 'their'
  } subject, argument, facts, numbers, images, phrasing or structure-of-argument. Your material comes only from the concept in the user's message, and nowhere else. If you find yourself writing a line that would fit the example as well as it fits this concept, you have copied instead of learned. Match the standard, write the brief.`;
}
