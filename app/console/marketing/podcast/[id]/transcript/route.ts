/**
 * The episode's TRANSCRIPT, which is the only input the whole clip method needs.
 *
 * Two ways in, and both are first-class:
 *
 * - PULL from Descript, which is the real path: the transcript comes with the `[HH:MM:SS]` paragraph
 *   anchors the EDL depends on, and pointing at the project also records where the media lives so
 *   the cut can be executed later.
 * - PASTE, which exists because the editorial half is the valuable half and must not be blocked on an
 *   upload. A 56-minute episode takes half an hour to land in Descript; if Marrs has a transcript in
 *   hand he can have clip proposals before that finishes.
 *
 * Team-scope only.
 */

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/lib/console-auth';
import { getEpisode, saveEpisode } from '@/lib/marketing/podcast-store';
import { exportTranscript, getProject, DescriptError } from '@/lib/descript';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 300;

const Schema = z.object({
  /** Paste path. */
  transcript: z.string().max(1_500_000).optional(),
  /** Pull path. */
  descript_project_id: z.string().trim().max(120).optional(),
  descript_composition_id: z.string().trim().max(120).optional(),
  /**
   * The export is already composed so a centre crop to 9:16 keeps both speakers.
   *
   * Set here rather than inferred, because it CANNOT be inferred: a landscape frame gives no clue
   * whether its subjects were deliberately placed for a vertical crop. It is a statement about the
   * export, and only the person who made the export knows it.
   */
  pre_framed: z.boolean().optional(),
  /** The house standard for every clip cut from this episode. Saved on its own, like pre_framed. */
  style: z
    .object({
      title_seconds: z.number().int().min(0).max(15),
      title_pt: z.number().int().min(24).max(300).optional(),
      captions: z.boolean(),
      caption_pt: z.number().int().min(16).max(200).optional(),
      caption_template: z.string().trim().max(120).optional(),
      music_file: z.string().trim().max(200).optional(),
      music_gain_db: z.number().min(-60).max(0).optional(),
      remove_filler: z.boolean(),
      remove_silences: z.boolean(),
    })
    .optional(),
});

/** How many anchors the transcript actually carries. Zero means the EDL cannot be built. */
function countAnchors(text: string): number {
  return (text.match(/(\d{1,2}:)?\d{1,2}:\d{2}/g) ?? []).length;
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user || user.scope.type !== 'team') {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  let body: z.infer<typeof Schema>;
  try {
    body = Schema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: 'invalid request' }, { status: 400 });
  }

  const ep = await getEpisode(user.email, id);
  if (!ep) return NextResponse.json({ error: 'episode not found' }, { status: 404 });

  // Settings can be saved on their own, without touching the transcript.
  if ((body.pre_framed !== undefined || body.style) && !body.transcript && !body.descript_project_id) {
    await saveEpisode({
      ...ep,
      pre_framed: body.pre_framed ?? ep.pre_framed,
      style: body.style ? { ...(ep.style ?? {}), ...body.style } : ep.style,
      updated_at: new Date().toISOString(),
    });
    return NextResponse.json({ ok: true, pre_framed: body.pre_framed ?? ep.pre_framed });
  }

  let transcript = (body.transcript ?? '').trim();
  let source: 'pasted' | 'descript' = 'pasted';
  const projectId = body.descript_project_id ?? ep.descript_project_id;
  let compositionId = body.descript_composition_id ?? ep.descript_composition_id;

  if (!transcript) {
    if (!projectId) {
      return NextResponse.json(
        { error: 'Choose a Descript project, or paste a transcript.' },
        { status: 400 }
      );
    }
    try {
      // The composition is resolved rather than assumed: an episode project usually has exactly one,
      // but if the operator has already started cutting clips there will be several, and exporting
      // the wrong one would produce a transcript of a 30-second clip.
      if (!compositionId) {
        const detail = await getProject(projectId);
        const longest = (detail.compositions ?? [])
          .slice()
          .sort((a, b) => (b.duration ?? 0) - (a.duration ?? 0))[0];
        compositionId = longest?.id;
      }
      transcript = (await exportTranscript(projectId, compositionId)).trim();
      source = 'descript';
    } catch (e) {
      const message =
        e instanceof DescriptError
          ? e.message
          : 'Could not get the transcript from Descript. Try again.';
      console.error('[podcast.transcript] pull failed:', e);
      return NextResponse.json({ error: message }, { status: 502 });
    }
  }

  if (transcript.length < 400) {
    return NextResponse.json(
      {
        error:
          source === 'descript'
            ? 'Descript returned almost nothing. The episode may still be transcribing; give it a few minutes.'
            : 'That is too short to find clips in.',
      },
      { status: 400 }
    );
  }

  const anchors = countAnchors(transcript);
  await saveEpisode({
    ...ep,
    pre_framed: body.pre_framed ?? ep.pre_framed,
    descript_project_id: projectId,
    descript_composition_id: compositionId,
    transcript,
    transcript_source: source,
    transcript_chars: transcript.length,
    updated_at: new Date().toISOString(),
  });

  return NextResponse.json({
    ok: true,
    source,
    chars: transcript.length,
    anchors,
    // Surfaced rather than swallowed: without timecodes the proposals cannot be assembled, and it is
    // far better to say so now than to let him approve eight clips that cannot be cut.
    warning:
      anchors < 5
        ? 'This transcript has almost no timecodes in it. Clips can still be proposed, but they cannot be cut automatically without anchors.'
        : undefined,
  });
}
