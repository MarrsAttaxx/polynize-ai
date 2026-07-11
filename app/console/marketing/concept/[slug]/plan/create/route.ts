/**
 * POST /console/marketing/concept/[slug]/plan/create — the CUSTOM Output-plan
 * path (D19/D25). The default creation path is the template picker
 * (concept/[slug]/create); this remains for one-off plans. Fans a concept out to
 * one piece per selected built format via the shared createOutputs. Idempotent
 * per (concept, format) among custom (template-less) pieces. Team-scope only.
 */

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/lib/console-auth';
import { getConcept } from '@/lib/marketing/concept-store';
import { formatById } from '@/lib/marketing/output-plan';
import { createOutputs, creationTarget, type OutputSpec } from '@/lib/marketing/create-outputs';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const BodySchema = z.object({
  formats: z.array(z.string().max(60)).min(1).max(12),
  platforms: z.record(z.string(), z.array(z.string().max(40)).max(10)).optional(),
  icp: z.string().max(60).optional(),
  pillar: z.string().max(120).optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
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

  // Keep only formats that actually have a production module ("coming" formats
  // must not create pieces with nowhere to go).
  const selected = [...new Set(body.formats)]
    .map((id) => formatById(id))
    .filter((f): f is NonNullable<typeof f> => !!f && f.module === 'built');
  if (selected.length === 0) {
    return NextResponse.json(
      { error: 'select at least one available format' },
      { status: 400 }
    );
  }

  let concept;
  try {
    concept = await getConcept(user.email, slug);
  } catch (err) {
    console.error('[concept.plan] concept read failed:', err);
    return NextResponse.json({ error: 'could not read the concept' }, { status: 502 });
  }
  if (!concept) {
    return NextResponse.json({ error: 'concept not found' }, { status: 404 });
  }

  try {
    const specs: OutputSpec[] = selected.map((fmt) => ({
      format: fmt,
      platforms: body.platforms?.[fmt.id] ?? fmt.channels.slice(),
      icp: body.icp,
      pillar: body.pillar,
    }));
    const pieces = await createOutputs(user.email, concept, specs);
    return NextResponse.json({ pieces, target: creationTarget(pieces, slug) });
  } catch (err) {
    console.error('[concept.plan] create failed:', err);
    return NextResponse.json({ error: 'could not create the outputs' }, { status: 500 });
  }
}
