/**
 * One CLIP: rule on it, cut it, or check on the cut.
 *
 * PATCH  approve / reject / retitle / note. Costs nothing and no LLM call.
 * POST   send the approved EDL to Descript's agent to be cut.
 * GET    poll the running job.
 *
 * WHY A JOB HAS TO BE POLLED RATHER THAN AWAITED. A Descript agent cut takes minutes and outlives the
 * request that started it. If the job id were not persisted, a page reload during assembly would
 * orphan a cut that is running and being paid for, and the operator would have no way to find it. So
 * POST records the job and returns, and GET is how the answer arrives.
 *
 * Team-scope only.
 */

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/lib/console-auth';
import {
  getEpisode,
  saveEpisode,
  withClip,
  type ClipProposal,
} from '@/lib/marketing/podcast-store';
import { assemblyPrompt, readAssemblyReport } from '@/lib/marketing/podcast-clips';
import { startAgentJob, getJob, jobOutcome, DescriptError } from '@/lib/descript';
import { stripEmDashes } from '@/lib/em-dash';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 300;

const PatchSchema = z.object({
  clip_id: z.string().trim().min(1).max(200),
  status: z.enum(['proposed', 'approved', 'rejected']).optional(),
  title: z.string().trim().max(200).optional(),
  operator_note: z.string().trim().max(2000).optional(),
});

const AssembleSchema = z.object({ clip_id: z.string().trim().min(1).max(200) });

async function load(owner: string, id: string, clipId: string) {
  const ep = await getEpisode(owner, id);
  if (!ep) {
    return { error: NextResponse.json({ error: 'episode not found' }, { status: 404 }) };
  }
  const clip = ep.clips.find((c) => c.clip_id === clipId);
  if (!clip) {
    return { error: NextResponse.json({ error: 'That clip is gone. Reload.' }, { status: 409 }) };
  }
  return { ep, clip };
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user || user.scope.type !== 'team') {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  let body: z.infer<typeof PatchSchema>;
  try {
    body = PatchSchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: 'invalid request' }, { status: 400 });
  }

  const found = await load(user.email, id, body.clip_id);
  if ('error' in found) return found.error;
  const { ep, clip } = found;

  // A clip already cut cannot be un-approved back into a proposal: the composition exists in
  // Descript either way, and pretending otherwise loses the link to it.
  if (body.status && clip.status === 'assembled' && body.status !== 'approved') {
    return NextResponse.json(
      { error: 'That clip is already cut. Delete the composition in Descript if you want it gone.' },
      { status: 409 }
    );
  }

  const next: ClipProposal = {
    ...clip,
    status: body.status ?? clip.status,
    title: body.title ? stripEmDashes(body.title) : clip.title,
    operator_note:
      body.operator_note !== undefined
        ? stripEmDashes(body.operator_note) || undefined
        : clip.operator_note,
  };

  const updated = withClip(ep, next);
  try {
    await saveEpisode(updated);
  } catch (err) {
    console.error('[podcast.clip] save failed:', err);
    return NextResponse.json({ error: 'could not save' }, { status: 502 });
  }
  return NextResponse.json({ ok: true, clips: updated.clips });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user || user.scope.type !== 'team') {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  let body: z.infer<typeof AssembleSchema>;
  try {
    body = AssembleSchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: 'invalid request' }, { status: 400 });
  }

  const found = await load(user.email, id, body.clip_id);
  if ('error' in found) return found.error;
  const { ep, clip } = found;

  if (!ep.descript_project_id) {
    return NextResponse.json(
      { error: 'This episode is not pointed at a Descript project, so there is nothing to cut.' },
      { status: 400 }
    );
  }
  if (clip.status === 'assembling') {
    return NextResponse.json({ error: 'That cut is already running.' }, { status: 409 });
  }
  // Cutting costs Descript credits (about 34 per clip), so it is gated on an explicit approval
  // rather than being available from a proposal card.
  if (clip.status !== 'approved') {
    return NextResponse.json({ error: 'Approve the clip first.' }, { status: 400 });
  }
  if (!clip.edl.some((s) => s.at)) {
    return NextResponse.json(
      { error: 'This clip has no timecodes, so Descript cannot find the spans. Re-pull the transcript.' },
      { status: 400 }
    );
  }

  const episodeLabel = ep.number ? `${ep.title} (Episode ${ep.number})` : ep.title;
  try {
    const started = await startAgentJob({
      projectId: ep.descript_project_id,
      compositionId: ep.descript_composition_id,
      prompt: assemblyPrompt(clip, episodeLabel),
    });
    const updated = withClip(ep, {
      ...clip,
      status: 'assembling',
      job_id: started.job_id,
      descript_url: started.project_url,
      assembly_error: undefined,
    });
    await saveEpisode(updated);
    return NextResponse.json({ ok: true, job_id: started.job_id, clips: updated.clips });
  } catch (e) {
    const message = e instanceof DescriptError ? e.message : 'Descript would not take the cut.';
    console.error('[podcast.clip] assemble failed:', e);
    // The failure is recorded on the clip, not just returned, so it survives a reload and he is not
    // left wondering whether it half-ran.
    const updated = withClip(ep, { ...clip, status: 'approved', assembly_error: message });
    await saveEpisode(updated).catch(() => {});
    return NextResponse.json({ error: message, clips: updated.clips }, { status: 502 });
  }
}

/** Poll one running cut. */
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

  if (!clip.job_id) return NextResponse.json({ ok: true, state: clip.status, clips: ep.clips });

  let job;
  try {
    job = await getJob(clip.job_id);
  } catch (e) {
    console.error('[podcast.clip] poll failed:', e);
    // A failed poll is NOT a failed job. Reporting it as still running is the safe reading: the cut
    // may well be finishing, and marking it failed would strand a composition that actually exists.
    return NextResponse.json({ ok: true, state: 'assembling', clips: ep.clips });
  }

  const outcome = jobOutcome(job);
  if (outcome === 'running') {
    return NextResponse.json({ ok: true, state: 'assembling', clips: ep.clips });
  }

  // What the agent SAID it managed decides whether the clip is publishable. The report is whatever
  // free text came back on the job, so it is searched rather than parsed strictly.
  const report =
    typeof job.result?.message === 'string'
      ? job.result.message
      : JSON.stringify(job.result ?? {});
  const framing = readAssemblyReport(report);

  const next: ClipProposal =
    outcome === 'done'
      ? {
          ...clip,
          status: 'assembled',
          descript_url: job.project_url ?? clip.descript_url,
          assembly_error: undefined,
          source_aspect: framing.source_aspect,
          needs_reframe: framing.needs_reframe || undefined,
        }
      : {
          ...clip,
          status: 'approved',
          job_id: undefined,
          assembly_error:
            outcome === 'cancelled'
              ? 'That cut was cancelled in Descript.'
              : typeof job.result?.message === 'string'
                ? job.result.message
                : 'Descript could not finish that cut.',
        };

  const updated = withClip(ep, next);
  await saveEpisode(updated).catch((err) =>
    console.error('[podcast.clip] outcome save failed:', err)
  );
  return NextResponse.json({
    ok: true,
    state: next.status,
    error: next.assembly_error,
    clips: updated.clips,
  });
}
