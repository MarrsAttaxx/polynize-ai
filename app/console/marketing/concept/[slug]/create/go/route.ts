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
import { getTemplate, saveTemplate, templateKey } from '@/lib/marketing/template-store';
import { getLibraryTemplate, libraryRef } from '@/lib/marketing/template-library';
import {
  createOutputs,
  creationTarget,
  streamTemplateRef,
} from '@/lib/marketing/create-outputs';
import { getPiece, savePiece } from '@/lib/marketing/piece-store';
import { stripEmDashes } from '@/lib/em-dash';
import { draftTextBody, draftVideoScript } from '@/lib/marketing/draft';
import { scaffoldScript } from '@/lib/marketing/concept-parse';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
// The auto-draft below adds one LLM call before the response; well within this.
export const maxDuration = 60;

const BodySchema = z.object({
  source: z.enum(['stream', 'library']),
  template_id: z.string().min(1).max(80),
  /** The operator's angle for this piece. Optional: "skip" is a legitimate choice. */
  angle: z.string().max(4000).optional(),
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
    const lib = getLibraryTemplate(body.template_id);
    template = lib;
    templateRef = libraryRef(body.template_id);
    // USING A BUILT-IN COPIES IT INTO THE STREAM, so from here on it is an ordinary
    // editable template. The built-ins live in code, which made them permanently
    // unfixable: Marrs had "a mess of half-good templates" he could not touch. The copy
    // takes over the ref too, so refining it afterwards actually affects the next piece.
    // Best effort: if the copy fails the piece is still created against the library ref.
    if (lib) {
      try {
        if (!(await getTemplate(concept.stream, lib.template_id))) {
          const now = new Date().toISOString();
          await saveTemplate({
            ...lib,
            stream: concept.stream,
            created_at: now,
            updated_at: now,
          });
        }
        templateRef = templateKey(concept.stream, lib.template_id);
        template = (await getTemplate(concept.stream, lib.template_id)) ?? lib;
      } catch (err) {
        console.error('[concept.create] library copy failed (using the built-in):', err);
      }
    }
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

  // A NAME FROM THE ANGLE. Deterministic on purpose: an LLM call here would add a failure
  // mode and a wait to the one moment the operator is trying to get moving, and a plain
  // snippet of their own words is both recognisable and honest. It is a starting name, and
  // renameable on the piece.
  const angleName = (() => {
    const a = (body.angle ?? '').trim();
    if (!a) return '';
    // First sentence or line, whichever comes first: that is where the angle states itself.
    const first = a.split(/(?<=[.!?])\s|\n/)[0].trim().replace(/\s+/g, ' ');
    if (!first) return '';
    if (first.length <= 58) return first;
    const cut = first.slice(0, 58);
    const lastSpace = cut.lastIndexOf(' ');
    return (lastSpace > 24 ? cut.slice(0, lastSpace) : cut).replace(/[,;:]$/, '');
  })();
  const pieceTitle = angleName ? `${concept.title}: ${angleName}` : concept.title;

  let pieces;
  try {
    pieces = await createOutputs(
      user.email,
      concept,
      [
        {
          format: fmt,
          platforms: template.platforms,
          icp: template.icp,
          pillar: template.name,
          template_ref: templateRef,
        },
      ],
      // Each "Use this template" makes a fresh piece with a fresh draft, so it
      // never silently reopens a prior piece's stale draft. Variations accumulate
      // in the concept's dev hub (and can be deleted there).
      { forceNew: true, title: pieceTitle }
    );
  } catch (err) {
    console.error('[concept.create] create failed:', err);
    return NextResponse.json({ error: 'could not create the piece' }, { status: 500 });
  }

  // Auto-draft the first version: mash the template recipe with the concept so
  // the user lands on a real draft, not an empty body or a generic scaffold. Best
  // effort: if the draft fails the piece is still created and the user can draft
  // manually on the piece screen, so a slow/absent LLM never blocks creation.
  //
  // Draft only when the target field is still UNTOUCHED. This never overwrites real
  // content on a re-run, but it DOES recover a piece whose first attempt timed out
  // after createOutputs saved it (idempotent re-run returns reused=true, yet the
  // content was never written), instead of leaving it stuck on the bare scaffold.
  const created = pieces[0];
  if (created) {
    try {
      let piece = await getPiece(user.email, created.pieceId);
      // The angle is saved BEFORE drafting, so the draft is written with it rather than
      // having it bolted on afterwards. This is the whole point of the extra step.
      if (piece && body.angle?.trim()) {
        piece = { ...piece, angle: stripEmDashes(body.angle.trim()) };
        await savePiece(user.email, piece);
      }
      if (piece) {
        // Match how the piece page renders: kind 'text' → TextOutputScreen (body),
        // everything else → ScriptScreen (script). Drafting into the OTHER field
        // would make the draft invisible on the screen.
        if (piece.kind === 'text') {
          if (!piece.body?.trim()) {
            const body = await draftTextBody(user.email, piece);
            await savePiece(user.email, { ...piece, body });
          }
        } else {
          // "Untouched" = empty, or still exactly the scaffold createOutputs seeded.
          const scaffold = scaffoldScript(concept.framing, concept.body_md);
          if (!piece.script?.trim() || piece.script === scaffold) {
            // Script only: the interface is built on its own stage, from
            // this locked script plus the operator's direction (D29 amended).
            const script = await draftVideoScript(user.email, piece);
            await savePiece(user.email, { ...piece, script });
          }
        }
      }
    } catch (err) {
      console.error('[concept.create] auto-draft failed (piece still created):', err);
    }
  }

  return NextResponse.json({ pieces, target: creationTarget(pieces, slug) });
}
