/**
 * TEMPORARY: verify the expanded positions + brand colours render distinctly.
 * Returns two overlay URLs (upper + lower) to eyeball. No secrets. DELETE after.
 * GET /api/diagnostics/overlay
 */

import { NextResponse } from 'next/server';
import { renderAndHostOverlay } from '@/lib/marketing/text-overlay';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

const IMG = 'https://picsum.photos/seed/polynize-overlay/896/1152';

export async function GET() {
  const upper = await renderAndHostOverlay(IMG, {
    text: 'YOUR *CEO* NEEDS\nTO KNOW THIS',
    position: 'upper',
    baseColor: '#f4ece4', // cream
    highlightColor: '#ff7a6b', // coral
  });
  const lower = await renderAndHostOverlay(IMG, {
    text: 'STRIP THE *AI*\nOUT FIRST',
    position: 'lower',
    baseColor: '#ffffff',
    highlightColor: '#69fccb', // mint
  });
  return NextResponse.json({ upper, lower });
}
