import type { CompleteArgs } from './index';

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

/**
 * Hard ceiling on a single OpenRouter call enforced via fetch's AbortController
 * signal. Sized to fire BEFORE the route-level Promise.race deadline
 * (HARD_ATTEMPT_TIMEOUT_MS = 250s in capability-map/generate/route.ts) so the
 * AbortController gets first chance at clean fetch teardown. If the signal
 * fails to terminate the request (intermittent undici behavior on Vercel),
 * the route's Promise.race is the backstop. Tunable via OPENROUTER_TIMEOUT_MS.
 */
const DEFAULT_TIMEOUT_MS = 240_000;

export async function completeWithOpenRouter(args: CompleteArgs): Promise<string> {
  const apiKey = args.apiKey ?? process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error('OPENROUTER_API_KEY is not set');
  // The caller's choice wins, then the env default. See CompleteArgs.model for why the caller
  // gets a say: the figure work is a coding task and does not want the drafting model.
  const model = args.model ?? process.env.OPENROUTER_MODEL ?? 'minimax/minimax-01';
  const referer = process.env.OPENROUTER_REFERER ?? 'https://polynize.ai';
  const title = process.env.OPENROUTER_TITLE ?? 'Polynize Agent Builder';
  const timeoutMs = Number(process.env.OPENROUTER_TIMEOUT_MS) || DEFAULT_TIMEOUT_MS;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const startedAt = Date.now();
  console.log(
    `[openrouter] POST ${OPENROUTER_URL} model=${model} max_tokens=${
      args.maxTokens ?? 1000
    } timeout_ms=${timeoutMs}`
  );

  let res: Response;
  try {
    res = await fetch(OPENROUTER_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        'HTTP-Referer': referer,
        'X-Title': title,
      },
      body: JSON.stringify({
        model,
        max_tokens: args.maxTokens ?? 1000,
        temperature: args.temperature ?? 0.7,
        // OpenAI-standard JSON mode. Passed through by OpenRouter to upstream
        // providers (Gemini, OpenAI, DeepSeek, Anthropic) that support it.
        // Structurally guarantees the model's output is parseable JSON —
        // closes off the "valid JSON until line 493 then dropped a comma"
        // class of bugs that Gemini 3.5 Flash was producing on the v0.5
        // envelope. Providers that ignore this parameter degrade silently
        // to plain text output (same behavior as before this flag existed).
        // Opt out (json: false) for prose/Markdown prompts, which must not be
        // wrapped in a JSON object (the intake interview + concept doc).
        ...(args.json === false ? {} : { response_format: { type: 'json_object' } }),
        messages: [
          { role: 'system', content: args.system },
          ...args.messages,
        ],
      }),
      signal: controller.signal,
    });
    console.log(
      `[openrouter] headers received after ${Date.now() - startedAt}ms, status=${
        res.status
      }`
    );
  } catch (err) {
    // AbortError can be either a DOMException (modern undici) or an Error
    // (older Node). Match by name on either path.
    const name = (err as { name?: string })?.name;
    if (name === 'AbortError') {
      throw new Error(
        `OpenRouter call timed out after ${timeoutMs}ms (model=${model})`
      );
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`OpenRouter ${res.status}: ${text.slice(0, 500)}`);
  }

  const data = (await res.json()) as {
    choices?: {
      message?: { content?: string };
      finish_reason?: string;
    }[];
  };
  const content = data.choices?.[0]?.message?.content;
  const finishReason = data.choices?.[0]?.finish_reason ?? 'unknown';
  if (!content) throw new Error('OpenRouter returned no content');
  console.log(
    `[openrouter] body parsed after ${Date.now() - startedAt}ms total, content length=${
      content.length
    }, finish_reason=${finishReason}`
  );
  // finish_reason: "stop" = clean completion; "length" = hit max_tokens
  // (truncated; bump maxTokens or tighten prompt); other values usually
  // indicate filtering or tool calls (neither expected here).
  if (finishReason === 'length') {
    console.warn(
      `[openrouter] WARNING: response was truncated by max_tokens cap. ` +
        `Consider raising max_tokens (currently ${args.maxTokens ?? 1000}) or ` +
        `tightening the prompt to produce shorter output.`
    );
  }
  return content;
}
