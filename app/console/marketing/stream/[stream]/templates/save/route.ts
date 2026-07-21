/**
 * PUT /console/marketing/stream/[stream]/templates/save — upsert one Content
 * Pillar Template (D25). Stream from the route (validated), slug derived from
 * the name for new templates, created_at preserved on edit. Team-scope only.
 */

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/lib/console-auth';
import { isStreamId } from '@/lib/marketing/streams';
import {
  getTemplate,
  saveTemplate,
  templateSlug,
  type ContentTemplate,
} from '@/lib/marketing/template-store';
import { formatById } from '@/lib/marketing/output-plan';
import { stripEmDashes } from '@/lib/em-dash';
import { revalidatePath } from 'next/cache';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const BodySchema = z.object({
  // Legit ids are always templateSlug output; constraining to the slug alphabet
  // keeps client-supplied ids out of the raw storage key.
  template_id: z.string().regex(/^[a-z0-9-]{1,60}$/).optional(),
  name: z.string().min(1).max(120),
  description: z.string().max(600),
  status: z.enum(['active', 'developing', 'retired']),
  format: z.string().max(60),
  platforms: z.array(z.string().max(40)).max(10),
  icp: z.string().max(60).optional(),
  inputs: z.string().max(600).optional(),
  outputs: z.string().max(600).optional(),
  length: z.string().max(400).optional(),
  hook_recipe: z.string().max(8000).optional(),
  recipe: z.string().max(20_000).optional(),
  cta_recipe: z.string().max(8000).optional(),
  example: z.string().max(600).optional(),
});

export async function PUT(
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

  const fmt = formatById(body.format);
  if (!fmt) {
    return NextResponse.json({ error: 'unknown format' }, { status: 400 });
  }
  const platforms = body.platforms.filter((c) => fmt.channels.includes(c));
  // A template targeting no platforms is not actionable; reject rather than
  // silently expanding to all channels.
  if (platforms.length === 0) {
    return NextResponse.json({ error: 'pick at least one platform' }, { status: 400 });
  }

  const isNew = !body.template_id?.trim();
  const slug = body.template_id?.trim() || templateSlug(body.name);
  if (!slug) {
    return NextResponse.json({ error: 'name produced an empty id' }, { status: 400 });
  }

  let existing: ContentTemplate | null = null;
  try {
    existing = await getTemplate(stream, slug);
  } catch {
    existing = null;
  }
  // Distinct names can normalize to the same slug; a NEW save must never blind-
  // overwrite an existing template's refined recipe (same guard the concept
  // store's slug walk provides — here a clear 409 beats a silent -2 suffix).
  if (isNew && existing) {
    return NextResponse.json(
      {
        error: `A template with this name already exists here ("${existing.name}"). Pick a different name or edit that template.`,
      },
      { status: 409 }
    );
  }

  const now = new Date().toISOString();
  const template: ContentTemplate = {
    template_id: slug,
    stream,
    name: stripEmDashes(body.name.trim()),
    description: stripEmDashes(body.description.trim()),
    status: body.status,
    format: fmt.id,
    platforms,
    icp: body.icp || undefined,
    inputs: body.inputs ? stripEmDashes(body.inputs.trim()) : undefined,
    outputs: body.outputs ? stripEmDashes(body.outputs.trim()) : undefined,
    length: body.length ? stripEmDashes(body.length.trim()) : undefined,
    hook_recipe: body.hook_recipe ? stripEmDashes(body.hook_recipe.trim()) : undefined,
    recipe: body.recipe ? stripEmDashes(body.recipe.trim()) : undefined,
    cta_recipe: body.cta_recipe ? stripEmDashes(body.cta_recipe.trim()) : undefined,
    example: body.example ? stripEmDashes(body.example.trim()) : undefined,
    created_at: existing?.created_at ?? now,
    updated_at: now,
  };

  try {
    await saveTemplate(template);
    revalidatePath(`/console/marketing/stream/${stream}`);
    return NextResponse.json({ ok: true, template });
  } catch (err) {
    console.error('[templates.save] write failed:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'write failed' },
      { status: 500 }
    );
  }
}
