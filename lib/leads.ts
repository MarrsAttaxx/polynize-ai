import { supabaseService } from './supabase';

/**
 * Lead capture for the polynize.ai capability blueprint funnel.
 *
 * The `leads` table (migration 0011) is the system of record for inbound
 * prospects and the staging point for the eventual kit.com newsletter sync.
 * The leads agent reads from it through GET /api/leads.
 */

export type LeadInput = {
  email: string;
  name?: string;
  business?: string;
  blueprintId?: string;
};

/**
 * Upsert a lead by email. Idempotent: a returning visitor updates their row
 * rather than creating a duplicate. Best-effort by contract, callers must not
 * let a lead failure affect the primary operation, so this never throws. It
 * returns whether the lead landed, purely for logging.
 */
export async function captureLead(input: LeadInput): Promise<boolean> {
  const email = input.email.trim().toLowerCase();
  if (!email) return false;

  const row: Record<string, unknown> = { email, source: 'blueprint' };
  if (input.name?.trim()) row.name = input.name.trim();
  if (input.business?.trim()) row.business = input.business.trim();
  if (input.blueprintId) row.blueprint_id = input.blueprintId;
  // Touch updated_at on every upsert so re-submissions surface as recent.
  row.updated_at = new Date().toISOString();

  try {
    const { error } = await supabaseService()
      .from('leads')
      .upsert(row, { onConflict: 'email' });
    if (error) {
      // A missing table (migration not applied yet) or any other write error is
      // logged and swallowed. The blueprint still saved; the lead just did not.
      console.warn(`[leads.capture] lead not stored (${error.code ?? 'error'}): ${error.message}`);
      return false;
    }
    return true;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn(`[leads.capture] threw, lead not stored: ${msg}`);
    return false;
  }
}
