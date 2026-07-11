/**
 * POST /console/marketing/stream/[stream]/templates/delete — delete one template
 * (D25). Idempotent; pieces already made from it keep working (their template_ref
 * just resolves to nothing). Team-scope only.
 */

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/lib/console-auth';
import { isStreamId } from '@/lib/marketing/streams';
import { deleteTemplate } from '@/lib/marketing/template-store';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const BodySchema = z.object({ template_id: z.string().regex(/^[a-z0-9-]{1,60}$/) });

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ stream: string }> }
) {
  const { stream } = await params;
  const user = await getCurrentUser();
  if (!user || user.scope.type !== 'team') {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  if (!isStreamId(stream)) {
    return NextResponse.json({ error: 'unknown stream' }, { status: 400 });
  }

  let body: z.infer<typeof BodySchema>;
  try {
    body = BodySchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: 'invalid request' }, { status: 400 });
  }

  try {
    await deleteTemplate(stream, body.template_id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[templates.delete] failed:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'delete failed' },
      { status: 500 }
    );
  }
}
