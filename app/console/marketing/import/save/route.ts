/**
 * POST /console/marketing/import/save — import a pasted concept doc (D25).
 * Saves through the SAME concept store as April's finalize (same keying,
 * slug-collision walk, frontmatter round-trip), so an imported concept is
 * indistinguishable downstream. Em-dashes are stripped per the house rule.
 * Team-scope only; owner from the session.
 */

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/lib/console-auth';
import { STREAM_IDS } from '@/lib/marketing/streams';
import { saveConcept, getConcept, framingSlug } from '@/lib/marketing/concept-store';
import { stripEmDashes } from '@/lib/em-dash';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const MAX_BODY_BYTES = 512 * 1024;

const BodySchema = z.object({
  stream: z.enum(STREAM_IDS),
  title: z.string().min(1).max(300),
  body_md: z.string().min(1).max(200_000),
  /** 'update' = the user explicitly confirmed replacing the same-titled concept. */
  mode: z.enum(['create', 'update']).optional(),
});

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.scope.type !== 'team') {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const raw = await req.text();
  if (raw.length > MAX_BODY_BYTES) {
    return NextResponse.json({ error: 'payload too large' }, { status: 413 });
  }
  let body: z.infer<typeof BodySchema>;
  try {
    body = BodySchema.parse(JSON.parse(raw));
  } catch {
    return NextResponse.json({ error: 'invalid request' }, { status: 400 });
  }

  const framing = stripEmDashes(body.title.trim());

  // saveConcept treats a same-framing collision as an update-in-place (the
  // living-document behavior April's re-finalize relies on). For IMPORTS that
  // replacement must be explicit: two unrelated docs can share a title, and a
  // silent overwrite destroys the first concept's body. Walk the same candidate
  // slugs saveConcept would and 409 unless the user confirmed mode=update.
  if (body.mode !== 'update') {
    try {
      const baseSlug = framingSlug(framing);
      for (let n = 1; n <= 50 && baseSlug; n++) {
        const candidate = n === 1 ? baseSlug : `${baseSlug}-${n}`;
        const found = await getConcept(user.email, candidate);
        if (!found) break;
        if (found.framing.trim() === framing) {
          return NextResponse.json(
            {
              error: `A concept titled "${found.title}" already exists. Import again as an update to replace its content, or change the title.`,
              existing_slug: found.framing_slug,
              conflict: true,
            },
            { status: 409 }
          );
        }
      }
    } catch (err) {
      // Collision probe failing must not block a fresh import; saveConcept's own
      // walk still prevents cross-framing slug clobbering.
      console.error('[import.save] collision probe failed, continuing:', err);
    }
  }

  try {
    const concept = await saveConcept({
      owner: user.email,
      stream: body.stream,
      framing,
      title: framing,
      body_md: stripEmDashes(body.body_md),
    });
    return NextResponse.json({ ok: true, slug: concept.framing_slug });
  } catch (err) {
    console.error('[import.save] failed:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'import failed' },
      { status: 500 }
    );
  }
}
