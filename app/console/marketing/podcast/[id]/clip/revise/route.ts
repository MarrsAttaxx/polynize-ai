/**
 * REVISE one clip on the operator's instruction.
 *
 * The loop Marrs asked for after using the screens: read the clip, then tell April what to change and
 * have her re-cut it. His example is the shape of it: a later section of the episode names three
 * classes and he wants a piece of each folded into a clip that currently does not touch them.
 *
 * Streamed, same convention as the figure and propose endpoints, because the whole transcript goes back
 * in and that is a minutes-long call.
 *
 * Team-scope only.
 */

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/lib/console-auth';
import { getEpisode, saveEpisode, withClip } from '@/lib/marketing/podcast-store';
import { reviseClip, clipModelInUse } from '@/lib/marketing/podcast-clips';
import { DraftError } from '@/lib/marketing/draft';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 300;

const Schema = z.object({
  clip_id: z.string().trim().min(1).max(200),
  direction: z.string().trim().min(1).max(4000),
  stream: z.boolean().optional(),
});

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
  if (!ep.transcript?.trim()) {
    return NextResponse.json(
      { error: 'The transcript is gone, so there is nothing to re-cut from. Pull it again.' },
      { status: 400 }
    );
  }
  const clip = ep.clips.find((c) => c.clip_id === body.clip_id);
  if (!clip) {
    return NextResponse.json({ error: 'That clip is gone. Reload.' }, { status: 409 });
  }
  if (clip.status === 'assembling') {
    return NextResponse.json(
      { error: 'That cut is running in Descript. Wait for it to finish before changing it.' },
      { status: 409 }
    );
  }

  const run = async (onProgress?: (d: { reasoning?: string; content?: string }) => void) => {
    const { clip: revised, note } = await reviseClip(
      ep.transcript!,
      clip,
      body.direction,
      onProgress
    );
    const updated = withClip(ep, revised);
    await saveEpisode(updated);
    return {
      ok: true as const,
      note,
      clip_id: revised.clip_id,
      // The whole set goes back so the card, its status and its history all refresh together.
      clips: updated.clips,
      model: clipModelInUse(),
    };
  };

  const failure = (e: unknown) => {
    if (e instanceof DraftError && e.reason === 'empty') {
      return 'That came back unusable. Try saying it a different way.';
    }
    console.error('[podcast.revise] failed:', e);
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
