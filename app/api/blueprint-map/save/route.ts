import { NextResponse } from 'next/server';
import { z } from 'zod';
import { supabaseService } from '@/lib/supabase';
import { validateSalesBlueprint } from '@/lib/agents/sales-blueprint-schema';

export const runtime = 'nodejs';

const BodySchema = z.object({
  id: z.string().uuid().optional(),
  data: z.record(z.string(), z.unknown()),
  /** Lead fields captured at intake on the public funnel. Absent for consultant-run maps. */
  email: z.string().max(320).optional(),
  business: z.string().max(300).optional(),
});

/**
 * POST /api/blueprint-map/save
 *
 * Persists a sales blueprint so it can live at /blueprint/<id> and be shared.
 * Insert when no id is given, update in place when it is. Best-effort: if
 * Supabase or the sales_blueprints table is unavailable, returns 503 with
 * ok:false so the client can degrade gracefully (the map still works in the
 * session, Share just stays disabled).
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

  // Only send lead columns when we actually have values, so a chat edit from the
  // shared /blueprint/[id] view (which carries no lead) never nulls them out.
  const lead: Record<string, string> = {};
  if (body.email?.trim()) lead.email = body.email.trim();
  if (body.business?.trim()) lead.business = body.business.trim();

  try {
    const sb = supabaseService();

    // The email/business columns arrived in migration 0011. If that migration has
    // not been applied yet, retry without them rather than losing the blueprint.
    // PostgREST reports an unknown column as PGRST204 with a message like
    // "Could not find the 'business' column of 'sales_blueprints' in the schema
    // cache". Postgres itself says "column ... does not exist". Match both.
    const isMissingLeadColumn = (e: unknown) => {
      const err = (e ?? {}) as { code?: string; message?: string };
      if (err.code === 'PGRST204') return true;
      const msg = typeof err.message === 'string' ? err.message : String(e ?? '');
      return /could not find the '(email|business)' column|column .*(email|business).* does not exist/i.test(
        msg
      );
    };

    if (body.id) {
      const base = { content, client: content.client, updated_at: new Date().toISOString() };
      let { data, error } = await sb
        .from('sales_blueprints')
        .update({ ...base, ...lead })
        .eq('id', body.id)
        .select('id')
        .maybeSingle();
      if (error && isMissingLeadColumn(error)) {
        console.warn('[blueprint-map.save] lead columns missing, retrying update without them');
        ({ data, error } = await sb
          .from('sales_blueprints')
          .update(base)
          .eq('id', body.id)
          .select('id')
          .maybeSingle());
      }
      if (error) throw error;
      // If the id no longer exists, fall through to an insert so the share link still resolves.
      if (data?.id) return NextResponse.json({ ok: true, id: data.id });
    }

    const base = { content, client: content.client };
    let { data, error } = await sb
      .from('sales_blueprints')
      .insert({ ...base, ...lead })
      .select('id')
      .single();
    if (error && isMissingLeadColumn(error)) {
      console.warn('[blueprint-map.save] lead columns missing, retrying insert without them');
      ({ data, error } = await sb.from('sales_blueprints').insert(base).select('id').single());
    }
    if (error || !data) throw error ?? new Error('insert returned no row');
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
