/**
 * PUT /console/marketing/metricool/save — save the stream -> Metricool brand map
 * (D24). Team-scope only. Keys must be known streams; values are blogId strings.
 */

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/lib/console-auth';
import { isStreamId } from '@/lib/marketing/streams';
import { saveBrandMap, type BrandMap } from '@/lib/marketing/metricool-config-store';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const BodySchema = z.object({
  map: z.record(z.string(), z.string().max(64)),
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

  // Keep only known streams with a non-empty blogId.
  const clean: BrandMap = {};
  for (const [stream, blogId] of Object.entries(body.map)) {
    if (isStreamId(stream) && blogId.trim()) clean[stream] = blogId.trim();
  }

  try {
    await saveBrandMap(clean);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[metricool.save] write failed:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'write failed' },
      { status: 500 }
    );
  }
}
