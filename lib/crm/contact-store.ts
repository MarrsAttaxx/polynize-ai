import { supabaseService } from '../supabase';
import { isCrmStage, type CrmContact, type CrmSource, type CrmStage } from './model';

export * from './model';

/**
 * The CRM. One contact per (owner, email) in the `leads` table.
 *
 * SERVER ONLY — this reaches Supabase with the service-role key, so it must never
 * be imported from a client component. The route handlers under /console/leads are
 * the boundary.
 *
 * The table is shared with the website capture path (`lib/leads.ts`) and the
 * kit.com sync (`/api/leads`), which is deliberate: a website lead has to show up
 * in Polynize's CRM the moment it lands, and a copy in a second table could
 * disagree with this one. See supabase/migrations/0012_crm.sql for the reasoning.
 */

/** The columns the CRM reads. Explicit, so adding a column cannot silently change reads. */
const BASE_COLS =
  'id, owner, email, name, business, role_title, phone, stage, notes, next_action, ' +
  'next_action_at, last_contacted_at, source, blueprint_id, fireflies_transcript_id, ' +
  'fireflies_url, synced_at, created_at, updated_at';
/** The label columns from migration 0014 (D97). Read when the table has them; see cols(). */
const LABEL_COLS = ', use_case, use_case_confidence';

/**
 * WHICH COLUMNS TO ASK FOR. Migration 0014 adds the label columns, and until it is applied a
 * select naming them fails for every row, which would take the whole CRM down over a feature it
 * did not have yesterday. So the first read asks for them; if Postgres says the column does not
 * exist, this process remembers and asks for the base set from then on. One failed read per
 * cold start, never a broken CRM.
 */
let labelColumnsMissing = false;
function cols(): string {
  return labelColumnsMissing ? BASE_COLS : BASE_COLS + LABEL_COLS;
}
function isUnknownColumn(error: { code?: string; message?: string }): boolean {
  return error.code === '42703' || error.code === 'PGRST204' || /column .* does not exist/i.test(error.message ?? '');
}
/** Run a read once, and once more with the base columns if the label columns are not there yet. */
async function withCols<T>(
  run: (c: string) => PromiseLike<{ data: T; error: { code?: string; message?: string } | null }>
): Promise<{ data: T; error: { code?: string; message?: string } | null }> {
  let res = await run(cols());
  if (res.error && !labelColumnsMissing && isUnknownColumn(res.error)) {
    labelColumnsMissing = true;
    console.error('[crm] leads table has no use_case columns yet (migration 0014 not applied); reading without them');
    res = await run(cols());
  }
  return res;
}

function rowToContact(r: Record<string, unknown>): CrmContact {
  const stage = r.stage;
  return {
    id: String(r.id),
    owner: String(r.owner ?? 'polynize'),
    email: String(r.email ?? ''),
    name: (r.name as string) ?? undefined,
    business: (r.business as string) ?? undefined,
    role_title: (r.role_title as string) ?? undefined,
    phone: (r.phone as string) ?? undefined,
    // An unknown stage falls back to `new` rather than rendering a broken column: the
    // row is real work and must stay visible even if the value is nonsense.
    stage: isCrmStage(stage) ? stage : 'new',
    notes: (r.notes as string) ?? undefined,
    next_action: (r.next_action as string) ?? undefined,
    next_action_at: (r.next_action_at as string) ?? undefined,
    last_contacted_at: (r.last_contacted_at as string) ?? undefined,
    source: String(r.source ?? 'manual'),
    blueprint_id: (r.blueprint_id as string) ?? undefined,
    fireflies_transcript_id: (r.fireflies_transcript_id as string) ?? undefined,
    fireflies_url: (r.fireflies_url as string) ?? undefined,
    use_case: (r.use_case as string) ?? undefined,
    use_case_confidence: (r.use_case_confidence as string) ?? undefined,
    synced_at: (r.synced_at as string) ?? undefined,
    created_at: String(r.created_at ?? ''),
    updated_at: String(r.updated_at ?? ''),
  };
}

/**
 * Every contact in one owner's CRM, newest first.
 *
 * Throws on a database error rather than returning []: an empty CRM and a broken
 * CRM look identical on screen, and telling someone they have no contacts when
 * they have forty is worse than showing them an error.
 */
export async function listContacts(owner: string): Promise<CrmContact[]> {
  const { data, error } = await withCols((c) =>
    supabaseService().from('leads').select(c).eq('owner', owner).order('created_at', { ascending: false })
  );
  if (error) throw new Error(`[crm.list] ${error.code ?? ''} ${error.message}`);
  return (data ?? []).map((r) => rowToContact(r as unknown as Record<string, unknown>));
}

/** Every contact across every CRM. For the dashboard counts. */
export async function listAllContacts(): Promise<CrmContact[]> {
  const { data, error } = await withCols((c) =>
    supabaseService().from('leads').select(c).order('created_at', { ascending: false })
  );
  if (error) throw new Error(`[crm.listAll] ${error.code ?? ''} ${error.message}`);
  return (data ?? []).map((r) => rowToContact(r as unknown as Record<string, unknown>));
}

export async function getContact(id: string): Promise<CrmContact | null> {
  const { data, error } = await withCols((c) =>
    supabaseService().from('leads').select(c).eq('id', id).maybeSingle()
  );
  if (error) throw new Error(`[crm.get] ${error.code ?? ''} ${error.message}`);
  return data ? rowToContact(data as unknown as Record<string, unknown>) : null;
}

export type NewContact = {
  owner: string;
  email: string;
  name?: string;
  business?: string;
  role_title?: string;
  phone?: string;
  stage?: CrmStage;
  notes?: string;
  next_action?: string;
  next_action_at?: string;
  source?: CrmSource;
  fireflies_transcript_id?: string;
  fireflies_url?: string;
};

/**
 * Add a contact, or update the existing one for that (owner, email).
 *
 * UPSERT AND NOT INSERT, so adding someone who is already in your CRM edits them
 * instead of failing with a constraint error. That is what the person meant by
 * doing it, and it makes the Fireflies import idempotent for free.
 *
 * Only the fields provided are written, so a Fireflies import that knows a name
 * and a summary cannot blank out a phone number typed in by hand.
 */
export async function upsertContact(input: NewContact): Promise<CrmContact> {
  const email = input.email.trim().toLowerCase();
  if (!email) throw new Error('[crm.upsert] an email is required');
  const owner = input.owner.trim();
  if (!owner) throw new Error('[crm.upsert] an owner is required');

  const now = new Date().toISOString();
  const row: Record<string, unknown> = { owner, email, updated_at: now };
  const put = (k: keyof NewContact, col = k as string) => {
    const v = input[k];
    if (typeof v === 'string' ? v.trim() !== '' : v !== undefined) {
      row[col] = typeof v === 'string' ? v.trim() : v;
    }
  };
  put('name');
  put('business');
  put('role_title');
  put('phone');
  put('notes');
  put('next_action');
  put('next_action_at');
  put('fireflies_transcript_id');
  put('fireflies_url');
  row.stage = input.stage && isCrmStage(input.stage) ? input.stage : 'new';
  row.source = input.source ?? 'manual';

  // The upsert is idempotent, so the one retry withCols may do is safe.
  const { data, error } = await withCols((c) =>
    supabaseService().from('leads').upsert(row, { onConflict: 'owner,email' }).select(c).single()
  );
  if (error) throw new Error(`[crm.upsert] ${error.code ?? ''} ${error.message}`);
  return rowToContact(data as unknown as Record<string, unknown>);
}

/** Patch one contact by id. Only the keys present are written. */
export async function patchContact(
  id: string,
  patch: Partial<Omit<CrmContact, 'id' | 'owner' | 'email' | 'created_at' | 'updated_at'>>
): Promise<CrmContact> {
  const row: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const [k, v] of Object.entries(patch)) {
    // null is meaningful here: it CLEARS a field (a next action that is done). undefined
    // means "not mentioned" and must not reach the update.
    if (v !== undefined) row[k] = v === '' ? null : v;
  }
  const { data, error } = await withCols((c) =>
    supabaseService().from('leads').update(row).eq('id', id).select(c).single()
  );
  if (error) throw new Error(`[crm.patch] ${error.code ?? ''} ${error.message}`);
  return rowToContact(data as unknown as Record<string, unknown>);
}

export async function deleteContact(id: string): Promise<void> {
  const { error } = await supabaseService().from('leads').delete().eq('id', id);
  if (error) throw new Error(`[crm.delete] ${error.code ?? ''} ${error.message}`);
}

