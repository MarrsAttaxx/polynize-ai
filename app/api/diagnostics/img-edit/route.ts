/**
 * TEMPORARY: confirm the FULL image-edit production path end-to-end — OpenRouter
 * Nano Banana edit -> base64 -> upload to Higgsfield CDN -> hosted URL — by calling
 * the real editImage() with a public test image. No secrets. DELETE after confirming.
 *
 * GET /api/diagnostics/img-edit
 */

import { NextResponse } from 'next/server';
import { editImage, isImageEditConfigured } from '@/lib/marketing/image-edit';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 120;

export async function GET() {
  const configured = isImageEditConfigured();
  const res = await editImage(
    'https://picsum.photos/seed/polynize-test/768/768',
    'Add the large, bold, white text "POLYNIZE" across the top center of this image. Keep everything else the same.'
  );
  return NextResponse.json({ configured, ...res });
}
