/**
 * WHY APRIL IS DOWN, IN ONE PAGE (D71).
 *
 * Marrs: "April is not working getting error: April is unavailable right now." Then, after the
 * error was made honest: "Its not creits."
 *
 * So it is not 402, and Vercel's runtime logs are 403 for this team, which leaves guessing. This
 * stops the guessing by making the calls itself and reporting exactly what came back.
 *
 * THE LEAD THIS EXISTS TO TEST. April does NOT use the console's key. `article-draft.ts` and
 * `draft.ts` pass `apiKey: process.env.APRIL_OPENROUTER_API_KEY`, and the OpenRouter client falls
 * back to `OPENROUTER_API_KEY` only when that is unset. So a rotated, revoked or truncated April
 * key breaks April specifically while every other LLM call in the console keeps working, which is
 * exactly the shape of "April is not working" with nothing else complaining.
 *
 * The probe therefore calls with BOTH keys and prints both answers. One working and the other
 * refusing is the whole diagnosis in a single line.
 *
 * IT ALSO TESTS THE REASONING FLOOR, which is the other cause that looks like an outage and is not:
 * the production model reasons before it answers, those tokens count against `max_tokens`, and a
 * ceiling below the floor returns an empty string rather than an error. One deliberately low
 * ceiling next to one generous ceiling tells them apart.
 *
 * NEVER PRINTS A KEY. Only whether one is set and how long it is, because a truncated paste is a
 * real cause and its length is the only safe way to see it.
 */

import { complete } from './index';
import { llmErrorText } from './error-text';
import { resolveModel } from './openrouter';

export type KeyFacts = {
  name: string;
  set: boolean;
  /** Length only. A truncated paste is a real cause and this is the safe way to see it. */
  length: number;
};

export type ProbeCall = {
  label: string;
  why: string;
  ok: boolean;
  ms: number;
  /** The first words back, so a success is visibly a real answer rather than an empty string. */
  reply?: string;
  /** The mapped sentence, and the raw message under it, since this screen is for diagnosis. */
  error?: string;
  raw?: string;
};

export type LlmProbe = {
  provider: string;
  model: string;
  keys: KeyFacts[];
  /** True when the two keys are set to different values, which is the case worth knowing about. */
  keysDiffer: boolean;
  calls: ProbeCall[];
};

function keyFacts(name: string): KeyFacts {
  const v = process.env[name];
  return { name, set: Boolean(v), length: v?.length ?? 0 };
}

/**
 * One call, never throwing, timed.
 *
 * Deliberately the smallest possible prompt: the question is whether the pipe is open, and a long
 * prompt would add its own failure modes to the answer.
 */
async function one(
  label: string,
  why: string,
  args: { apiKey?: string; maxTokens: number }
): Promise<ProbeCall> {
  const startedAt = Date.now();
  try {
    const reply = await complete({
      system: 'You are a diagnostic. Reply with exactly the word: alive.',
      messages: [{ role: 'user', content: 'Are you there?' }],
      maxTokens: args.maxTokens,
      json: false,
      apiKey: args.apiKey,
    });
    return {
      label,
      why,
      ok: true,
      ms: Date.now() - startedAt,
      reply: reply.trim().slice(0, 120) || '(empty string, which counts as a failure)',
    };
  } catch (e) {
    return {
      label,
      why,
      ok: false,
      ms: Date.now() - startedAt,
      error: llmErrorText(e, 'This call'),
      raw: (e instanceof Error ? e.message : String(e)).slice(0, 600),
    };
  }
}

export async function runLlmProbe(): Promise<LlmProbe> {
  const april = process.env.APRIL_OPENROUTER_API_KEY;
  const consoleKey = process.env.OPENROUTER_API_KEY;
  const keys = [keyFacts('APRIL_OPENROUTER_API_KEY'), keyFacts('OPENROUTER_API_KEY')];

  /**
   * Sequential, not parallel. Three calls at once against a key that is being rate limited would
   * turn one 429 into three and make the result harder to read, and the whole page takes seconds.
   */
  const calls: ProbeCall[] = [];

  calls.push(
    await one(
      "April's own key",
      'This is the key article-draft.ts and draft.ts actually pass. If this refuses and the next one works, the April key is the problem and nothing else in the console would have noticed.',
      { apiKey: april, maxTokens: 3000 }
    )
  );

  calls.push(
    await one(
      "The console's key",
      'The fallback, used by everything that does not pass its own. If both refuse it is the account or the model rather than one key.',
      { apiKey: consoleKey, maxTokens: 3000 }
    )
  );

  calls.push(
    await one(
      'A deliberately low ceiling',
      'The production model reasons before it answers and those tokens count against max_tokens, so a low ceiling is spent thinking and returns an empty string. If this one comes back empty while the first two answer, the outage is a ceiling somewhere and not the provider.',
      { apiKey: april ?? consoleKey, maxTokens: 200 }
    )
  );

  return {
    provider: process.env.LLM_PROVIDER ?? 'openrouter',
    model: resolveModel(),
    keys,
    keysDiffer: Boolean(april && consoleKey && april !== consoleKey),
    calls,
  };
}
