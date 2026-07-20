/**
 * The image-model registry for the console's Generate feature. This is the
 * "open to all Higgsfield models" seam: each entry maps a friendly model to a
 * Higgsfield endpoint + the shape of inputs it takes. Add a model by adding an
 * entry here; nothing else changes. (Higgsfield has no list-all-models API, so
 * the set we expose is curated here; Soul styles ARE fetched live at runtime.)
 */

export type SizingParam = 'aspect_ratio' | 'width_and_height';

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
};

export const IMAGE_MODELS: ImageModel[] = [
  {
    id: 'flux-kontext',
    label: 'FLUX Kontext',
    blurb: 'Best all-rounder for general post images, and renders text on the image well.',
    endpoint: 'flux-pro/kontext/max/text-to-image',
    sizing: 'aspect_ratio',
    goodForText: true,
  },
  {
    id: 'soul',
    label: 'Soul (photoreal)',
    blurb: 'Photoreal, aesthetic images of people. Attach a Soul ID for consistent shots of the same person.',
    endpoint: '/v1/text2image/soul',
    sizing: 'width_and_height',
    supportsSoulId: true,
    supportsReferenceImage: true,
    supportsStyle: true,
  },
];

export function imageModelById(id: string): ImageModel | undefined {
  return IMAGE_MODELS.find((m) => m.id === id);
}

/** Aspect-ratio options for `aspect_ratio` models (FLUX). */
export const ASPECT_RATIOS = ['9:16', '1:1', '4:5', '16:9', '3:4'] as const;

/** Size options for `width_and_height` models (Soul). Labelled for the UI. */
export const SOUL_SIZES: { id: string; label: string }[] = [
  { id: '1080x1920', label: 'Vertical 9:16' },
  { id: '1536x1536', label: 'Square 1:1' },
  { id: '1080x1350', label: 'Portrait 4:5' },
  { id: '1920x1080', label: 'Landscape 16:9' },
];
