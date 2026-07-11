/**
 * POST /console/marketing/concept/[slug]/create/go — create content from a
 * template (D25, the default path). Resolves the chosen template (stream or
 * built-in library), and the template's plan (format + platforms + ICP + name as
 * pillar) drives the shared fan-out. Idempotent per (concept, format, template).
 * Team-scope only.
 */

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/lib/console-auth';
import { getConcept } from '@/lib/marketing/concept-store';
import { formatById } from '@/lib/marketing/output-plan';
import { getTemplate } from '@/lib/marketing/template-store';
import { getLibraryTemplate, libraryRef } from '@/lib/marketing/template-library';
import {
  createOutputs,
  creationTarget,
  streamTemplateRef,
} from '@/lib/marketing/create-outputs';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const BodySchema = z.object({
  source: z.enum(['stream', 'library']),
  template_id: z.string().min(1).max(80),
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

  let concept;
  try {
    concept = await getConcept(user.email, slug);
  } catch (err) {
    console.error('[concept.create] concept read failed:', err);
    return NextResponse.json({ error: 'could not read the concept' }, { status: 502 });
  }
  if (!concept) {
    return NextResponse.json({ error: 'concept not found' }, { status: 404 });
  }

  // Resolve the template. Stream templates belong to the CONCEPT's stream (not
  // client-supplied), so a template id alone can't reach another stream's recipe.
  let template;
  let templateRef: string;
  if (body.source === 'library') {
    template = getLibraryTemplate(body.template_id);
    templateRef = libraryRef(body.template_id);
  } else {
    try {
      template = (await getTemplate(concept.stream, body.template_id)) ?? undefined;
    } catch (err) {
      console.error('[concept.create] template read failed:', err);
      return NextResponse.json({ error: 'could not read the template' }, { status: 502 });
    }
    templateRef = template ? streamTemplateRef(template) : '';
  }
  if (!template) {
    return NextResponse.json({ error: 'template not found' }, { status: 404 });
  }
  if (template.status !== 'active') {
    return NextResponse.json(
      { error: 'this template is not active yet' },
      { status: 400 }
    );
  }
  const fmt = formatById(template.format);
  if (!fmt || fmt.module !== 'built') {
    return NextResponse.json(
      { error: 'this template\'s production module is not built yet' },
      { status: 400 }
    );
  }

  try {
    const pieces = await createOutputs(user.email, concept, [
      {
        format: fmt,
        platforms: template.platforms,
        icp: template.icp,
        pillar: template.name,
        template_ref: templateRef,
      },
    ]);
    return NextResponse.json({ pieces, target: creationTarget(pieces, slug) });
  } catch (err) {
    console.error('[concept.create] create failed:', err);
    return NextResponse.json({ error: 'could not create the piece' }, { status: 500 });
  }
}
