/**
 * The image-model registry for the console's Generate feature. This is the
 * "open to all Higgsfield models" seam: each entry maps a friendly model to a
 * Higgsfield endpoint + the shape of inputs it takes. Add a model by adding an
 * entry here; nothing else changes. (Higgsfield has no list-all-models API, so
 * the set we expose is curated here; Soul styles ARE fetched live at runtime.)
 */

export type SizingParam = 'aspect_ratio' | 'width_and_height';

/**
 * WHO GENERATES IT (D62). Higgsfield through their SDK, or OpenRouter through chat completions
 * with image output.
 *
 * Marrs: "What image model is being used for the images in the gate for the look section? It's
 * very inconsistent, especially in the text... there is a Nano Banana too, and in OpenRouter, its
 * Model ID is: google/gemini-3.1-flash-image"
 *
 * The two providers are genuinely different shapes, not one interface with a flag:
 *
 * - Higgsfield takes an exact `width_and_height` from a 13 value allow-list and a `batch_size`,
 *   so four candidates are ONE request.
 * - OpenRouter's image models expose NO size parameter at all. Verified against their public
 *   model list: `supported_parameters` for both Gemini image models is seed, temperature, top_p,
 *   max_tokens, reasoning and response_format, and nothing about dimensions. So the aspect is
 *   asked for in the prompt and then ENFORCED by cropping in code, and four candidates are four
 *   requests.
 */
export type ImageProvider = 'higgsfield' | 'openrouter';

export type ImageModel = {
  /** Stable id used in the UI + stored on a generation. */
  id: string;
  label: string;
  /** One-line "what it's best at", shown in the picker. */
  blurb: string;
  /** The Higgsfield endpoint the generation is submitted to. */
  endpoint: string;
  /** Which sizing param this model expects. */
  sizing: SizingParam;
  /** Whether it accepts a Soul ID (custom_reference_id) for a consistent person. */
  supportsSoulId?: boolean;
  /** Whether it accepts a one-off reference image. */
  supportsReferenceImage?: boolean;
  /** Whether it accepts a Soul style_id. */
  supportsStyle?: boolean;
  /** Renders text on the image well (for captioned/thumbnail work). */
  goodForText?: boolean;
  /** Defaults to higgsfield, so every entry written before D62 keeps working unchanged. */
  provider?: ImageProvider;
  /** Roughly, per generated image, for the line that says what a batch costs. */
  usdPerImage?: number;
};

/** Never read `model.provider` directly: an older entry does not set it. */
export function providerOf(model: ImageModel): ImageProvider {
  return model.provider ?? 'higgsfield';
}

export const IMAGE_MODELS: ImageModel[] = [
  {
    id: 'soul',
    label: 'Soul (photoreal)',
    blurb: 'Photoreal, aesthetic images of people. Attach a Soul ID for consistent shots of the same person.',
    // The current generation endpoint (the old /v1/text2image/soul is retired and
    // returns "Unavailable model"). Flat body, polled via /requests/{id}/status.
    endpoint: '/higgsfield-ai/soul/standard',
    sizing: 'width_and_height',
    supportsSoulId: true,
    supportsReferenceImage: true,
    supportsStyle: true,
  },
  /**
   * NANO BANANA 2, the id Marrs supplied and the model he asked for.
   *
   * BOTH IDS HERE WERE VERIFIED against OpenRouter's public model list rather than trusted from
   * memory, which mattered: `image-edit.ts` carries a note saying "the 3.x image previews 404 on
   * this account's OpenRouter access", and that note is about the PREVIEW ids. The GA ids are
   * real and separate, and the list names this one "Nano Banana 2 (Gemini 3.1 Flash Image)".
   *
   * WHY IT IS WORTH ADDING. Soul is photoreal-people only and cannot spell, which is why every
   * prompt in this console ends with "no text, no words, no letters" and why all brand type is
   * composited in code. Marrs is hitting exactly that limit on a 1882 New York street scene,
   * where the reference material is covered in signage so the model paints lettering anyway and
   * it comes out as gibberish. A Gemini image model renders text properly and handles diagrams
   * and infographics, which Soul cannot do at all.
   */
  {
    id: 'nano-banana-2',
    label: 'Nano Banana 2 (Gemini 3.1 Flash Image)',
    blurb:
      'Renders legible text, diagrams and infographics as well as photographs. Slower per image than Soul and one image per request, but it can do the things Soul cannot.',
    endpoint: 'google/gemini-3.1-flash-image',
    provider: 'openrouter',
    // No size parameter exists on this provider, so the aspect is prompted and then cropped.
    sizing: 'aspect_ratio',
    supportsReferenceImage: true,
    goodForText: true,
    usdPerImage: 0.00006,
  },
  {
    id: 'nano-banana-pro',
    label: 'Nano Banana Pro (Gemini 3 Pro Image)',
    blurb:
      'The stronger of the two Gemini image models, at twice the price. Reach for it when the text or the diagram has to be right first time.',
    endpoint: 'google/gemini-3-pro-image',
    provider: 'openrouter',
    sizing: 'aspect_ratio',
    supportsReferenceImage: true,
    goodForText: true,
    usdPerImage: 0.00012,
  },
  // FLUX Kontext (general images + text-on-image) is intentionally NOT listed
  // yet: `flux-pro/kontext/max/text-to-image` 404s against platform.higgsfield.ai
  // (Soul's confirmed path is `/v1/text2image/soul`, so FLUX likely lives under a
  // `/v1/...` route too). Re-add here with the verified endpoint once confirmed
  // from Higgsfield's docs, the registry is the only thing that needs the change.
];

/**
 * WHAT A SCREEN USES WHEN NOBODY HAS CHOSEN (D62). Soul, because it is the model every existing
 * prompt in this console was written for, and because a default that changes under people is worse
 * than an old default. Change this deliberately, not as a side effect of adding a model.
 */
export const DEFAULT_IMAGE_MODEL = 'soul';

export function imageModelById(id: string): ImageModel | undefined {
  return IMAGE_MODELS.find((m) => m.id === id);
}

/** Aspect-ratio options for `aspect_ratio` models (FLUX Kontext's supported enum). */
export const ASPECT_RATIOS = ['9:16', '1:1', '16:9', '4:3', '3:4'] as const;

/**
 * Size options offered for `width_and_height` models (Soul). Every value MUST be one of
 * Higgsfield's own SoulSize values, because the API rejects anything else.
 *
 * THIS IS A CURATED SUBSET, NOT THE ALLOW-LIST. The SDK's SoulSize has 13 entries; these are the
 * ones worth offering. That distinction cost something once already: the four listed here were
 * read as the whole allow-list, so 4:3 looked impossible and a crop looked like the only way to
 * get one, when `2048x1536` was sitting in the enum the whole time. When a shape is missing,
 * check `SoulSize` in @higgsfield/client before concluding it cannot be generated.
 *
 * 1152x2048 is a true 9:16.
 */
export const SOUL_SIZES: { id: string; label: string }[] = [
  { id: '1152x2048', label: 'Vertical 9:16' },
  { id: '1536x2048', label: 'Portrait 3:4' },
  { id: '1536x1536', label: 'Square 1:1' },
  { id: '2048x1536', label: 'Landscape 4:3' },
  { id: '2048x1152', label: 'Landscape 16:9' },
];
