/**
 * POST /console/marketing/story/create: Gate 1's decision (D40).
 *
 * Takes the idea and the lane, creates the Story at gate 2, and marks the inbox
 * idea used when it came from there. The article is NOT drafted here: gate 2
 * drafts it on first view, so this route stays fast and the operator lands on
 * the article screen watching it being written rather than staring at a spinner
 * on the ideas screen.
 */

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/console-auth';
import { createStory, saveStory, isStoryLane } from '@/lib/marketing/story-store';
import { updateIdea } from '@/lib/marketing/idea-store';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.scope.type !== 'team') {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as {
    lane?: unknown;
    idea?: unknown;
    idea_ref?: unknown;
  } | null;
  const lane = body?.lane;
  const idea = typeof body?.idea === 'string' ? body.idea.trim().slice(0, 4000) : '';
  const ideaRef = typeof body?.idea_ref === 'string' ? body.idea_ref : undefined;

  if (!isStoryLane(lane)) {
    return NextResponse.json({ error: 'pick a lane' }, { status: 400 });
  }
  if (!idea) {
    return NextResponse.json({ error: 'pick or type an idea' }, { status: 400 });
  }

  try {
    const story = await createStory(lane, idea, ideaRef);
    // Straight to gate 2: gate 1's decision is made the moment this route runs.
    story.gate = 2;
    await saveStory(story);
    // Best effort: a spent idea leaves the chooser. Losing this write costs a
    // duplicate option later, never the story.
    if (ideaRef) {
      void updateIdea(lane, ideaRef, { used_at: new Date().toISOString() }).catch(() => {});
    }
    return NextResponse.json({ id: story.id });
  } catch (err) {
    console.error('[story.create] failed:', err);
    return NextResponse.json({ error: 'could not create the story' }, { status: 500 });
  }
}
