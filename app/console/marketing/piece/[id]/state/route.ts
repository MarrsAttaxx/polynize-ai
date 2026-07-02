/**
 * GET/PUT /console/marketing/piece/[id]/state — the Script screen's autosave.
 *
 * Team-scope only, session-authed (getCurrentUser). Owner is derived from the
 * session and the id from the route — never from the request body. Persists via
 * the Phase-1 interim piece store (content_shoot_sheets, owner-scoped key).
 */

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/console-auth';
import {
  getPiece,
  savePiece,
  isValidPiece,
  type MarketingPiece,
} from '@/lib/marketing/piece-store';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const MAX_BYTES = 512 * 1024;

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user || user.scope.type !== 'team') {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  try {
    const piece = await getPiece(user.email, id);
    return NextResponse.json(piece ?? null, {
      headers: { 'cache-control': 'no-store' },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'read failed' },
      { status: 500 }
    );
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user || user.scope.type !== 'team') {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const raw = await req.text();
  if (raw.length > MAX_BYTES) {
    return NextResponse.json({ error: 'payload too large' }, { status: 413 });
  }
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return NextResponse.json({ error: 'state must be an object' }, { status: 400 });
  }

  // Owner from the session, id from the route — not from the body.
  const piece = {
    ...(body as Record<string, unknown>),
    owner: user.email,
    piece_id: id,
  };

  // Reject partial pieces so a malformed row can never be persisted (which
  // would later crash the dashboard/teleprompter render on read).
  if (!isValidPiece(piece)) {
    return NextResponse.json(
      { error: 'piece is missing required fields (stream, format, title, script)' },
      { status: 400 }
    );
  }
  const valid: MarketingPiece = piece;

  try {
    const { updated_at } = await savePiece(user.email, valid);
    return NextResponse.json({ ok: true, updated_at });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'write failed' },
      { status: 500 }
    );
  }
}
