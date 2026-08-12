/**
 * The CRM's write verbs.
 *
 *   POST   { owner, email, name?, business?, role_title?, phone?, stage?, notes?,
 *            next_action?, next_action_at? }   add or update a contact
 *   PATCH  { id, ...fields }                   edit one contact
 *   DELETE { id }                              remove one contact
 *
 * Team scope only. Everyone can write to everyone's CRM, which is Marrs's call for v1
 * ("visible to team, filtered by owner"); per-person enforcement waits for the D28
 * permissions layer rather than being half-built here.
 */

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/lib/console-auth';
import {
  CRM_STAGES,
  deleteContact,
  getContact,
  patchContact,
  upsertContact,
  type CrmStage,
} from '@/lib/crm/contact-store';
import { STREAMS } from '@/lib/marketing/streams';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Typed as CrmStage rather than string, so the parsed value flows straight into the store
// without a cast. Derived from CRM_STAGES, so adding a stage needs no edit here.
const STAGE = z.enum(CRM_STAGES.map((s) => s.id) as [CrmStage, ...CrmStage[]]);
// The owner must be a real stream, so a typo cannot create a sixth invisible CRM that
// nothing links to and nobody ever opens.
const OWNER = z.enum(STREAMS.map((s) => s.id) as [string, ...string[]]);

const Text = z.string().trim().max(2000);
const Short = z.string().trim().max(200);

const CreateSchema = z.object({
  owner: OWNER,
  email: z.string().trim().toLowerCase().email().max(320),
  name: Short.optional(),
  business: Short.optional(),
  role_title: Short.optional(),
  phone: Short.optional(),
  stage: STAGE.optional(),
  notes: Text.optional(),
  next_action: Short.optional(),
  next_action_at: z.string().trim().max(40).optional(),
});

const PatchSchema = z.object({
  id: z.string().trim().min(1).max(80),
  stage: STAGE.optional(),
  name: Short.optional(),
  business: Short.optional(),
  role_title: Short.optional(),
  phone: Short.optional(),
  notes: Text.optional(),
  // '' clears these two: a next action that is done should be removable, not only
  // replaceable. patchContact turns '' into null.
  next_action: z.string().trim().max(200).optional(),
  next_action_at: z.string().trim().max(40).optional(),
  last_contacted_at: z.string().trim().max(40).optional(),
});

const DeleteSchema = z.object({ id: z.string().trim().min(1).max(80) });

async function team() {
  const user = await getCurrentUser();
  return user && user.scope.type === 'team' ? user : null;
}

/**
 * A date arriving from a date input is 'YYYY-MM-DD' with no timezone, which Postgres
 * would read as UTC midnight. In Sydney that is the morning of the NEXT day, so a
 * follow-up set for today would not read as due until tomorrow. Pin it to midday so no
 * plausible timezone can move it across a date boundary.
 */
function normaliseDate(v: string | undefined): string | undefined {
  if (v === undefined) return undefined;
  if (v === '') return '';
  return /^\d{4}-\d{2}-\d{2}$/.test(v) ? `${v}T12:00:00.000Z` : v;
}

export async function POST(req: NextRequest) {
  if (!(await team())) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  let body: z.infer<typeof CreateSchema>;
  try {
    body = CreateSchema.parse(await req.json());
  } catch (err) {
    const msg = err instanceof z.ZodError ? (err.issues[0]?.message ?? 'invalid') : 'invalid';
    return NextResponse.json({ error: `That did not look right: ${msg}` }, { status: 400 });
  }
  try {
    const contact = await upsertContact({
      ...body,
      next_action_at: normaliseDate(body.next_action_at) || undefined,
      source: 'manual',
    });
    return NextResponse.json({ ok: true, contact });
  } catch (err) {
    console.error('[crm.create] failed:', err);
    return NextResponse.json({ error: 'Could not save that contact.' }, { status: 502 });
  }
}

export async function PATCH(req: NextRequest) {
  if (!(await team())) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  let body: z.infer<typeof PatchSchema>;
  try {
    body = PatchSchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: 'invalid request' }, { status: 400 });
  }

  const { id, ...rest } = body;
  const existing = await getContact(id).catch(() => null);
  if (!existing) return NextResponse.json({ error: 'contact not found' }, { status: 404 });

  const patch: Record<string, unknown> = { ...rest };
  if ('next_action_at' in patch) patch.next_action_at = normaliseDate(rest.next_action_at);

  /**
   * MOVING A CONTACT OUT OF `new` STAMPS last_contacted_at.
   *
   * Otherwise every row would need two deliberate edits to stay honest, and the second
   * one is the one people skip. The stamp is skipped if the caller set it itself, and if
   * the stage is not actually changing.
   */
  if (rest.stage && rest.stage !== existing.stage && rest.stage !== 'new') {
    if (!('last_contacted_at' in patch)) patch.last_contacted_at = new Date().toISOString();
  }

  try {
    const contact = await patchContact(id, patch);
    return NextResponse.json({ ok: true, contact });
  } catch (err) {
    console.error('[crm.patch] failed:', err);
    return NextResponse.json({ error: 'Could not save that change.' }, { status: 502 });
  }
}

export async function DELETE(req: NextRequest) {
  if (!(await team())) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  let body: z.infer<typeof DeleteSchema>;
  try {
    body = DeleteSchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: 'invalid request' }, { status: 400 });
  }
  try {
    await deleteContact(body.id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[crm.delete] failed:', err);
    return NextResponse.json({ error: 'Could not delete that contact.' }, { status: 502 });
  }
}
