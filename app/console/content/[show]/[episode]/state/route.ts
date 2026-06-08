/**
 * GET/PUT /content/<show>/<episode>/state — load and save the shoot-sheet blob.
 *
 * GET  -> the saved `state` json (or null if none yet).
 * PUT  -> upsert the posted `state` json into content_shoot_sheets.
 *
 * Token-guarded (header `x-sheet-token` or `?k=`). The storage key is derived
 * server-side from the route params, never from the request body.
 */

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { isKnownSheet } from '@/lib/content/sheets';
import { getSheetState, saveSheetState, slugFor } from '@/lib/content/shoot-sheet-store';
import { tokenOk, tokenFromRequest } from '@/lib/content/sheet-auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Generous ceiling: the full ep00 blob is a few KB. Reject anything wild.
const MAX_BYTES = 512 * 1024;

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ show: string; episode: string }> }
) {
  const { show, episode } = await params;
  if (!tokenOk(tokenFromRequest(req)))
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (!isKnownSheet(show, episode))
    return NextResponse.json({ error: 'not found' }, { status: 404 });

  try {
    const state = await getSheetState(slugFor(show, episode));
    return NextResponse.json(state ?? null, {
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
  { params }: { params: Promise<{ show: string; episode: string }> }
) {
  const { show, episode } = await params;
  if (!tokenOk(tokenFromRequest(req)))
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (!isKnownSheet(show, episode))
    return NextResponse.json({ error: 'not found' }, { status: 404 });

  const raw = await req.text();
  if (raw.length > MAX_BYTES)
    return NextResponse.json({ error: 'payload too large' }, { status: 413 });

  let state: unknown;
  try {
    state = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }
  if (typeof state !== 'object' || state === null || Array.isArray(state))
    return NextResponse.json({ error: 'state must be an object' }, { status: 400 });

  try {
    const { updated_at } = await saveSheetState(slugFor(show, episode), state);
    return NextResponse.json({ ok: true, updated_at });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'write failed' },
      { status: 500 }
    );
  }
}
