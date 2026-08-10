/**
 * Create an episode, and list the Descript projects it could be pointed at.
 *
 * Named `episodes/` rather than sitting on the podcast page itself so it cannot collide with the
 * `[id]` segment: a route handler at `podcast/route.ts` and a page at `podcast/page.tsx` can coexist,
 * but the POST target then reads as the same URL as the page, which is the kind of ambiguity that
 * gets refactored wrongly later.
 *
 * Team-scope only.
 */

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import { getCurrentUser } from '@/lib/console-auth';
import { saveEpisode, type PodcastEpisode } from '@/lib/marketing/podcast-store';
import { listProjects, isDescriptConfigured, DescriptError } from '@/lib/descript';
import { DEFAULT_STREAM } from '@/lib/marketing/streams';
import { stripEmDashes } from '@/lib/em-dash';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const NewSchema = z.object({
  number: z.string().trim().max(12).optional(),
  title: z.string().trim().min(1).max(200),
  guest: z.string().trim().max(120).optional(),
  stream: z.string().trim().min(1).max(60).optional(),
});

/** The Descript projects to choose from, so the operator never types a uuid. */
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.scope.type !== 'team') {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  if (!isDescriptConfigured()) {
    return NextResponse.json({ projects: [], connected: false });
  }
  const name = req.nextUrl.searchParams.get('name') ?? undefined;
  try {
    const projects = await listProjects({ name: name || undefined, limit: 40 });
    return NextResponse.json({ connected: true, projects });
  } catch (e) {
    const message =
      e instanceof DescriptError ? e.message : 'Could not reach Descript. Try again.';
    console.error('[podcast.episodes] project list failed:', e);
    return NextResponse.json({ error: message, projects: [] }, { status: 502 });
  }
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.scope.type !== 'team') {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  let body: z.infer<typeof NewSchema>;
  try {
    body = NewSchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: 'invalid request' }, { status: 400 });
  }

  const now = new Date().toISOString();
  const ep: PodcastEpisode = {
    episode_id: randomUUID(),
    owner: user.email,
    stream: body.stream || DEFAULT_STREAM,
    number: body.number,
    title: stripEmDashes(body.title),
    guest: body.guest ? stripEmDashes(body.guest) : undefined,
    clips: [],
    created_at: now,
  };

  try {
    await saveEpisode(ep);
  } catch (err) {
    console.error('[podcast.episodes] save failed:', err);
    return NextResponse.json({ error: 'could not save' }, { status: 502 });
  }
  return NextResponse.json({ ok: true, episode_id: ep.episode_id });
}
