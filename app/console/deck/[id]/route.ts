/**
 * GET /console/deck/[id] — serve a piece's DECK as a self-contained fullscreen page
 * (D29). This is the UNLISTED URL the studio machine opens and performs to camera.
 *
 * Deliberately UNAUTHENTICATED: the whole point is that the studio computer opens it
 * and presses play with no console login. The piece id is a uuid so the link is
 * unguessable, and a deck is pre-publication marketing material (Marrs's call). Being
 * a Route Handler it also bypasses the /console layout's sign-in gate.
 *
 * On pam.polynize.ai the middleware rewrite makes this reachable at /deck/{id};
 * on www.polynize.ai it is /console/deck/{id}. Same route either way.
 */

import { getDeck } from '@/lib/marketing/deck-store';
import { renderDeck } from '@/lib/marketing/deck';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const deck = await getDeck(id);
  if (!deck) {
    return new Response(
      `<!doctype html><meta charset="utf-8"><title>No deck</title>
<body style="background:#0a0a0f;color:#f4ece4;font:16px/1.6 system-ui;display:grid;place-items:center;height:100vh;margin:0">
<p>No deck for this piece. Decks are retired; the Interface stage builds the screen now.</p></body>`,
      { status: 404, headers: { 'content-type': 'text/html; charset=utf-8' } }
    );
  }
  return new Response(renderDeck(deck), {
    headers: {
      'content-type': 'text/html; charset=utf-8',
      // The performer may reload mid-shoot; never serve a stale deck.
      'cache-control': 'no-store',
    },
  });
}
