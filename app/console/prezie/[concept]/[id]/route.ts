/**
 * GET /console/prezie/[concept]/[id] — serve a prezie as the interactive touchscreen page
 * (D31). This is the UNLISTED URL the studio machine opens and performs to camera.
 *
 * Deliberately UNAUTHENTICATED, as the scene and deck routes before it: the studio machine
 * opens it with no console login in the shot, the prezie id is a uuid so the link is
 * unguessable, and a prezie is pre-publication marketing material (Marrs's call). Being a
 * Route Handler it also bypasses the /console layout's sign-in gate.
 *
 * The concept is in the path because prezies are stored nested under it, which keeps
 * listing one concept's versions a bounded read instead of a scan of every prezie.
 *
 * On pam.polynize.ai the middleware rewrite makes this /prezie/{concept}/{id}; on
 * www.polynize.ai it is /console/prezie/{concept}/{id}. Same route either way.
 */

import { getPrezie } from '@/lib/marketing/prezie-store';
import { renderScene } from '@/lib/marketing/scene';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ concept: string; id: string }> }
) {
  const { concept, id } = await params;
  const prezie = await getPrezie(concept, id);
  if (!prezie) {
    return new Response(
      `<!doctype html><meta charset="utf-8"><title>No prezie</title>
<body style="background:#0a0a0f;color:#f4ece4;font:16px/1.6 system-ui;display:grid;place-items:center;height:100vh;margin:0">
<p>That prezie is not here. Open it from the Prezie stage on the piece.</p></body>`,
      { status: 404, headers: { 'content-type': 'text/html; charset=utf-8' } }
    );
  }
  return new Response(renderScene(prezie.scene), {
    headers: {
      'content-type': 'text/html; charset=utf-8',
      // The performer may reload mid-shoot; never serve a stale prezie.
      'cache-control': 'no-store',
    },
  });
}
