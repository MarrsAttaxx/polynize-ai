/**
 * PROPOSE CLIPS from the episode transcript.
 *
 * Streamed, for the same reason the prezie stage is: working through a 56-minute transcript and
 * building full edit decision lists is a minutes-long call, and a minutes-long call with no output is
 * indistinguishable from a hang. Newline-delimited JSON, one `think` per flush then a single `ok` or
 * `err`, matching the figure endpoint so there is one streaming convention in the console rather than
 * two.
 *
 * PROPOSING NEVER DESTROYS. New proposals are APPENDED and anything already approved, assembled or
 * rejected survives. Marrs re-runs proposals when the first pass misses a theme, and losing an
 * approved clip to a second opinion would be the worst possible behaviour.
 *
 * Team-scope only.
 */

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/lib/console-auth';
import { getEpisode, saveEpisode, type ClipProposal } from '@/lib/marketing/podcast-store';
import { proposeClips, clipModelInUse } from '@/lib/marketing/podcast-clips';
import { DraftError } from '@/lib/marketing/draft';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 300;

const Schema = z.object({ stream: z.boolean().optional() });

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
  if (!ep) return NextResponse.json({ error: 'episode not found' }, { status: 404 });
  if (!ep.transcript?.trim()) {
    return NextResponse.json(
      { error: 'No transcript yet. Pull it from Descript, or paste one.' },
      { status: 400 }
    );
  }

  const run = async (onProgress?: (d: { reasoning?: string; content?: string }) => void) => {
    const proposals = await proposeClips(
      ep.transcript!,
      { title: ep.title, guest: ep.guest, number: ep.number },
      onProgress
    );

    // KEEP WHAT HE HAS ALREADY RULED ON. Only untouched `proposed` clips are replaced, because those
    // are the ones a re-run is meant to improve on; a decision he made is not the model's to undo.
    const decided = ep.clips.filter((c) => c.status !== 'proposed');
    const renumbered: ClipProposal[] = [
      ...decided,
      ...proposals.map((c, i) => ({ ...c, rank: decided.length + i + 1 })),
    ];

    const next = { ...ep, clips: renumbered, updated_at: new Date().toISOString() };
    await saveEpisode(next);
    return {
      ok: true as const,
      added: proposals.length,
      kept: decided.length,
      clips: next.clips,
      model: clipModelInUse(),
    };
  };

  const failure = (e: unknown) => {
    if (e instanceof DraftError && e.reason === 'empty') {
      return 'She did not find anything usable in that. If the transcript looks right, try again.';
    }
    if (e instanceof DraftError && e.reason === 'no-concept') {
      return 'That transcript is too short to find clips in.';
    }
    console.error('[podcast.propose] failed:', e);
    return 'April is unavailable right now. Try again in a moment.';
  };

  if (!body.stream) {
    try {
      return NextResponse.json(await run());
    } catch (e) {
      return NextResponse.json({ error: failure(e) }, { status: 502 });
    }
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false;
      const send = (obj: unknown) => {
        if (closed) return;
        controller.enqueue(encoder.encode(JSON.stringify(obj) + '\n'));
      };

      let tail = '';
      let phase: 'thinking' | 'writing' = 'thinking';
      let dirty = false;
      const flush = () => {
        if (!dirty) return;
        dirty = false;
        send({ t: 'think', phase, d: tail });
      };
      const ticker = setInterval(flush, 150);

      try {
        const payload = await run(({ reasoning, content }) => {
          if (content) phase = 'writing';
          const piece = (content ?? reasoning ?? '').replace(/\s+/g, ' ');
          if (!piece) return;
          tail = (tail + piece).slice(-220);
          dirty = true;
        });
        clearInterval(ticker);
        flush();
        send({ t: 'ok', ...payload });
      } catch (e) {
        clearInterval(ticker);
        send({ t: 'err', error: failure(e) });
      } finally {
        closed = true;
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'content-type': 'application/x-ndjson; charset=utf-8',
      'cache-control': 'no-store, no-transform',
      'x-accel-buffering': 'no',
    },
  });
}
