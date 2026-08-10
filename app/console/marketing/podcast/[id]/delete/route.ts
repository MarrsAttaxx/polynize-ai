/**
 * Delete an episode.
 *
 * This removes the episode record and its clip proposals from the console. It does NOT touch anything
 * in Descript: the project, the source media and any compositions already cut stay exactly where they
 * are. That asymmetry is deliberate and is stated in the confirmation, because deleting a row here
 * must never be able to destroy an hour of uploaded video or a clip already finished.
 *
 * Team-scope only.
 */

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/lib/console-auth';
import { getEpisode, deleteEpisode } from '@/lib/marketing/podcast-store';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const Schema = z.object({
  /** The title, retyped. See below for why this is not just a boolean. */
  confirm: z.string().trim().max(200).optional(),
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user || user.scope.type !== 'team') {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  let body: z.infer<typeof Schema>;
  try {
    body = Schema.parse((await req.json().catch(() => ({}))) ?? {});
  } catch {
    return NextResponse.json({ error: 'invalid request' }, { status: 400 });
  }

  const ep = await getEpisode(user.email, id);
  // Already gone is a success, not an error: the operator wanted it gone and it is.
  if (!ep) return NextResponse.json({ ok: true, already: true });

  // A GUARD PROPORTIONAL TO WHAT IS LOST. An episode with approved or cut clips carries real
  // editorial work: hooks chosen, cuts ruled on, credits spent. So deleting one of those needs the
  // title retyped, while a bare episode (which is what Marrs is clearing out right now) needs only
  // the click.
  const invested = ep.clips.some((c) => c.status !== 'proposed');
  if (invested && body.confirm?.trim() !== ep.title.trim()) {
    return NextResponse.json(
      {
        error: `This episode has clips you have ruled on. Type its title to confirm: ${ep.title}`,
        needs_confirmation: true,
        title: ep.title,
      },
      { status: 409 }
    );
  }

  try {
    await deleteEpisode(user.email, id);
  } catch (err) {
    console.error('[podcast.delete] failed:', err);
    return NextResponse.json({ error: 'could not delete it' }, { status: 502 });
  }
  return NextResponse.json({ ok: true });
}
