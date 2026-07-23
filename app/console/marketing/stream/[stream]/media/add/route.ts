/**
 * POST /console/marketing/stream/[stream]/media/add — register a media asset in
 * this stream's library. An asset is a REFERENCE to a file hosted elsewhere (a
 * Box.com live link, or any public direct-download URL); the console stores only
 * the URL + light metadata (D2 amended 2026-07-14). Team-scope only.
 */

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { getCurrentUser } from '@/lib/console-auth';
import { isStreamId } from '@/lib/marketing/streams';
import {
  saveMediaAsset,
  kindFromUrl,
  type MediaAsset,
  type MediaKind,
} from '@/lib/marketing/media-store';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const BodySchema = z.object({
  url: z.string().trim().min(1).max(2000),
  kind: z.enum(['image', 'video']).optional(),
  label: z.string().trim().max(200).optional(),
});

export async function POST(
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

  const raw = await req.json().catch(() => null);
  const result = BodySchema.safeParse(raw);
  if (!result.success) {
    // Say WHICH field failed so the user can act (the old generic "invalid
    // request" hid the real cause, usually pasting image data / a data: URI, or a
    // very long link, into the URL field).
    const issue = result.error.issues[0];
    const field = issue?.path[0];
    const msg =
      field === 'url'
        ? 'That link is not usable. Paste a direct URL to the file (under 2000 characters), not image data or a data: URI.'
        : field === 'label'
          ? 'The label is too long (max 200 characters).'
          : 'Paste a direct media URL and try again.';
    return NextResponse.json({ error: msg }, { status: 400 });
  }
  const body = result.data;

  // Must be a fetchable http(s) URL (Metricool pulls media by URL).
  let parsed: URL;
  try {
    parsed = new URL(body.url);
  } catch {
    return NextResponse.json({ error: 'that is not a valid URL' }, { status: 400 });
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    return NextResponse.json({ error: 'the URL must start with https://' }, { status: 400 });
  }
  // A Box preview link (/s/...) serves an HTML page, not the file. Point the user
  // at the Direct Link instead (it contains /shared/static/ and ends in the type).
  if (/box\.com\/s\//i.test(body.url)) {
    return NextResponse.json(
      {
        error:
          'That is a Box preview link. In Box, open the file’s Share settings and copy the Direct Link (it contains /shared/static/ and ends in the file type).',
      },
      { status: 400 }
    );
  }

  const kind: MediaKind | null = body.kind ?? kindFromUrl(body.url);
  if (!kind) {
    return NextResponse.json(
      { error: 'could not tell if this is an image or a video. Pick one from the menu.' },
      { status: 400 }
    );
  }

  let derivedLabel = parsed.pathname.split('/').filter(Boolean).pop() ?? '';
  try {
    derivedLabel = decodeURIComponent(derivedLabel);
  } catch {
    // keep the raw segment if it is not valid percent-encoding (a bare '%' in the
    // path would otherwise throw URIError and 500 the route)
  }
  const label =
    body.label && body.label.length > 0 ? body.label : derivedLabel || 'Untitled';

  const asset: MediaAsset = {
    media_id: crypto.randomUUID(),
    stream,
    owner: user.email,
    url: body.url,
    kind,
    label: label.slice(0, 200),
    source: /box\.com/i.test(parsed.hostname) ? 'box' : 'url',
    created_at: new Date().toISOString(),
  };

  try {
    await saveMediaAsset(asset);
  } catch (err) {
    console.error('[media.add] save failed:', err);
    return NextResponse.json({ error: 'could not save the media asset' }, { status: 500 });
  }
  // Refresh the stream home so its Media library count updates without a reload.
  revalidatePath(`/console/marketing/stream/${stream}`);
  return NextResponse.json({ ok: true, asset });
}
