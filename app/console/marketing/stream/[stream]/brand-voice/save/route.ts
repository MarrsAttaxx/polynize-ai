/**
 * PUT /console/marketing/stream/[stream]/brand-voice/save — save a stream's
 * brand-voice doc (D20). Team-scope only, session-authed. The stream comes from
 * the route (validated against the known streams), the Markdown from the body.
 */

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { getCurrentUser } from '@/lib/console-auth';
import { isStreamId } from '@/lib/marketing/streams';
import { saveBrandVoiceForStream } from '@/lib/marketing/brand-voice-store';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const MAX_BYTES = 256 * 1024;

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ stream: string }> }
) {
  const { stream } = await params;
  const user = await getCurrentUser();
  if (!user || user.scope.type !== 'team') {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  if (!isStreamId(stream)) {
    return NextResponse.json({ error: 'unknown stream' }, { status: 400 });
  }

  const raw = await req.text();
  if (raw.length > MAX_BYTES) {
    return NextResponse.json({ error: 'payload too large' }, { status: 413 });
  }
  let md: unknown;
  try {
    md = (JSON.parse(raw) as { md?: unknown }).md;
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }
  if (typeof md !== 'string') {
    return NextResponse.json({ error: 'md must be a string' }, { status: 400 });
  }

  try {
    await saveBrandVoiceForStream(stream, md);
    // Refresh the stream home so its Brand voice card reflects the new state
    // without a manual reload.
    revalidatePath(`/console/marketing/stream/${stream}`);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[brand-voice.save] write failed:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'write failed' },
      { status: 500 }
    );
  }
}
