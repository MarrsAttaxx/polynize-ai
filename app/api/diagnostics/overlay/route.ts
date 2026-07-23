/**
 * TEMPORARY: verify size + horizontal alignment render. Returns two URLs:
 * large/top/right and small/bottom/left. No secrets. DELETE after.
 * GET /api/diagnostics/overlay
 */

import { NextResponse } from 'next/server';
import { renderAndHostOverlay } from '@/lib/marketing/text-overlay';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

const IMG = 'https://picsum.photos/seed/polynize-overlay/896/1152';

export async function GET() {
  const largeTopRight = await renderAndHostOverlay(IMG, {
    text: 'YOUR *CEO* NEEDS\nTO KNOW THIS',
    position: 'top',
    hAlign: 'right',
    size: 'large',
    baseColor: '#ffffff',
    highlightColor: '#69fccb',
  });
  const smallBottomLeft = await renderAndHostOverlay(IMG, {
    text: 'STRIP THE *AI*\nOUT FIRST',
    position: 'bottom',
    hAlign: 'left',
    size: 'small',
    baseColor: '#f4ece4',
    highlightColor: '#ff7a6b',
  });
  return NextResponse.json({ largeTopRight, smallBottomLeft });
}
