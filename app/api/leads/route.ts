/**
 * Leads API for the leads agent (Leo).
 *
 *   GET  /api/leads?unsynced=1&limit=100&since=<iso>
 *     Returns leads newest first. `unsynced=1` restricts to leads not yet
 *     pushed to kit.com (synced_at is null). `since` filters by created_at.
 *
 *   POST /api/leads/synced   { ids: string[] }   (this route: { ids }, mark=synced)
 *     Marks leads as synced (stamps synced_at=now) so the agent does not
 *     reprocess them. Sent as POST to this same route with { ids }.
 *
 * Auth: Bearer $POLYNIZE_LEADS_KEY on every request. Missing/invalid -> 401.
 * This is the ONLY way the agent reaches leads; the table is not publicly
 * readable (RLS on, service-role only).
 */

import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { supabaseService } from '@/lib/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

function verifyBearer(req: Request): boolean {
  const expected = process.env.POLYNIZE_LEADS_KEY;
  if (!expected) return false;
  const header = req.headers.get('authorization');
  if (!header) return false;
  const sep = header.indexOf(' ');
  if (sep === -1) return false;
  const scheme = header.slice(0, sep);
  const key = header.slice(sep + 1).trim();
  if (scheme.toLowerCase() !== 'bearer' || !key) return false;
  try {
    return constantTimeEqual(key, expected);
  } catch {
    return false;
  }
}

const LEAD_COLUMNS = 'id, email, name, business, blueprint_id, source, synced_at, created_at, updated_at';
/** The label columns from migration 0014 (D97); Leo's segmentation reads use_case first. */
const LABEL_COLUMNS = ', use_case, use_case_confidence, utm';

export async function GET(req: Request) {
  if (!verifyBearer(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!process.env.SUPABASE_URL) {
    return NextResponse.json({ error: 'Persistence not configured' }, { status: 503 });
  }

  const url = new URL(req.url);
  const unsynced = url.searchParams.get('unsynced') === '1';
  const since = url.searchParams.get('since');
  const email = url.searchParams.get('email');
  const limit = Math.min(Math.max(Number(url.searchParams.get('limit')) || 100, 1), 500);

  try {
    const run = async (columns: string) => {
      let query = supabaseService()
        .from('leads')
        .select(columns)
        .order('created_at', { ascending: false })
        .limit(limit);
      if (unsynced) query = query.is('synced_at', null);
      if (since) query = query.gte('created_at', since);
      if (email) query = query.eq('email', email.trim().toLowerCase());
      return query;
    };
    // With the label columns first; without them if migration 0014 is not applied yet (D97).
    let { data, error } = await run(LEAD_COLUMNS + LABEL_COLUMNS);
    if (error && (error.code === '42703' || error.code === 'PGRST204')) {
      ({ data, error } = await run(LEAD_COLUMNS));
    }
    if (error) throw error;
    return NextResponse.json({ ok: true, count: data?.length ?? 0, leads: data ?? [] });
  } catch (e) {
    const detail = e instanceof Error ? e.message : JSON.stringify(e);
    console.error(`[leads.list] failed: ${detail}`);
    return NextResponse.json({ ok: false, error: 'lookup_failed', detail }, { status: 502 });
  }
}

const MarkSyncedSchema = z.object({ ids: z.array(z.string().uuid()).min(1).max(500) });

/** Mark leads as synced to kit.com. Body: { ids: string[] }. */
export async function POST(req: Request) {
  if (!verifyBearer(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!process.env.SUPABASE_URL) {
    return NextResponse.json({ error: 'Persistence not configured' }, { status: 503 });
  }

  let body: z.infer<typeof MarkSyncedSchema>;
  try {
    body = MarkSyncedSchema.parse(await req.json());
  } catch {
    return NextResponse.json({ ok: false, error: 'Body must be { ids: string[] }' }, { status: 400 });
  }

  try {
    const { data, error } = await supabaseService()
      .from('leads')
      .update({ synced_at: new Date().toISOString() })
      .in('id', body.ids)
      .select('id');
    if (error) throw error;
    return NextResponse.json({ ok: true, updated: data?.length ?? 0 });
  } catch (e) {
    const detail = e instanceof Error ? e.message : JSON.stringify(e);
    console.error(`[leads.mark-synced] failed: ${detail}`);
    return NextResponse.json({ ok: false, error: 'update_failed', detail }, { status: 502 });
  }
}
