/**
 * THE INTERCEPTOR (D93): one helper every chat route calls first.
 *
 * Marrs: "regardless of where I am in the system, if there's a chat window, I can write
 * `feedback..`". Shared rather than repeated per route precisely so that stays true: a new chat
 * screen gets the behaviour by calling one function, and cannot get it subtly wrong.
 *
 * IT RUNS BEFORE THE MODEL, AND NOTHING IS SENT. A note is not an instruction to edit the draft, so
 * spending a call on it would be a waste and, worse, would risk April editing the piece in response
 * to a rule about her own behaviour. The route returns immediately with the confirmation.
 *
 * NO LLM CALL ON CAPTURE, DELIBERATELY, even though having her restate the note would prove she
 * understood it. Capture is the one action here that must never fail: an extra model call adds
 * latency and a failure mode to storing a sentence, and a lost note that he watched being typed is
 * the fastest way to stop trusting the feature.
 *
 * IT RETURNS TEXT, NOT A RESPONSE, and that distinction was a near-miss worth recording. The first
 * version returned a ready-made `{ ok, feedback, reply }` and the two chat clients read different
 * shapes: the piece chat does `if (data.content !== null) onApply(data.content)`, so an absent
 * `content` is `undefined`, `undefined !== null` is TRUE, and it would have written `undefined` over
 * his draft. **A confirmation message would have destroyed the piece he was working on.**
 *
 * So each route builds its own reply in its own shape, and the piece route in particular says
 * `content: null`, which is the existing way of saying "the draft was not changed" and is exactly
 * true here.
 *
 * Server-side only.
 */

import { STREAM_IDS } from './streams';
import { catchFeedback, type FeedbackContext } from './feedback';
import { addNote } from './feedback-store';

/**
 * If the instruction was feedback, store it and return the response the route should send.
 * Otherwise null, and the route carries on exactly as before.
 */
export type Captured =
  /** Stored. `said` is the confirmation to show him, naming the scope it chose. */
  | { stored: true; said: string }
  /** Not stored, and he must be told: a rule he believes is in force but is not is worse than none. */
  | { stored: false; error: string };

export async function captureFeedback(
  instruction: string,
  by: string,
  ctx: Omit<FeedbackContext, 'streams'>
): Promise<Captured | null> {
  const caught = catchFeedback(instruction, { ...ctx, streams: STREAM_IDS });
  if (!caught) return null;

  try {
    await addNote({
      by,
      text: caught.text,
      scope: caught.scope,
      stream: caught.stream,
      job: caught.job,
      kind: 'rule',
      from: caught.from,
    });
  } catch (err) {
    console.error('[feedback] could not store the note:', err);
    /**
     * SAID PLAINLY, because the alternative is him believing a rule is in force when it is not.
     * Every later draft would then look like April ignoring him.
     */
    return { stored: false, error: 'Could not save that feedback. Nothing was stored, so try again.' };
  }

  return { stored: true, said: `${caught.said} It is in her brief from the next draft on.` };
}
