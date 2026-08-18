import { NextResponse } from 'next/server';
import { supabaseService } from '@/lib/supabase';
import { validateJobBlueprint } from '@/lib/agents/job-blueprint-schema';

export const runtime = 'nodejs';

/**
 * GET /api/job-map/<id>
 *
 * The polling endpoint the working screen hits while generation runs, and the read behind
 * /job-mapping/<id>.
 *
 * It returns the status and, when ready, the blueprint. It deliberately does NOT return the
 * email or name on the row: this id travels in an email link and is effectively public, so
 * the response carries only the document.
 */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;

  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    return NextResponse.json({ ok: false, error: 'Not found' }, { status: 404 });
  }
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ ok: false, error: 'Persistence not configured' }, { status: 503 });
  }

  const sb = supabaseService();
  const { data, error } = await sb
    .from('job_blueprints')
    .select('status, content, error')
    .eq('id', id)
    .maybeSingle();

  if (error) {
    console.error('[job-map.get] query failed', error);
    return NextResponse.json({ ok: false, error: 'Lookup failed' }, { status: 503 });
  }
  if (!data) return NextResponse.json({ ok: false, error: 'Not found' }, { status: 404 });

  if (data.status !== 'ready') {
    return NextResponse.json({ ok: true, status: data.status, error: data.error ?? null });
  }

  const validation = validateJobBlueprint(data.content);
  if (!validation.ok) {
    return NextResponse.json({ ok: true, status: 'failed', error: validation.error });
  }
  return NextResponse.json({ ok: true, status: 'ready', blueprint: validation.data });
}
