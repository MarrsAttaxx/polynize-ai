/**
 * BRING A FINISHED CLIP BACK INTO THE CONSOLE, so it can be scheduled and posted.
 *
 * Marrs, after cutting one by hand: "how do I bring that back into the engine in order to post that and
 * schedule it?" This is that step, and it deliberately joins two halves that already work rather than
 * building a third publishing path: the clip becomes an ordinary MARKETING PIECE with an ordinary MEDIA
 * ASSET attached, so the calendar and the Metricool tail need no knowledge of podcasts at all.
 *
 * POST  render the composition in Descript and start the job.
 * GET   poll it; on success, copy the file into our storage, add it to the media library, and create the
 *       piece.
 *
 * THE ONE DESIGN DECISION THAT MATTERS. Descript's `download_url` is a SIGNED, EXPIRING link, and
 * `publish.ts` fetches media BY URL at publish time, which can be days after scheduling. Referencing the
 * Descript url would therefore produce posts that die silently between being scheduled and going out. So
 * the bytes are copied into our own bucket and served from `/console/clip-media/...`, which is permanent.
 *
 * Team-scope only.
 */

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import { getCurrentUser } from '@/lib/console-auth';
import {
  getEpisode,
  saveEpisode,
  withClip,
  clipAsProse,
  clipMediaKey,
  clipMediaUrl,
  type ClipProposal,
} from '@/lib/marketing/podcast-store';
import {
  startPublishJob,
  getJob,
  jobOutcome,
  downloadRendered,
  DescriptError,
} from '@/lib/descript';
import { putObject, isBucketConfigured } from '@/lib/agents/bucket';
import { saveMediaAsset } from '@/lib/marketing/media-store';
import { savePiece, type MarketingPiece } from '@/lib/marketing/piece-store';
import { stripEmDashes } from '@/lib/em-dash';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 300;

const Schema = z.object({ clip_id: z.string().trim().min(1).max(200) });

async function load(owner: string, id: string, clipId: string) {
  const ep = await getEpisode(owner, id);
  if (!ep) return { error: NextResponse.json({ error: 'episode not found' }, { status: 404 }) };
  const clip = ep.clips.find((c) => c.clip_id === clipId);
  if (!clip) {
    return { error: NextResponse.json({ error: 'That clip is gone. Reload.' }, { status: 409 }) };
  }
  return { ep, clip };
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

  const found = await load(user.email, id, body.clip_id);
  if ('error' in found) return found.error;
  const { ep, clip } = found;

  if (!isBucketConfigured()) {
    return NextResponse.json(
      { error: 'Storage is not configured, so the render cannot be kept anywhere permanent.' },
      { status: 503 }
    );
  }
  if (!ep.descript_project_id || !clip.descript_composition_id) {
    return NextResponse.json(
      { error: 'This clip has not been cut yet, so there is nothing to render.' },
      { status: 400 }
    );
  }
  if (clip.status === 'assembling') {
    return NextResponse.json(
      { error: 'Descript is still working on that one. Wait for it to finish.' },
      { status: 409 }
    );
  }
  // A stale cut would render the OLD video, which is the one thing worse than not rendering at all.
  if (clip.recut_needed) {
    return NextResponse.json(
      { error: 'This clip changed since it was cut, so cut it again before rendering it.' },
      { status: 409 }
    );
  }

  try {
    const started = await startPublishJob({
      projectId: ep.descript_project_id,
      compositionId: clip.descript_composition_id,
      resolution: '1080p',
    });
    const updated = withClip(ep, {
      ...clip,
      status: 'assembling',
      stage: 'rendering',
      job_id: started.job_id,
      render: { ...(clip.render ?? {}), job_id: started.job_id, error: undefined },
    });
    await saveEpisode(updated);
    return NextResponse.json({ ok: true, job_id: started.job_id, clips: updated.clips });
  } catch (e) {
    const message = e instanceof DescriptError ? e.message : 'Descript would not render that.';
    console.error('[podcast.render] start failed:', e);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

/** Poll the render; on success, do the whole bring-it-in in one pass. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user || user.scope.type !== 'team') {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const clipId = req.nextUrl.searchParams.get('clip_id') ?? '';
  const found = await load(user.email, id, clipId);
  if ('error' in found) return found.error;
  const { ep, clip } = found;

  const jobId = clip.render?.job_id;
  if (!jobId) return NextResponse.json({ ok: true, state: 'idle', clips: ep.clips });

  let job;
  try {
    job = await getJob(jobId);
  } catch (e) {
    console.error('[podcast.render] poll failed:', e);
    // A failed poll is not a failed render. Reporting it as still running means the next tick retries
    // rather than throwing away a render that is probably finishing.
    return NextResponse.json({ ok: true, state: 'rendering', clips: ep.clips });
  }

  const outcome = jobOutcome(job);
  if (outcome === 'running') {
    return NextResponse.json({ ok: true, state: 'rendering', clips: ep.clips });
  }

  if (outcome !== 'done') {
    const updated = withClip(ep, {
      ...clip,
      status: 'assembled',
      stage: undefined,
      job_id: undefined,
      render: {
        ...(clip.render ?? {}),
        job_id: undefined,
        error:
          outcome === 'cancelled'
            ? 'That render was cancelled in Descript.'
            : typeof job.result?.message === 'string'
              ? job.result.message
              : 'Descript could not render that clip.',
      },
    });
    await saveEpisode(updated).catch(() => {});
    return NextResponse.json({
      ok: true,
      state: 'failed',
      error: updated.clips.find((c) => c.clip_id === clip.clip_id)?.render?.error,
      clips: updated.clips,
    });
  }

  const downloadUrl = job.result?.download_url;
  if (typeof downloadUrl !== 'string' || !downloadUrl) {
    const updated = withClip(ep, {
      ...clip,
      status: 'assembled',
      stage: undefined,
      job_id: undefined,
      render: {
        ...(clip.render ?? {}),
        job_id: undefined,
        share_url: typeof job.result?.share_url === 'string' ? job.result.share_url : undefined,
        error: 'Descript rendered it but returned no download link. Try rendering again.',
      },
    });
    await saveEpisode(updated).catch(() => {});
    return NextResponse.json({ ok: true, state: 'failed', clips: updated.clips }, { status: 502 });
  }

  // ---- The bring-it-in, in order, each step failing loudly rather than half-completing ----
  const mediaId = clip.render?.media_id ?? randomUUID();
  let bytes: Uint8Array;
  let contentType: string;
  try {
    const file = await downloadRendered(downloadUrl);
    bytes = file.bytes;
    contentType = file.contentType;
  } catch (e) {
    const message = e instanceof DescriptError ? e.message : 'Could not download the render.';
    console.error('[podcast.render] download failed:', e);
    const updated = withClip(ep, {
      ...clip,
      status: 'assembled',
      stage: undefined,
      job_id: undefined,
      render: { ...(clip.render ?? {}), job_id: undefined, error: message },
    });
    await saveEpisode(updated).catch(() => {});
    return NextResponse.json({ ok: true, state: 'failed', error: message, clips: updated.clips });
  }

  try {
    await putObject(clipMediaKey(ep.stream, mediaId), bytes, contentType || 'video/mp4');
  } catch (e) {
    console.error('[podcast.render] store failed:', e);
    const message = 'Rendered it, but storing the file failed. Try again.';
    const updated = withClip(ep, {
      ...clip,
      status: 'assembled',
      stage: undefined,
      job_id: undefined,
      render: { ...(clip.render ?? {}), job_id: undefined, error: message },
    });
    await saveEpisode(updated).catch(() => {});
    return NextResponse.json({ ok: true, state: 'failed', error: message, clips: updated.clips });
  }

  const url = clipMediaUrl(ep.stream, mediaId);
  const now = new Date().toISOString();
  const label = stripEmDashes(clip.title).slice(0, 120);

  // THE MEDIA LIBRARY ASSET. `source: 'url'` because it is served from a url we own, which is exactly
  // what an external asset looks like to everything downstream. No special case is introduced.
  try {
    await saveMediaAsset({
      media_id: mediaId,
      stream: ep.stream,
      owner: user.email,
      url,
      kind: 'video',
      label,
      source: 'url',
      created_at: now,
    });
  } catch (e) {
    console.error('[podcast.render] media asset failed:', e);
  }

  // THE PIECE, so the clip enters the pipeline that already exists rather than a parallel one. The
  // prose body is the clip's own words in play order, which is the honest starting point for a caption
  // and is what he reviewed and approved.
  const prose = clipAsProse(clip);
  const pieceId = clip.piece_id ?? randomUUID();
  const piece: MarketingPiece = {
    piece_id: pieceId,
    owner: user.email,
    stream: ep.stream,
    format: 'podcast_clip',
    kind: 'video',
    title: label,
    // The shot list is already cut, so the script carries what is SAID, for reference and for captions.
    script: stripEmDashes([prose.hook, prose.body].filter(Boolean).join('\n\n')),
    body: stripEmDashes(clip.theme || clip.why_strong || ''),
    stage: 'approve',
    status: 'approved',
    provenance: 'human_capture',
    platforms: clip.platforms?.length ? clip.platforms : ['tiktok', 'instagram', 'youtube'],
    media: [mediaId],
    updated_at: now,
  };
  try {
    await savePiece(user.email, piece);
  } catch (e) {
    console.error('[podcast.render] piece failed:', e);
    const message = 'Rendered and stored the video, but creating the piece failed. Try again.';
    const updated = withClip(ep, {
      ...clip,
      status: 'assembled',
      stage: undefined,
      job_id: undefined,
      render: { ...(clip.render ?? {}), job_id: undefined, url, media_id: mediaId, error: message },
    });
    await saveEpisode(updated).catch(() => {});
    return NextResponse.json({ ok: true, state: 'failed', error: message, clips: updated.clips });
  }

  const next: ClipProposal = {
    ...clip,
    status: 'assembled',
    stage: undefined,
    job_id: undefined,
    piece_id: pieceId,
    render: {
      job_id: undefined,
      share_url: typeof job.result?.share_url === 'string' ? job.result.share_url : undefined,
      url,
      bytes: bytes.byteLength,
      media_id: mediaId,
      rendered_at: now,
      error: undefined,
    },
  };
  const updated = withClip(ep, next);
  await saveEpisode(updated).catch((err) =>
    console.error('[podcast.render] final save failed:', err)
  );

  return NextResponse.json({
    ok: true,
    state: 'ready',
    piece_id: pieceId,
    piece_url: `/console/marketing/piece/${pieceId}`,
    megabytes: Math.round((bytes.byteLength / 1024 / 1024) * 10) / 10,
    clips: updated.clips,
  });
}
