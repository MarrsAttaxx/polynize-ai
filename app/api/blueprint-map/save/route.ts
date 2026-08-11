import { NextResponse } from 'next/server';
import { z } from 'zod';
import { supabaseService } from '@/lib/supabase';
import { validateSalesBlueprint } from '@/lib/agents/sales-blueprint-schema';
import { captureLead } from '@/lib/leads';

export const runtime = 'nodejs';

const BodySchema = z.object({
  id: z.string().uuid().optional(),
  data: z.record(z.string(), z.unknown()),
  /** Lead fields captured at intake on the public funnel. Absent for consultant-run maps. */
  name: z.string().max(200).optional(),
  email: z.string().max(320).optional(),
  business: z.string().max(300).optional(),
});

/**
 * POST /api/blueprint-map/save
 *
 * Persists a sales blueprint so it can live at /map-your-team/<id> and be shared.
 * Insert when no id is given, update in place when it is. Best-effort: if
 * Supabase or the sales_blueprints table is unavailable, returns 503 with
 * ok:false so the client can degrade gracefully (the map still works in the
 * session, Share just stays disabled).
 *
 * On the first save of a public-funnel blueprint (the insert path, where lead
 * fields are present) it also captures the lead into the `leads` table. Lead
 * capture is best-effort: it never blocks or fails the blueprint save.
 */
export async function POST(req: Request) {
  let body: z.infer<typeof BodySchema>;
  try {
    body = BodySchema.parse(await req.json());
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid request body' }, { status: 400 });
  }

  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ ok: false, error: 'Persistence not configured' }, { status: 503 });
  }

  // Re-validate so we never persist a malformed envelope.
  const validation = validateSalesBlueprint(body.data);
  if (!validation.ok) {
    return NextResponse.json({ ok: false, error: `Invalid blueprint: ${validation.error}` }, { status: 400 });
  }
  const content = validation.data;

  try {
    const sb = supabaseService();

    if (body.id) {
      const { data, error } = await sb
        .from('sales_blueprints')
        .update({ content, client: content.client, updated_at: new Date().toISOString() })
        .eq('id', body.id)
        .select('id')
        .maybeSingle();
      if (error) throw error;
      // If the id no longer exists, fall through to an insert so the share link still resolves.
      if (data?.id) return NextResponse.json({ ok: true, id: data.id });
    }

    const { data, error } = await sb
      .from('sales_blueprints')
      .insert({ content, client: content.client })
      .select('id')
      .single();
    if (error || !data) throw error ?? new Error('insert returned no row');

    // First save of a funnel blueprint: capture the lead. Fire and forget so a
    // missing leads table or a duplicate email never affects the blueprint save.
    if (body.email?.trim()) {
      await captureLead({
        email: body.email,
        name: body.name,
        business: body.business,
        blueprintId: data.id,
      });
    }

    return NextResponse.json({ ok: true, id: data.id });
  } catch (e) {
    // Supabase errors are plain objects, not Error instances, so String(e)
    // renders "[object Object]". Serialise so the log is actually useful.
    const detail =
      e instanceof Error ? e.message : typeof e === 'object' ? JSON.stringify(e) : String(e);
    console.error(`[blueprint-map.save] failed: ${detail}`);
    return NextResponse.json({ ok: false, error: 'save_failed', detail }, { status: 503 });
  }
}
