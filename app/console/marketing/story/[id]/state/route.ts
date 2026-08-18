/**
 * PUT /console/marketing/story/[id]/state: the one write path for a story's
 * fields and gate moves (D40). Accepts a partial: article, gate, kit. The gate
 * value is validated against the real set; everything else is normalized by the
 * store, so a malformed payload can never persist a broken story.
 */

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/console-auth';
import { getStory, saveStory, type StoryGate } from '@/lib/marketing/story-store';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const GATES: StoryGate[] = [1, 2, 3, 4, 5, 'shipped'];

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user || user.scope.type !== 'team') {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as {
    article?: unknown;
    gate?: unknown;
    kit?: unknown;
  } | null;
  if (!body) return NextResponse.json({ error: 'invalid json' }, { status: 400 });

  let story;
  try {
    story = await getStory(id);
  } catch (err) {
    console.error('[story.state] read failed:', err);
    return NextResponse.json({ error: 'could not read the story' }, { status: 502 });
  }
  if (!story) return NextResponse.json({ error: 'story not found' }, { status: 404 });

  if (typeof body.article === 'string') story.article = body.article.slice(0, 40000);
  if (body.gate !== undefined) {
    if (!GATES.includes(body.gate as StoryGate)) {
      return NextResponse.json({ error: 'invalid gate' }, { status: 400 });
    }
    story.gate = body.gate as StoryGate;
  }
  if (Array.isArray(body.kit)) {
    story.kit = body.kit.filter((x): x is string => typeof x === 'string').slice(0, 40);
  }

  try {
    await saveStory(story);
    return NextResponse.json({ story });
  } catch (err) {
    console.error('[story.state] save failed:', err);
    return NextResponse.json({ error: 'save failed' }, { status: 500 });
  }
}
