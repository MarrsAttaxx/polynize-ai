/**
 * GET /content/<show>/<episode>  (served on pam.polynize.ai via the middleware
 * rewrite to /console/content/<show>/<episode>).
 *
 * Returns the standalone shoot-sheet HTML verbatim. This is a Route Handler, not
 * a page, so it bypasses the console layout entirely: no sign-in gate, no chrome,
 * the document renders exactly as authored. Persistence is baked into the HTML
 * (autosave to ./state). Access is guarded by the shared token (?k=...).
 */

import type { NextRequest } from 'next/server';
import { getSheetHtml } from '@/lib/content/sheets';
import { tokenOk, tokenFromRequest } from '@/lib/content/sheet-auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function unauthorizedHtml(): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Shoot sheet</title><style>body{background:#0f0f17;color:#c7b9ac;font-family:ui-monospace,Menlo,monospace;display:flex;min-height:100vh;align-items:center;justify-content:center;margin:0;padding:24px;text-align:center;line-height:1.6}b{color:#4de8a0}</style></head><body><div>This shoot sheet needs a key.<br>Open it as <b>/content/&lt;show&gt;/&lt;episode&gt;?k=YOUR_TOKEN</b></div></body></html>`;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ show: string; episode: string }> }
) {
  const { show, episode } = await params;

  const html = getSheetHtml(show, episode);
  if (!html) {
    return new Response('Shoot sheet not found', { status: 404 });
  }

  if (!tokenOk(tokenFromRequest(req))) {
    return new Response(unauthorizedHtml(), {
      status: 401,
      headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' },
    });
  }

  return new Response(html, {
    status: 200,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'no-store',
    },
  });
}
