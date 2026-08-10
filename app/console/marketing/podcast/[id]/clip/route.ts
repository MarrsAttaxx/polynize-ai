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
  DEFAULT_CLIP_STYLE,
  type ClipProposal,
} from '@/lib/marketing/podcast-store';
import {
  assemblyPrompt,
  finishPrompt,
  readAssemblyReport,
  readFinishReport,
  readCompositionId,
  compositionUrl,
} from '@/lib/marketing/podcast-clips';
import { startAgentJob, getJob, jobOutcome, resolveComposition, DescriptError } from '@/lib/descript';
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

const DeleteSchema = z.object({
  clip_id: z.string().trim().min(1).max(200),
  /**
   * Remember the section so it is not proposed again.
   *
   * Marrs: "if it's just a section that I don't like, I can delete it, and then she won't suggest that
   * same section again." Deleting the card is half of that; this is the half that makes it stick.
   * Defaults ON, because a delete that quietly allows the same suggestion back is the surprising
   * behaviour, not the useful one.
   */
  remember: z.boolean().default(true),
});

const AssembleSchema = z.object({
  clip_id: z.string().trim().min(1).max(200),
  /**
   * 'cut' builds the composition; 'finish' dresses one that already exists.
   *
   * Two passes rather than one prompt asking for everything, because the single combined pass reported
   * adding a title and captions that were not there. Separately runnable is what a missed finish
   * actually needs: re-cutting to fix a caption track would be absurd and would cost the credits again.
   */
  action: z.enum(['cut', 'finish']).default('cut'),
});

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

  const style = { ...DEFAULT_CLIP_STYLE, ...(ep.style ?? {}) };

  // ---- THE FINISH PASS: title, captions, music, on a composition that already exists ----
  if (body.action === 'finish') {
    // RESOLVED HERE TOO, not just required. Clips cut before the id was captured reliably have none
    // stored, and making him re-cut those (paying the credits twice) to fix a caption track would be
    // absurd when the composition is sitting in the project waiting to be found by name.
    let compositionId = clip.descript_composition_id;
    if (!compositionId) {
      const resolved = await resolveComposition({
        projectId: ep.descript_project_id,
        clipTitle: clip.title,
        sourceCompositionId: ep.descript_composition_id,
        claimed: ep.clips
          .filter((c) => c.clip_id !== clip.clip_id && c.descript_composition_id)
          .map((c) => c.descript_composition_id!),
      });
      compositionId = resolved.id;
      console.log(`[podcast.clip] finish resolved composition by ${resolved.how}: ${compositionId ?? 'none'}`);
    }
    if (!compositionId) {
      return NextResponse.json(
        {
          error:
            'Could not find this clip\'s composition in Descript. Open the project and check it is there, or cut the clip again.',
        },
        { status: 400 }
      );
    }
    try {
      const started = await startAgentJob({
        projectId: ep.descript_project_id,
        // Targeted at the CLIP, not the project, so the pass cannot wander onto the source episode.
        compositionId,
        prompt: finishPrompt({
          clipTitle: clip.title,
          compositionId,
          style,
        }),
      });
      const updated = withClip(ep, {
        ...clip,
        status: 'assembling',
        stage: 'finishing',
        job_id: started.job_id,
        // Recorded now, so the link is right even before the finish comes back.
        descript_composition_id: compositionId,
        descript_url: compositionUrl(ep.descript_project_id, compositionId),
        assembly_error: undefined,
      });
      await saveEpisode(updated);
      return NextResponse.json({ ok: true, job_id: started.job_id, clips: updated.clips });
    } catch (e) {
      const message = e instanceof DescriptError ? e.message : 'Descript would not take the finish.';
      console.error('[podcast.clip] finish failed:', e);
      const updated = withClip(ep, { ...clip, assembly_error: message });
      await saveEpisode(updated).catch(() => {});
      return NextResponse.json({ error: message, clips: updated.clips }, { status: 502 });
    }
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
      prompt: assemblyPrompt(clip, episodeLabel, { preFramed: ep.pre_framed, style }),
    });
    const updated = withClip(ep, {
      ...clip,
      status: 'assembling',
      stage: 'cutting',
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

  const report =
    typeof job.result?.agent_response === 'string'
      ? job.result.agent_response
      : typeof job.result?.message === 'string'
        ? job.result.message
        : JSON.stringify(job.result ?? {});

  let next: ClipProposal;

  if (outcome !== 'done') {
    next = {
      ...clip,
      status: clip.stage === 'finishing' ? 'assembled' : 'approved',
      stage: undefined,
      job_id: undefined,
      assembly_error:
        outcome === 'cancelled'
          ? 'That was cancelled in Descript.'
          : typeof job.result?.message === 'string'
            ? job.result.message
            : clip.stage === 'finishing'
              ? 'Descript could not finish the title and captions.'
              : 'Descript could not finish that cut.',
    };
  } else if (clip.stage === 'finishing') {
    // THE FINISH PASS. What it reports is recorded rather than believed, because the combined pass
    // asserted a title and captions that were not on the timeline and there was no way to tell.
    const finish = readFinishReport(report);
    next = {
      ...clip,
      status: 'assembled',
      stage: undefined,
      job_id: undefined,
      finish,
      assembly_error: undefined,
    };
  } else {
    // THE CUT. The composition id comes out of the report, which is the only place it appears: the job
    // itself only ever returns a PROJECT url, and opening a project opens the full episode.
    const framing = readAssemblyReport(report, { preFramed: ep.pre_framed });
    // The report is a HINT. The project's own composition list decides, because the report's
    // formatting has already proved unreliable and a wrong link sends him to the full episode.
    const resolved = await resolveComposition({
      projectId: ep.descript_project_id!,
      reported: readCompositionId(report),
      clipTitle: clip.title,
      sourceCompositionId: ep.descript_composition_id,
      claimed: ep.clips
        .filter((c) => c.clip_id !== clip.clip_id && c.descript_composition_id)
        .map((c) => c.descript_composition_id!),
    });
    if (resolved.how !== 'reported') {
      console.log(`[podcast.clip] composition resolved by ${resolved.how}: ${resolved.id ?? 'none'}`);
    }
    const compositionId = resolved.id ?? clip.descript_composition_id;
    next = {
      ...clip,
      status: 'assembled',
      stage: undefined,
      job_id: undefined,
      descript_composition_id: compositionId,
      descript_url: ep.descript_project_id
        ? compositionUrl(ep.descript_project_id, compositionId)
        : (job.project_url ?? clip.descript_url),
      assembly_error: undefined,
      source_aspect: framing.source_aspect,
      needs_reframe: framing.needs_reframe || undefined,
      // A fresh cut has not been dressed yet, so any previous finish report is not about this cut.
      finish: undefined,
      recut_needed: undefined,
    };
  }

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

/** Delete one clip, and by default remember the section so it is not offered again. */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user || user.scope.type !== 'team') {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  let body: z.infer<typeof DeleteSchema>;
  try {
    body = DeleteSchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: 'invalid request' }, { status: 400 });
  }

  const found = await load(user.email, id, body.clip_id);
  if ('error' in found) return found.error;
  const { ep, clip } = found;

  if (clip.status === 'assembling') {
    return NextResponse.json(
      { error: 'Descript is working on that one. Wait for it to finish first.' },
      { status: 409 }
    );
  }

  // THE EXCLUSION OUTLIVES THE CLIP. That is the whole point: the card goes, the reason stays, and the
  // next proposal pass is told not to offer this ground again. It carries the theme, the hook and the
  // timecode so an OVERLAPPING suggestion is recognisable and not only an identical one.
  const excluded = body.remember
    ? [
        ...(ep.excluded ?? []),
        {
          theme: clip.theme || clip.title,
          hook: clip.hook.text,
          at: clip.hook.at,
          excluded_at: new Date().toISOString(),
        },
      ].slice(-60)
    : ep.excluded;

  const next = {
    ...ep,
    excluded,
    clips: ep.clips.filter((c) => c.clip_id !== clip.clip_id),
    updated_at: new Date().toISOString(),
  };

  try {
    await saveEpisode(next);
  } catch (err) {
    console.error('[podcast.clip] delete failed:', err);
    return NextResponse.json({ error: 'could not delete it' }, { status: 502 });
  }
  return NextResponse.json({
    ok: true,
    clips: next.clips,
    excluded_count: (excluded ?? []).length,
    // Said back, because "she will not suggest it again" is a promise worth confirming out loud. The
    // composition, if one was already cut, is untouched in Descript.
    note: body.remember
      ? clip.descript_composition_id
        ? 'Deleted, and she will not propose that section again. The composition already cut is still in Descript.'
        : 'Deleted, and she will not propose that section again.'
      : 'Deleted.',
  });
}
