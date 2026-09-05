import { supabaseService } from './supabase';
import { pingNewLead } from './crm/notify';
import { isUseCaseId } from './marketing/use-case';
import type { Attribution } from './marketing/tracking-link';

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
  /**
   * ONLY EVER A sales_blueprints ID. `leads.blueprint_id` is a foreign key to that table
   * (migration 0011), so passing an id from any other table makes the upsert fail its FK
   * check, and because this function swallows write errors by design the lead then
   * disappears in silence. That is exactly what happened to the first cut of /job-mapping.
   * Funnels with their own blueprint table must leave this unset and be identified by
   * `source` instead; their own row already carries the email to join on.
   */
  blueprintId?: string;
  /**
   * Which funnel this came from. Free text on the table with a default of 'blueprint', so
   * a new funnel can label itself without a migration. Used to tell a team map apart from
   * a job map in the CRM.
   */
  source?: string;
  /**
   * WHICH POST SENT THEM (D97): the labels off the arrival url, read back from the httpOnly cookie
   * by the caller (lib/attribution-cookie.ts). Written to `utm`, and when the campaign label is one
   * of the six use-case ids, to `use_case` with confidence 'utm'. Null or absent writes nothing.
   */
  attribution?: Attribution | null;
};

/** Postgres "column does not exist", and PostgREST's schema-cache equivalent. */
function isUnknownColumn(error: { code?: string; message?: string }): boolean {
  return error.code === '42703' || error.code === 'PGRST204' || /column .* does not exist/i.test(error.message ?? '');
}

/**
 * Upsert a lead by email. Idempotent: a returning visitor updates their row
 * rather than creating a duplicate. Best-effort by contract, callers must not
 * let a lead failure affect the primary operation, so this never throws. It
 * returns whether the lead landed, purely for logging.
 */
export async function captureLead(input: LeadInput): Promise<boolean> {
  const email = input.email.trim().toLowerCase();
  if (!email) return false;

  /**
   * OWNER = POLYNIZE. Website leads belong to the Polynize CRM, which is exactly what
   * Marrs described: "That's where we keep the leads that come in through the website
   * polynize.ai. When a lead fills in the blueprint form, this is where it needs to go."
   *
   * Set explicitly rather than left to the column default, so this stays true if the
   * default ever changes.
   *
   * NOTE the conflict target moved with migration 0012: uniqueness is now (owner, email)
   * and no longer email alone, so that two people can each hold the same contact in
   * their own CRM. For this path the behaviour is unchanged, since every website lead
   * has the same owner.
   */
  const row: Record<string, unknown> = { email, source: input.source ?? 'blueprint', owner: 'polynize' };
  if (input.name?.trim()) row.name = input.name.trim();
  if (input.business?.trim()) row.business = input.business.trim();
  if (input.blueprintId) row.blueprint_id = input.blueprintId;
  // Touch updated_at on every upsert so re-submissions surface as recent.
  row.updated_at = new Date().toISOString();

  /**
   * THE LABEL, ONLY WHEN THERE IS ONE, and only the first time. A returning visitor who came back
   * unlabelled must not blank the label that brought them; one who came back from a different post
   * keeps the first (the cookie is first-touch, so this only matters when the cookie has expired).
   * The three fields are split out so a database that has not had migration 0014 applied can be
   * retried without them below, rather than losing the lead.
   */
  const labelled: Record<string, unknown> = {};
  if (input.attribution) {
    labelled.utm = input.attribution;
    if (isUseCaseId(input.attribution.campaign)) {
      labelled.use_case = input.attribution.campaign;
      labelled.use_case_confidence = 'utm';
    }
  }

  /**
   * IS THIS PERSON NEW? Asked BEFORE the upsert, because an upsert cannot tell you
   * afterwards whether it inserted or updated, and the ping must only fire for someone
   * genuinely new. Otherwise a returning visitor re-running the blueprint form would
   * announce themselves again as a fresh lead, which is how a notification becomes noise
   * and then gets muted.
   *
   * A failure to check is treated as "not new", so an unreadable table costs a
   * notification rather than sending a false one.
   */
  let isNew = false;
  try {
    const { data } = await supabaseService()
      .from('leads')
      .select('id')
      .eq('owner', 'polynize')
      .eq('email', email)
      .maybeSingle();
    isNew = !data;
  } catch {
    isNew = false;
  }

  try {
    let { error } = await supabaseService()
      .from('leads')
      .upsert({ ...row, ...labelled }, { onConflict: 'owner,email' });
    if (error && Object.keys(labelled).length > 0 && isUnknownColumn(error)) {
      /**
       * MIGRATION 0014 NOT APPLIED YET. The lead must land anyway: a label is worth less than the
       * lead it labels. Said loudly in the log, because this is the one signal that the SQL still
       * needs pasting into Supabase, and a silent fallback would hide it for months.
       */
      console.error(
        '[leads.capture] the leads table has no use_case/utm columns yet (migration 0014 not applied); storing the lead without its label'
      );
      ({ error } = await supabaseService().from('leads').upsert(row, { onConflict: 'owner,email' }));
    }
    if (error) {
      // A missing table (migration not applied yet) or any other write error is
      // logged and swallowed. The blueprint still saved; the lead just did not.
      console.warn(`[leads.capture] lead not stored (${error.code ?? 'error'}): ${error.message}`);
      return false;
    }

    /**
     * Ping whoever is on the Polynize notify list. AWAITED, not fired and forgotten: on
     * a serverless function the response can end the invocation and kill an unawaited
     * promise mid-flight, so a background send is a send that sometimes silently does not
     * happen. pingNewLead never throws and returns quickly, and the lead is already
     * committed by this point, so awaiting it cannot cost the lead.
     */
    if (isNew) {
      const res = await pingNewLead({
        owner: 'polynize',
        email,
        name: input.name,
        business: input.business,
        blueprintId: input.blueprintId,
      });
      console.log(
        `[leads.capture] new lead ${email}; pinged ${res.sent}${res.skipped ? ` (${res.skipped})` : ''}`
      );
    }
    return true;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn(`[leads.capture] threw, lead not stored: ${msg}`);
    return false;
  }
}
