/**
 * The CRM's shape: stages, the contact type, and the pure helpers over them.
 *
 * SEPARATE FROM contact-store.ts ON PURPOSE. The store imports the Supabase
 * service-role client, and the CRM's UI needs the stage list and the types. Importing
 * them from the store would pull server-only code into the browser bundle, so anything
 * with no database in it lives here instead.
 */

/**
 * The pipeline. Five working stages and two endings, which is the smallest set
 * that still answers "what do I do next" for every row.
 *
 * Marrs asked for "a simple CRM tracking system based on best practise", so this
 * is the standard B2B shape mapped onto how Polynize actually sells: a lead
 * arrives, someone reaches out, a call happens, a capability map or proposal goes
 * out, and it closes one way or the other.
 */
export const CRM_STAGES = [
  { id: 'new', label: 'New', hint: 'Just arrived. Nobody has touched it yet.' },
  { id: 'contacted', label: 'Contacted', hint: 'Reached out, waiting to hear back.' },
  { id: 'meeting', label: 'Meeting', hint: 'A call is booked or has happened.' },
  { id: 'proposal', label: 'Proposal', hint: 'A map or proposal is with them.' },
  { id: 'won', label: 'Won', hint: 'Closed. They are a client.' },
  { id: 'lost', label: 'Lost', hint: 'Closed. Not proceeding.' },
] as const;

export type CrmStage = (typeof CRM_STAGES)[number]['id'];

const STAGE_IDS = new Set<string>(CRM_STAGES.map((s) => s.id));

/** Stages that are still live work. Used for the "open" counts on the dashboard. */
export const OPEN_STAGES: CrmStage[] = ['new', 'contacted', 'meeting', 'proposal'];

export function isCrmStage(v: unknown): v is CrmStage {
  return typeof v === 'string' && STAGE_IDS.has(v);
}

export function stageLabel(id: string): string {
  return CRM_STAGES.find((s) => s.id === id)?.label ?? id;
}

/** Where a contact came from. Free text in the database; these are the ones we set. */
export type CrmSource = 'blueprint' | 'manual' | 'fireflies' | 'engagement';

export type CrmContact = {
  id: string;
  /** Whose CRM this is. A marketing stream id: polynize, marrs, shourov, kristin, julian. */
  owner: string;
  email: string;
  name?: string;
  /** Company. Called `business` in the table since the website form named it that. */
  business?: string;
  role_title?: string;
  phone?: string;
  stage: CrmStage;
  notes?: string;
  next_action?: string;
  next_action_at?: string;
  last_contacted_at?: string;
  source: string;
  /** The blueprint this contact generated on the website, if they came that way. */
  blueprint_id?: string;
  fireflies_transcript_id?: string;
  fireflies_url?: string;
  /** When this was pushed to kit.com. Owned by the sync, not by the CRM. */
  synced_at?: string;
  created_at: string;
  updated_at: string;
};

export type OwnerCounts = { total: number; open: number; new_count: number; won: number };

/**
 * Per-owner counts for the dashboard cards, from a single read.
 *
 * One query and a group in memory rather than a count per owner: five round trips
 * to render five numbers is five chances to be slow on the page people open first.
 */
export function countByOwner(contacts: CrmContact[]): Map<string, OwnerCounts> {
  const out = new Map<string, OwnerCounts>();
  for (const c of contacts) {
    const cur = out.get(c.owner) ?? { total: 0, open: 0, new_count: 0, won: 0 };
    cur.total += 1;
    if (OPEN_STAGES.includes(c.stage)) cur.open += 1;
    if (c.stage === 'new') cur.new_count += 1;
    if (c.stage === 'won') cur.won += 1;
    out.set(c.owner, cur);
  }
  return out;
}

/**
 * Sort for the CRM list: what needs doing, soonest first.
 *
 * Anything with a dated next action outranks anything without one, because a date
 * is a commitment and an undated row is a maybe. Within the undated remainder,
 * newest first, so a lead that just arrived is at the top rather than buried under
 * contacts from months ago.
 */
export function sortForWork(contacts: CrmContact[]): CrmContact[] {
  return [...contacts].sort((a, b) => {
    const ad = a.next_action_at;
    const bd = b.next_action_at;
    if (ad && bd) return ad.localeCompare(bd);
    if (ad) return -1;
    if (bd) return 1;
    return (b.created_at ?? '').localeCompare(a.created_at ?? '');
  });
}

/** True when a dated next action is today or overdue. Drives the coral flag in the UI. */
export function isDue(c: CrmContact, now = new Date()): boolean {
  if (!c.next_action_at) return false;
  return new Date(c.next_action_at).getTime() <= now.getTime();
}

/**
 * WHERE A LEAD'S CAPABILITY BLUEPRINT LIVES.
 *
 * Marrs: "have the link in the email that gets sent to me and in the dashboard itself to the
 * capability blueprint that they created. That's important so I can see the blueprint."
 *
 * Defined once because two callers need it (the CRM row and the new-lead email) and a link
 * that works in one place and 404s in the other is worse than no link. The row lives in
 * `sales_blueprints`, which is served at /map-your-team/[id], NOT /blueprints/[id].
 */
export function blueprintUrl(blueprintId: string, origin = ''): string {
  return `${origin.replace(/\/+$/, '')}/map-your-team/${blueprintId}`;
}
