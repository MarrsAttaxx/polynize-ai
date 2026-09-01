/**
 * A PIECE MADE OF WORK THAT IS ALREADY FINISHED (D80).
 *
 * One shape, in one place, because two things create it: the media library's "Post this" door, and
 * the rendered podcast clip, which was doing the same job with one field wrong.
 *
 * THE FIELD THAT WAS WRONG WAS `kind`, and it is worth writing down because it reads like a
 * technicality and is not. `kind` picks which screen renders the piece: 'video' opens the SCRIPT
 * screen, which edits the words you are going to say, offers a teleprompter and a "ready to record"
 * switch, and has no caption field and no way to reach the calendar. So a finished, cut, edited film
 * opened on a screen asking the operator to write and then perform it, and its caption could not be
 * edited anywhere in the console.
 *
 * A finished file needs the CAPTION module. That is what 'text' selects, and the caption screen has
 * the media picker, the platform preview, the approve gate and the button that puts it on the
 * calendar. The kind describes what has to be done to the piece, not what the file is.
 *
 * Pure, so both callers and the tests share one definition.
 */

import type { MarketingPiece } from './piece-store';

/** The format id, registered in output-plan.ts so `kindOf` resolves it rather than guessing video. */
export const FINISHED_MEDIA_FORMAT = 'finished_media';

/**
 * NO PLATFORMS ARE PRESET, on purpose.
 *
 * The wave picks platforms from a kit, where the choice was made deliberately at Gate 3. Here
 * nobody has chosen anything: this is one file and only the operator knows whether it is the
 * vertical cut or the wide one. Defaulting to all four would put a 16:9 edit on TikTok on his
 * behalf, which is worse than an empty row he has to tick, and the caption screen now has the
 * control to tick it with.
 */
export function finishedMediaPieceFor(input: {
  piece_id: string;
  owner: string;
  stream: string;
  label: string;
  media_id: string;
}): MarketingPiece {
  return {
    piece_id: input.piece_id,
    owner: input.owner,
    stream: input.stream,
    format: FINISHED_MEDIA_FORMAT,
    // The caption module. See the note at the top: this is the load-bearing field.
    kind: 'text',
    title: input.label,
    // Required to be a string, and empty is correct: nothing here is spoken from a script.
    script: '',
    body: '',
    platforms: [],
    media: [input.media_id],
    status: 'draft',
    /** It was shot, not generated. The same provenance the podcast clip stamps (D22). */
    provenance: 'human_capture',
    updated_at: new Date().toISOString(),
  };
}
