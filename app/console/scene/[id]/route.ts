/**
 * GET /console/scene/[id] — serve a piece's SCENE as the interactive touchscreen page
 * (D31). This is the UNLISTED URL the studio machine opens and performs to camera.
 *
 * Deliberately UNAUTHENTICATED, for the same reasons as the deck route it replaces: the
 * studio computer opens it and performs with no console login in the shot, the piece id
 * is a uuid so the link is unguessable, and a scene is pre-publication marketing
 * material (Marrs's call). Being a Route Handler it also bypasses the /console layout's
 * sign-in gate.
 *
 * On pam.polynize.ai the middleware rewrite makes this reachable at /scene/{id}; on
 * www.polynize.ai it is /console/scene/{id}. Same route either way.
 */

import { getScene } from '@/lib/marketing/scene-store';
import { renderScene } from '@/lib/marketing/scene';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const scene = await getScene(id);
  if (!scene) {
    return new Response(
      `<!doctype html><meta charset="utf-8"><title>No scene</title>
<body style="background:#0a0a0f;color:#f4ece4;font:16px/1.6 system-ui;display:grid;place-items:center;height:100vh;margin:0">
<p>No scene built for this piece yet. Build it on the Screen Prompt stage.</p></body>`,
      { status: 404, headers: { 'content-type': 'text/html; charset=utf-8' } }
    );
  }
  return new Response(renderScene(scene), {
    headers: {
      'content-type': 'text/html; charset=utf-8',
      // The performer may reload mid-shoot; never serve a stale scene.
      'cache-control': 'no-store',
    },
  });
}
