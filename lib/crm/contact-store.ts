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
const COLS =
  'id, owner, email, name, business, role_title, phone, stage, notes, next_action, ' +
  'next_action_at, last_contacted_at, source, blueprint_id, fireflies_transcript_id, ' +
  'fireflies_url, synced_at, created_at, updated_at';

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
  const { data, error } = await supabaseService()
    .from('leads')
    .select(COLS)
    .eq('owner', owner)
    .order('created_at', { ascending: false });
  if (error) throw new Error(`[crm.list] ${error.code ?? ''} ${error.message}`);
  return (data ?? []).map((r) => rowToContact(r as unknown as Record<string, unknown>));
}

/** Every contact across every CRM. For the dashboard counts. */
export async function listAllContacts(): Promise<CrmContact[]> {
  const { data, error } = await supabaseService()
    .from('leads')
    .select(COLS)
    .order('created_at', { ascending: false });
  if (error) throw new Error(`[crm.listAll] ${error.code ?? ''} ${error.message}`);
  return (data ?? []).map((r) => rowToContact(r as unknown as Record<string, unknown>));
}

export async function getContact(id: string): Promise<CrmContact | null> {
  const { data, error } = await supabaseService()
    .from('leads')
    .select(COLS)
    .eq('id', id)
    .maybeSingle();
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

  const { data, error } = await supabaseService()
    .from('leads')
    .upsert(row, { onConflict: 'owner,email' })
    .select(COLS)
    .single();
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
  const { data, error } = await supabaseService()
    .from('leads')
    .update(row)
    .eq('id', id)
    .select(COLS)
    .single();
  if (error) throw new Error(`[crm.patch] ${error.code ?? ''} ${error.message}`);
  return rowToContact(data as unknown as Record<string, unknown>);
}

export async function deleteContact(id: string): Promise<void> {
  const { error } = await supabaseService().from('leads').delete().eq('id', id);
  if (error) throw new Error(`[crm.delete] ${error.code ?? ''} ${error.message}`);
}

