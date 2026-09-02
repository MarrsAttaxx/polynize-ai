/**
 * SHORT, OR A LANDSCAPE VIDEO (D84).
 *
 * A vertical file has to publish to YouTube as a Short. Metricool refuses it otherwise, in as many
 * words: "Invalid video orientation, only horizontal is allowed."
 *
 * THE TOKEN IS `short`, LOWERCASE, AND IT WAS READ OFF HIS OWN ACCOUNT RATHER THAN GUESSED. Their
 * OpenAPI spec gives `youtubeData.type` no values at all and the word SHORT appears nowhere in
 * 1.2MB of schema, so the probe reads the per-network settings back off real scheduled posts. Two of
 * his carried it:
 *
 *   "youtubeData": { "title": "Which Type are You?", "type": "short", "privacy": "public",
 *                    "category": "SCIENCE_TECHNOLOGY", "madeForKids": false }
 *
 * Case matters and is not consistent across their API: this is lowercase `short` while Instagram's
 * is uppercase `REEL` and LinkedIn's is uppercase `POST`. All three are copied from his data.
 *
 * A LANDSCAPE VIDEO SENDS NO TYPE AT ALL, deliberately. The token for it is NOT in his data, and the
 * default already accepts horizontal video: the rejection was specific to orientation, so the
 * behaviour we had is the correct behaviour for that case. Sending nothing is the one option here
 * that involves no guess.
 *
 * DEFAULTS TO SHORT for anything this console produces, because everything it produces for YouTube
 * is vertical: the kit's only YouTube video row is Shorts, and long form is blocked for want of an
 * edit pipeline. So a post with no answer recorded takes the answer that is right for every post the
 * pipeline can currently make.
 */

export type YoutubeVideoType = 'short' | 'landscape';

/** What their API is sent, or undefined when the honest answer is to send nothing. */
export function youtubeTypeToken(choice: YoutubeVideoType | undefined): string | undefined {
  return (choice ?? 'short') === 'short' ? 'short' : undefined;
}

/** What the operator reads on screen, so the choice is never invisible. */
export function youtubeTypeLabel(choice: YoutubeVideoType | undefined): string {
  return (choice ?? 'short') === 'short' ? 'Short (vertical)' : 'Landscape video';
}

export function isYoutubeVideoType(x: unknown): x is YoutubeVideoType {
  return x === 'short' || x === 'landscape';
}
