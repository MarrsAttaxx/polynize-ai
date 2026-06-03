import YAML from 'yaml';
import {
  readClientFile,
  readClientFileLastCommit,
  listAccessibleRepoSlugs,
} from '@/lib/github-client';
import { CONSOLE_CLIENTS } from '../_config/clients';
import { loadEngagementReadiness } from './load-readiness';
import type {
  BlueprintSchemaVersion,
  EngagementPhase,
  EngagementStatus,
  LockState,
  WorkPlanRegistryEntry,
} from '@/lib/blueprint/schema-v2';

export type RagLevel = 'red' | 'amber' | 'green';

export type ClientStatus = {
  rag: RagLevel;
  reason?: string;
  setAt?: string;
  setBy?: string;
};

export type ClientCardData = {
  slug: string;
  name: string;
  leadHuman: string;
  leadEmail: string;
  phase: string;
  subPhase: string;
  gateNext: string;
  lastUpdated: Date | null;
  status: ClientStatus;
  // Stage 2 additions — all optional / safely defaulted
  engagementStatus: EngagementStatus;
  engagementPhase: EngagementPhase | null;
  blueprintSchemaVersion: BlueprintSchemaVersion;
  workPlanRegistry: WorkPlanRegistryEntry[];
  lock: LockState | null;
  /**
   * Engagement readiness (0-100), computed by the SAME shared calc the
   * Blueprint page uses, so the dashboard and the Blueprint never show
   * different numbers. null only if it could not be computed at all.
   */
  readiness: number | null;
  prospect: {
    blueprintId?: string;
    email?: string;
    firstName?: string;
  } | null;
  error?: string;
};

type ParsedConfig = {
  client?: { name?: string; lead_human?: string; lead_email?: string };
  engagement?: { phase?: string; sub_phase?: string; gate_next?: string };
  status?: {
    rag?: string | null;
    rag_reason?: string | null;
    rag_set_at?: string | null;
    rag_set_by?: string | null;
  } | null;
  // Stage 2 fields
  engagement_status?: string | null;
  engagement_phase?: string | null;
  prospect_blueprint_id?: string | null;
  prospect_email?: string | null;
  prospect_first_name?: string | null;
  lock?: LockState | null;
  work_plan_registry?: WorkPlanRegistryEntry[] | null;
  blueprint_schema_version?: string | null;
};

const DEFAULT_STATUS: ClientStatus = { rag: 'green' };

/**
 * Coerce free-form YAML input into a typed ClientStatus. Anything missing
 * or malformed falls back to green so a typo in a single field cannot break
 * the dashboard. The valid `rag` values are red/amber/green (case-insensitive);
 * unrecognised strings are treated as green and the field is logged.
 */
function parseStatus(raw: ParsedConfig['status']): ClientStatus {
  if (!raw || typeof raw !== 'object') return DEFAULT_STATUS;

  const ragInput = typeof raw.rag === 'string' ? raw.rag.trim().toLowerCase() : '';
  const rag: RagLevel =
    ragInput === 'red' || ragInput === 'amber' || ragInput === 'green'
      ? ragInput
      : 'green';

  const out: ClientStatus = { rag };

  if (typeof raw.rag_reason === 'string' && raw.rag_reason.trim()) {
    out.reason = raw.rag_reason.trim();
  }
  if (typeof raw.rag_set_at === 'string' && raw.rag_set_at.trim()) {
    out.setAt = raw.rag_set_at.trim();
  }
  if (typeof raw.rag_set_by === 'string' && raw.rag_set_by.trim()) {
    out.setBy = raw.rag_set_by.trim();
  }

  return out;
}

function parseEngagementStatus(raw: unknown): EngagementStatus {
  if (raw === 'lead' || raw === 'client' || raw === 'archived') return raw;
  // Default: existing engagements are clients (Roxbury / Newkind / etc).
  return 'client';
}

function parseEngagementPhase(raw: unknown): EngagementPhase | null {
  if (
    raw === 'marketing' ||
    raw === 'mapping' ||
    raw === 'modelling' ||
    raw === 'building' ||
    raw === 'operate' ||
    raw === 'archive'
  ) {
    return raw;
  }
  return null;
}

function parseSchemaVersion(raw: unknown): BlueprintSchemaVersion {
  if (raw === '2.0') return '2.0';
  if (raw === '1.1') return '1.1';
  // Default: legacy. Existing Blueprints have no field; they stay on 1.x.
  return '1.0';
}

function isNotFound(err: unknown): boolean {
  if (err && typeof err === 'object' && 'status' in err) {
    return (err as { status: number }).status === 404;
  }
  const msg = err instanceof Error ? err.message : String(err);
  return /Not Found|404/i.test(msg);
}

/**
 * Load one engagement card. Returns null when the repo has no
 * `.polynize/client-config.yaml` (it is not an engagement — e.g. an
 * unrelated repo the App can see), so it is excluded from the dashboard.
 * A config that reads but is malformed yields an error card (genuine
 * engagement with a broken config), not exclusion.
 */
async function loadOneClient(slug: string): Promise<ClientCardData | null> {
  let yamlText: string;
  try {
    yamlText = await readClientFile(slug, '.polynize/client-config.yaml');
  } catch (err) {
    if (isNotFound(err)) return null; // not an engagement repo
    return errorCard(slug, err);
  }

  try {
    const lastUpdated = await readClientFileLastCommit(
      slug,
      'modelling/blueprint.md'
    );

    const parsed = (YAML.parse(yamlText) ?? {}) as ParsedConfig;

    const engagementStatus = parseEngagementStatus(parsed.engagement_status);
    const engagementPhase = parseEngagementPhase(parsed.engagement_phase);
    const blueprintSchemaVersion = parseSchemaVersion(
      parsed.blueprint_schema_version
    );

    const prospect =
      parsed.prospect_blueprint_id ||
      parsed.prospect_email ||
      parsed.prospect_first_name
        ? {
            blueprintId: parsed.prospect_blueprint_id ?? undefined,
            email: parsed.prospect_email ?? undefined,
            firstName: parsed.prospect_first_name ?? undefined,
          }
        : null;

    // Readiness from the shared calc (same source as the Blueprint page).
    // Best-effort: degrades to a coarse floor / null, never throws.
    const readiness = await loadEngagementReadiness(slug, {
      phase: engagementPhase,
      workPlanRegistry: parsed.work_plan_registry ?? [],
    });

    return {
      slug,
      name: parsed.client?.name ?? slug,
      leadHuman: parsed.client?.lead_human ?? '',
      leadEmail: parsed.client?.lead_email ?? '',
      phase: parsed.engagement?.phase ?? 'unknown',
      subPhase: parsed.engagement?.sub_phase ?? '',
      gateNext: parsed.engagement?.gate_next ?? '',
      lastUpdated,
      status: parseStatus(parsed.status),
      engagementStatus,
      engagementPhase,
      blueprintSchemaVersion,
      workPlanRegistry: parsed.work_plan_registry ?? [],
      lock: parsed.lock ?? null,
      readiness,
      prospect,
    };
  } catch (err) {
    return errorCard(slug, err);
  }
}

function errorCard(slug: string, err: unknown): ClientCardData {
  return {
    slug,
    name: slug,
    leadHuman: '',
    leadEmail: '',
    phase: '',
    subPhase: '',
    gateNext: '',
    lastUpdated: null,
    status: DEFAULT_STATUS,
    engagementStatus: 'client',
    engagementPhase: null,
    blueprintSchemaVersion: '1.0',
    workPlanRegistry: [],
    lock: null,
    readiness: null,
    prospect: null,
    error: err instanceof Error ? err.message : String(err),
  };
}

/**
 * Load every engagement's card. Engagements are discovered dynamically from
 * the repos the GitHub App installation can access (any repo carrying a
 * `.polynize/client-config.yaml`), so a freshly-seeded Lead appears with no
 * code change.
 *
 * Resilience: if dynamic discovery fails (GitHub outage / auth blip), fall
 * back to the known CONSOLE_CLIENTS list so the dashboard is never blank.
 *
 * [PERF] This reads client-config.yaml for each accessible repo (one call
 * per repo, run in parallel). For the current handful of repos that is fine.
 * If the installation grows to many unrelated repos, cache the discovery
 * result or back it with a seed-maintained registry. Flagged, not yet
 * optimised.
 */
export async function loadClientCardData(): Promise<ClientCardData[]> {
  let slugs: string[];
  try {
    const discovered = await listAccessibleRepoSlugs();
    // Fall back if discovery returns nothing unexpectedly (e.g. scope blip).
    slugs = discovered.length > 0 ? discovered : [...CONSOLE_CLIENTS];
  } catch {
    slugs = [...CONSOLE_CLIENTS];
  }

  const cards = await Promise.all(slugs.map(loadOneClient));
  return cards.filter((c): c is ClientCardData => c !== null);
}
