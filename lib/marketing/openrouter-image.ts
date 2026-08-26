/**
 * IMAGE GENERATION THROUGH OPENROUTER (D62), for the Gemini image models.
 *
 * Marrs: "there is a Nano Banana too, and in OpenRouter, its Model ID is:
 * google/gemini-3.1-flash-image"
 *
 * The shape is `image-edit.ts` with the reference image made optional: the same chat-completions
 * call, the same `modalities: ['image', 'text']`, the same base64 data URI coming back. That file
 * is proven against production, which is the reason this one copies it rather than inventing a
 * second way to talk to the same endpoint. The difference is only that editing always has a source
 * image and generating usually does not.
 *
 * WHAT THIS PROVIDER CANNOT DO, and it decides the design above it: there is no size, width,
 * height or aspect parameter. Verified against OpenRouter's public model list rather than assumed:
 * `supported_parameters` for both Gemini image models is seed, temperature, top_p, max_tokens,
 * reasoning and response_format. Nothing about dimensions. So the aspect is asked for in words and
 * the frame is enforced afterwards by cropping, and a caller that needs four images makes four
 * calls rather than setting a batch size.
 *
 * Server-side only. Never throws to the caller.
 */

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

export function openRouterKey(): string | undefined {
  return process.env.APRIL_OPENROUTER_API_KEY ?? process.env.OPENROUTER_API_KEY;
}

export type OpenRouterImage = { dataUri?: string; error?: string };

/**
 * One image from one prompt. `referenceUrl` is the style reference when there is one, which is
 * how a narrative's hero keeps a set looking like a set.
 */
export async function generateOpenRouterImage(
  model: string,
  prompt: string,
  opts: { referenceUrl?: string } = {}
): Promise<OpenRouterImage> {
  const apiKey = openRouterKey();
  if (!apiKey) return { error: 'Image generation is not configured (OpenRouter key missing).' };

  const content: Record<string, unknown>[] = [{ type: 'text', text: prompt }];
  if (opts.referenceUrl) {
    content.push({ type: 'image_url', image_url: { url: opts.referenceUrl } });
  }

  let dataUri: string | undefined;
  try {
    const res = await fetch(OPENROUTER_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        'HTTP-Referer': process.env.OPENROUTER_REFERER ?? 'https://polynize.ai',
        'X-Title': 'Polynize image generation',
      },
      body: JSON.stringify({
        model,
        modalities: ['image', 'text'],
        messages: [{ role: 'user', content }],
      }),
    });
    if (!res.ok) {
      const detail = (await res.text().catch(() => '')).slice(0, 300);
      console.error(`[openrouter-image] ${model} ${res.status}: ${detail}`);
      /**
       * The status is named because these two mean completely different actions. A 404 is the
       * model not being on this account's access, which is an account change and not a retry, and
       * this codebase has already been bitten by exactly that: image-edit.ts carries a note that
       * the 3.x image PREVIEW ids 404'd here.
       */
      if (res.status === 404) {
        return {
          error: `OpenRouter does not have ${model} enabled on this account. Check the model access on the OpenRouter key, then try again.`,
        };
      }
      if (res.status === 429) {
        return { error: 'OpenRouter is rate limiting right now. Wait a moment and try again.' };
      }
      return { error: `The image model returned ${res.status}. Try again in a moment.` };
    }
    const data = (await res.json()) as {
      choices?: { message?: { images?: { image_url?: { url?: string } }[] } }[];
    };
    dataUri = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;
  } catch (e) {
    console.error(`[openrouter-image] call threw: ${e instanceof Error ? e.message : String(e)}`);
    return { error: 'Network error reaching the image model. Try again.' };
  }

  if (!dataUri || !dataUri.startsWith('data:')) {
    /**
     * These models answer in text when they decline, and the text is in the same response. Saying
     * "no image came back" rather than guessing why is the honest report: the usual cause is a
     * prompt the model would not draw.
     */
    return { error: 'The model answered without an image. Reword the prompt and try again.' };
  }
  return { dataUri };
}

/** Split a data URI into its mime and bytes. Returns null when it is not one we can store. */
export function bytesFromDataUri(dataUri: string): { mime: string; bytes: Buffer } | null {
  const m = dataUri.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!m) return null;
  return { mime: m[1], bytes: Buffer.from(m[2], 'base64') };
}
