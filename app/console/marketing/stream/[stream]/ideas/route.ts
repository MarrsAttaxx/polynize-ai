/**
 * Ideas: the rough notes that come before a concept.
 *
 *   POST   {}                 start a new empty note
 *   PATCH  { id, text }       save one (debounced from the client)
 *   DELETE { id }             bin one
 *
 * Team scope only.
 */

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/lib/console-auth';
import { createIdea, deleteIdea, updateIdea } from '@/lib/marketing/idea-store';
import { STREAMS } from '@/lib/marketing/streams';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

async function guard(stream: string) {
  const user = await getCurrentUser();
  if (!user || user.scope.type !== 'team') return { error: 'unauthorized', status: 401 } as const;
  if (!STREAMS.some((s) => s.id === stream)) return { error: 'unknown stream', status: 400 } as const;
  return { ok: true } as const;
}

const CreateSchema = z.object({ text: z.string().max(20000).optional() });

/** Commit a note. Created WITH its text, so a commit cannot half-happen and leave a blank. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ stream: string }> }) {
  const { stream } = await params;
  const g = await guard(stream);
  if ('error' in g) return NextResponse.json({ error: g.error }, { status: g.status });
  // A body is optional so an empty note can still be created directly if anything needs to.
  const body = await req.json().catch(() => ({}));
  const parsed = CreateSchema.safeParse(body);
  try {
    return NextResponse.json({
      ok: true,
      idea: await createIdea(stream, parsed.success ? (parsed.data.text ?? '') : ''),
    });
  } catch (err) {
    console.error('[ideas] create failed:', err);
    return NextResponse.json({ error: 'Could not start a note.' }, { status: 502 });
  }
}

const PatchSchema = z.object({
  id: z.string().trim().min(1).max(80),
  text: z.string().max(20000),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ stream: string }> }) {
  const { stream } = await params;
  const g = await guard(stream);
  if ('error' in g) return NextResponse.json({ error: g.error }, { status: g.status });

  let body: z.infer<typeof PatchSchema>;
  try {
    body = PatchSchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: 'invalid request' }, { status: 400 });
  }
  try {
    const idea = await updateIdea(stream, body.id, { text: body.text });
    if (!idea) return NextResponse.json({ error: 'That note is gone.' }, { status: 404 });
    return NextResponse.json({ ok: true, idea });
  } catch (err) {
    console.error('[ideas] save failed:', err);
    return NextResponse.json({ error: 'Could not save that.' }, { status: 502 });
  }
}

const DeleteSchema = z.object({ id: z.string().trim().min(1).max(80) });

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ stream: string }> }) {
  const { stream } = await params;
  const g = await guard(stream);
  if ('error' in g) return NextResponse.json({ error: g.error }, { status: g.status });
  let body: z.infer<typeof DeleteSchema>;
  try {
    body = DeleteSchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: 'invalid request' }, { status: 400 });
  }
  try {
    await deleteIdea(stream, body.id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[ideas] delete failed:', err);
    return NextResponse.json({ error: 'Could not delete that.' }, { status: 502 });
  }
}
