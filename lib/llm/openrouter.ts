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

/**
 * Resolve which model a call will actually use: the caller's choice, then the env default.
 *
 * Exported so a readout cannot disagree with the call. Marrs asked how to confirm April had
 * moved onto the coding model, and the honest answer has to come from the same line of code
 * that picks it; anything reconstructed elsewhere drifts the moment one of them changes.
 */
export function resolveModel(override?: string): string {
  return override || process.env.OPENROUTER_MODEL || 'minimax/minimax-01';
}

/**
 * What arrives from the model while it is still working.
 *
 * `reasoning` is the model thinking out loud, where it emits any; `content` is the answer being
 * written. Both are partial fragments, not whole lines.
 */
export type StreamDelta = { reasoning?: string; content?: string };

/**
 * The same call as `completeWithOpenRouter`, streamed, returning the identical final string.
 *
 * WHY THIS EXISTS. On the coding model a figure takes 30 to 90 seconds, and Marrs asked for the
 * only thing that actually settles "is it working or frozen": "is there a way that I can see her
 * reasoning? even if small, or just one line scrolling fast, would give me the confidence that she
 * is actually working on something." A spinner cannot answer that question. Text arriving can.
 *
 * It reports BOTH reasoning and content deltas and lets the caller decide what to show, because
 * reasoning is not guaranteed: whether a model emits it depends on the model and the provider
 * route. Content deltas always arrive, so on the draw call the CSS itself scrolling past is the
 * proof of life, which is arguably better evidence than a summary of intent.
 *
 * Three field names are read for reasoning because OpenRouter has used all three across providers
 * and versions (`reasoning` as a plain string, DeepSeek's native `reasoning_content`, and the
 * newer unified `reasoning_details` array). Reading all three costs nothing and means a provider
 * route change cannot silently turn the indicator off.
 *
 * `reasoning` is NOT requested as a parameter. Models that emit it do so by default, and asking
 * for it explicitly risks a 400 from a model that does not support the field, which would break
 * the whole call for the sake of a progress line.
 */
export async function streamWithOpenRouter(
  args: CompleteArgs,
  onDelta: (d: StreamDelta) => void
): Promise<string> {
  const apiKey = args.apiKey ?? process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error('OPENROUTER_API_KEY is not set');
  const model = resolveModel(args.model);
  const timeoutMs = Number(process.env.OPENROUTER_TIMEOUT_MS) || DEFAULT_TIMEOUT_MS;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const startedAt = Date.now();
  console.log(`[openrouter] STREAM model=${model} max_tokens=${args.maxTokens ?? 1000}`);

  try {
    const res = await fetch(OPENROUTER_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        'HTTP-Referer': process.env.OPENROUTER_REFERER ?? 'https://polynize.ai',
        'X-Title': process.env.OPENROUTER_TITLE ?? 'Polynize Agent Builder',
      },
      body: JSON.stringify({
        model,
        stream: true,
        max_tokens: args.maxTokens ?? 1000,
        temperature: args.temperature ?? 0.7,
        ...(args.json === false ? {} : { response_format: { type: 'json_object' } }),
        messages: [{ role: 'system', content: args.system }, ...args.messages],
      }),
      signal: controller.signal,
    });

    if (!res.ok || !res.body) {
      const text = await res.text().catch(() => '');
      throw new Error(`OpenRouter ${res.status}: ${text.slice(0, 500)}`);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let content = '';
    let finishReason = 'unknown';

    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      // SSE frames are separated by a blank line, but a chunk can split one anywhere, so only
      // whole lines are consumed and the remainder stays in the buffer for the next read.
      let nl: number;
      while ((nl = buffer.indexOf('\n')) !== -1) {
        const line = buffer.slice(0, nl).trim();
        buffer = buffer.slice(nl + 1);
        if (!line.startsWith('data:')) continue;
        const payload = line.slice(5).trim();
        // OpenRouter sends ": OPENROUTER PROCESSING" comments as keep-alives; those are not
        // data lines and are skipped above.
        if (!payload || payload === '[DONE]') continue;
        let frame: {
          choices?: {
            delta?: {
              content?: string;
              reasoning?: string;
              reasoning_content?: string;
              reasoning_details?: { text?: string; summary?: string }[];
            };
            finish_reason?: string;
          }[];
        };
        try {
          frame = JSON.parse(payload);
        } catch {
          // A malformed frame is not worth failing a whole generation over.
          continue;
        }
        const choice = frame.choices?.[0];
        if (choice?.finish_reason) finishReason = choice.finish_reason;
        const delta = choice?.delta;
        if (!delta) continue;

        const reasoning =
          delta.reasoning ??
          delta.reasoning_content ??
          (Array.isArray(delta.reasoning_details)
            ? delta.reasoning_details.map((r) => r.text ?? r.summary ?? '').join('')
            : undefined);

        if (delta.content) content += delta.content;
        if (reasoning || delta.content) {
          onDelta({ reasoning: reasoning || undefined, content: delta.content || undefined });
        }
      }
    }

    console.log(
      `[openrouter] stream closed after ${Date.now() - startedAt}ms, content length=${
        content.length
      }, finish_reason=${finishReason}`
    );
    if (finishReason === 'length') {
      console.warn(
        `[openrouter] WARNING: streamed response was truncated by max_tokens ` +
          `(currently ${args.maxTokens ?? 1000}).`
      );
    }
    if (!content) throw new Error('OpenRouter returned no content');
    return content;
  } catch (err) {
    if ((err as { name?: string })?.name === 'AbortError') {
      throw new Error(`OpenRouter stream timed out after ${timeoutMs}ms (model=${model})`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

export async function completeWithOpenRouter(args: CompleteArgs): Promise<string> {
  const apiKey = args.apiKey ?? process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error('OPENROUTER_API_KEY is not set');
  const model = resolveModel(args.model);
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
