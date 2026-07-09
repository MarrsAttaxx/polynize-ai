/**
 * PUT /console/marketing/metricool/save — save the stream -> Metricool brand map
 * and the per-stream posting schedule (timezone + ideal times) (D24). Team-scope.
 */

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/lib/console-auth';
import { isStreamId } from '@/lib/marketing/streams';
import {
  saveBrandMap,
  savePostingSchedule,
  type BrandMap,
  type PostingSchedule,
} from '@/lib/marketing/metricool-config-store';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const BodySchema = z.object({
  map: z.record(z.string(), z.string().max(64)),
  schedule: z
    .record(
      z.string(),
      z.object({
        timezone: z.string().max(64),
        slots: z.array(z.string().max(5)).max(24),
      })
    )
    .optional(),
});

export async function PUT(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.scope.type !== 'team') {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  let body: z.infer<typeof BodySchema>;
  try {
    body = BodySchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: 'invalid request' }, { status: 400 });
  }

  // Keep only known streams.
  const cleanMap: BrandMap = {};
  for (const [stream, blogId] of Object.entries(body.map)) {
    if (isStreamId(stream) && blogId.trim()) cleanMap[stream] = blogId.trim();
  }
  const cleanSchedule: PostingSchedule = {};
  for (const [stream, cfg] of Object.entries(body.schedule ?? {})) {
    if (isStreamId(stream)) cleanSchedule[stream] = cfg; // store-layer normalizes slots/tz
  }

  try {
    await saveBrandMap(cleanMap);
    if (body.schedule) await savePostingSchedule(cleanSchedule);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[metricool.save] write failed:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'write failed' },
      { status: 500 }
    );
  }
}
