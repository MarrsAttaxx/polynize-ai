/**
 * STANDING VOICE RULES, applied to every prompt in the app (D91).
 *
 * Marrs: "I want her to say 'don't' instead of 'do not' and things like that."
 *
 * THIS IS WHERE A GLOBAL NOTE LIVES. The console already had two rules of this kind and no shared
 * home for them: the em-dash ban sits in lib/em-dash.ts next to its stripper, and the no-markdown
 * rule in lib/plain-copy.ts next to its. Both are about a CHARACTER, so living beside the code that
 * removes it makes sense. A rule about how the writing SOUNDS has no stripper to live next to, and
 * putting it in one of those files would make that file about two things.
 *
 * SO THE TEST FOR THIS FILE IS: does the rule apply to every piece of writing the system produces,
 * regardless of stream, format or screen? If yes it belongs here. If it applies to one stream it is
 * that stream's brand voice doc; if it applies to one screen it belongs in that screen's prompt.
 * Three scopes, and a rule in the wrong one is either ignored or applied where it does harm.
 *
 * INSTRUCTED, NOT ENFORCED, and that is the difference from the em-dash. An em-dash is a character
 * with no legitimate use here, so it is stripped on the way out and the instruction is belt and
 * braces. "Do not" has legitimate uses: inside a quotation, or as deliberate emphasis on an
 * imperative ("Do not touch this"). A find-and-replace would rewrite a quote and flatten the
 * emphasis, and it would have to fix capitalisation to avoid producing "Don't touch" mid-sentence.
 * So this one asks, and the check is whether the output actually improves.
 */

/**
 * Contractions, because the register is a person talking rather than a document.
 *
 * Written as a rule plus examples on purpose: the hook guidance learned this the hard way (D26 and
 * its correction), where compressing a pattern library down to adjectives produced writing that
 * satisfied the adjectives and imitated nothing. A model can copy "don't"; it can only approximate
 * "be conversational".
 */
export const CONTRACTIONS_INSTRUCTION =
  "Use contractions the way a person speaking would: don't, isn't, it's, you're, we've, can't, won't, that's, here's, there's. Write \"don't\" rather than \"do not\", \"isn't\" rather than \"is not\". The exceptions are deliberate emphasis, where the full form is the point (\"do NOT ship it\"), and anything inside a quotation, which is reproduced exactly as it was said.";

/** Every standing rule, in one string, for the layer that appends them to a system prompt. */
export const HOUSE_VOICE_RULES = [CONTRACTIONS_INSTRUCTION].join('\n');
