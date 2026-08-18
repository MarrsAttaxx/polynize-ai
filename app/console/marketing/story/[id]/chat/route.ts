/**
 * POST /console/marketing/story/[id]/chat: one instruction to April (D40).
 *
 * She applies exactly the instruction to the article and the revised article is
 * saved before the response returns, so a reload after a chat edit never loses
 * the edit. The instruction is capped: gate 2 is an editing chat, not a place
 * to paste a new draft.
 */

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/console-auth';
import { getStory, saveStory } from '@/lib/marketing/story-store';
import { reviseArticle } from '@/lib/marketing/article-draft';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user || user.scope.type !== 'team') {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as { instruction?: unknown } | null;
  const instruction =
    typeof body?.instruction === 'string' ? body.instruction.trim().slice(0, 2000) : '';
  if (!instruction) {
    return NextResponse.json({ error: 'say what to change' }, { status: 400 });
  }

  let story;
  try {
    story = await getStory(id);
  } catch (err) {
    console.error('[story.chat] read failed:', err);
    return NextResponse.json({ error: 'could not read the story' }, { status: 502 });
  }
  if (!story) return NextResponse.json({ error: 'story not found' }, { status: 404 });
  if (!story.article.trim()) {
    return NextResponse.json({ error: 'no article to edit yet' }, { status: 400 });
  }

  try {
    const article = await reviseArticle(story.lane, story.article, instruction);
    story.article = article;
    await saveStory(story);
    return NextResponse.json({ article });
  } catch (err) {
    console.error('[story.chat] revise failed:', err);
    return NextResponse.json(
      { error: 'April is unavailable right now. Try again in a moment.' },
      { status: 502 }
    );
  }
}
