/**
 * TEMPORARY: confirm the FIXED production path. Calls the real generateImages()
 * against the new Soul endpoint, base + with a completed Soul ID, to verify a
 * real image comes back (and the custom_reference_id param still applies) before
 * removing this. No secrets. DELETE after confirming.
 *
 * GET /api/diagnostics/soul-ep
 */

import { NextResponse } from 'next/server';
import { generateImages, listSoulIdentities } from '@/lib/marketing/higgsfield';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 300;

const ENDPOINT = '/higgsfield-ai/soul/standard';
const BASE = {
  prompt: 'a clean, natural-light studio portrait, sharp focus, neutral background',
  width_and_height: '1152x2048',
  quality: '1080p',
  batch_size: 1,
};

export async function GET() {
  let soulId: string | undefined;
  try {
    const souls = await listSoulIdentities();
    soulId = souls.find((s) => s.status === 'completed')?.id;
  } catch {
    /* ignore */
  }

  const base = await generateImages(ENDPOINT, { ...BASE });
  const withSoul = soulId
    ? await generateImages(ENDPOINT, { ...BASE, custom_reference_id: soulId })
    : 'no completed soul id';

  return NextResponse.json({ soulId: soulId ?? null, base, withSoul });
}
