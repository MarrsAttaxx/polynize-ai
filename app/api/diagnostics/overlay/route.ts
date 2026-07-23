/**
 * TEMPORARY: verify the deterministic text-overlay renders in the real runtime
 * (Satori + Space Grotesk font fetch + resvg + Higgsfield host) with Marrs's exact
 * spec. Returns the hosted URL to eyeball. No secrets. DELETE after confirming.
 *
 * GET /api/diagnostics/overlay
 */

import { NextResponse } from 'next/server';
import { renderAndHostOverlay } from '@/lib/marketing/text-overlay';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

export async function GET() {
  const res = await renderAndHostOverlay(
    'https://picsum.photos/seed/polynize-overlay/896/1152',
    {
      text: 'YOUR *CEO* NEEDS\nTO KNOW THIS',
      position: 'bottom',
      baseColor: '#ffffff',
      highlightColor: '#69fccb',
    }
  );
  return NextResponse.json(res);
}
