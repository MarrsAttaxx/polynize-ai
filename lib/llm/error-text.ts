/**
 * WHAT ACTUALLY WENT WRONG, IN WORDS SOMEONE CAN ACT ON (D70).
 *
 * Marrs: "April is not working getting error: April is unavailable right now. Try again in a
 * moment."
 *
 * That message is thrown by seventeen routes and it means seventeen different things. The provider
 * layer already raises good errors, `OpenRouter 429: ...`, `OpenRouter returned no content`,
 * `OpenRouter stream timed out after 240000ms`, and every one of them was being caught and
 * flattened into "try again in a moment", which is advice that is wrong for most of the causes: a
 * revoked key, an empty account and a model this key cannot use are all permanent until somebody
 * changes something, and "try again" sends the operator in a circle.
 *
 * Diagnosing this one took reading the model list, checking a regex and ruling out a deploy, none
 * of which would have been necessary if the screen had said "OpenRouter refused the key".
 *
 * TWO RULES IT FOLLOWS.
 *
 * It NAMES THE ACTION, not the exception. "Out of credit on OpenRouter" tells you where to go;
 * `Error: Request failed with status 402` does not.
 *
 * It NEVER ECHOES A SECRET. The provider errors carry a response body, and while OpenRouter's do
 * not include the key, a redaction pass costs nothing and the alternative is trusting that forever.
 * Anything that looks like a bearer token or an sk- key is stripped before the text is returned.
 */

/** Long enough to carry a provider's own sentence, short enough not to be a wall. */
const MAX_DETAIL = 220;

/** Bearer tokens, sk- keys and long hex blobs, in case a provider ever echoes one back. */
const SECRETS = [
  /Bearer\s+[A-Za-z0-9._-]{8,}/gi,
  /\bsk-[A-Za-z0-9._-]{8,}/gi,
  /\b[A-Fa-f0-9]{32,}\b/g,
];

function redact(text: string): string {
  let out = text;
  for (const rx of SECRETS) out = out.replace(rx, '[redacted]');
  return out;
}

/**
 * A sentence for the screen, given whatever the provider threw.
 *
 * `who` is the name the operator knows the caller by, because "April is unavailable" and "the image
 * editor is unavailable" were already two different words for the same layer and the mapping should
 * not decide which one this screen uses.
 */
export function llmErrorText(err: unknown, who = 'April'): string {
  const raw = err instanceof Error ? err.message : String(err ?? '');
  const msg = redact(raw);

  // The key is missing entirely, which is a deploy problem rather than a provider one.
  if (/is not set/i.test(msg)) {
    return `${who} has no API key configured. Set OPENROUTER_API_KEY (or APRIL_OPENROUTER_API_KEY) in Vercel.`;
  }

  /**
   * NO CONTENT is the one that looks like an outage and is not. The production model reasons before
   * it answers and those tokens count against max_tokens, so a ceiling below the reasoning floor is
   * spent entirely on thinking and returns an empty string. It has bitten this codebase twice.
   */
  if (/no content/i.test(msg)) {
    return `${who} answered with nothing. Usually the token ceiling was spent on reasoning before any text was written, so the fix is a higher max_tokens rather than a retry.`;
  }

  if (/timed out|AbortError/i.test(msg)) {
    return `${who} took too long and the request was cut off. A retry is worth one go; twice in a row means the model is struggling with the length.`;
  }

  const status = msg.match(/\b(400|401|402|403|404|408|409|422|429|5\d\d)\b/)?.[1];
  switch (status) {
    case '401':
    case '403':
      return `OpenRouter refused the key (${status}). Check OPENROUTER_API_KEY and APRIL_OPENROUTER_API_KEY in Vercel: a revoked or rotated key fails exactly like this and no retry will fix it.`;
    case '402':
      return 'OpenRouter says the account is out of credit (402). Top it up and this works again immediately.';
    case '404':
      return 'OpenRouter does not have that model available on this key (404). Check OPENROUTER_MODEL against their model list.';
    case '429':
      return 'OpenRouter is rate limiting right now (429). This one genuinely is worth waiting a minute for.';
    case '400':
    case '422':
      return `OpenRouter rejected the request (${status}), which is a payload problem rather than an outage: ${detail(msg)}`;
    default:
      break;
  }
  if (status && status.startsWith('5')) {
    return `OpenRouter had a server error (${status}). Their side, not ours, so a retry is the right move.`;
  }

  // Unrecognised: hand back what was actually said rather than inventing a category for it.
  return `${who} failed: ${detail(msg)}`;
}

function detail(msg: string): string {
  const trimmed = msg.trim();
  return trimmed.length > MAX_DETAIL ? `${trimmed.slice(0, MAX_DETAIL)}…` : trimmed;
}
