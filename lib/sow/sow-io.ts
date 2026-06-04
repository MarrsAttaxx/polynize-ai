/**
 * Server-side read / write / edit helpers for sow/sow.json.
 *
 * Read is lenient and normalised (older or partial files still load, missing
 * HUMAN keys are seeded from the template defaults). Write serialises the
 * strict shape. applySowFieldEdit is the allowlisted setter the field-edit API
 * uses: it only ever writes a single string into a known location, so a stray
 * path cannot mutate arbitrary structure.
 */

import { readClientFile, writeClientFile } from '@/lib/github-client';
import type { CommitResult } from '@/lib/github-client';
import {
  LenientSowDocSchema,
  SOW_SCHEMA_VERSION,
  type SowDoc,
} from './schema';
import { HUMAN_FIELDS } from './template';

export const SOW_PATH = 'sow/sow.json';

function seedHuman(
  raw: Record<string, string | null | undefined> | undefined
): Record<string, string | null> {
  const human: Record<string, string | null> = {};
  for (const f of HUMAN_FIELDS) {
    const v = raw?.[f.key];
    human[f.key] = v === undefined ? f.default : v;
  }
  // Preserve any extra keys present in the file but not in the registry.
  if (raw) {
    for (const [k, v] of Object.entries(raw)) {
      if (!(k in human)) human[k] = v ?? null;
    }
  }
  return human;
}

function normalize(raw: unknown): SowDoc | null {
  const parsed = LenientSowDocSchema.safeParse(raw);
  if (!parsed.success) {
    // eslint-disable-next-line no-console
    console.error('[sow-io] sow.json schema mismatch', parsed.error.issues.slice(0, 3));
    return null;
  }
  const d = parsed.data;
  const a = d.auto ?? {};
  return {
    schema_version: SOW_SCHEMA_VERSION,
    generated_at: d.generated_at ?? '',
    generated_from: d.generated_from ?? '',
    sow_reference: d.sow_reference ?? '',
    auto: {
      engagement_name: a.engagement_name ?? '',
      background: a.background ?? '',
      agent_team: a.agent_team ?? [],
      in_scope: a.in_scope ?? [],
      out_of_scope: a.out_of_scope ?? [],
      capability_schedule: a.capability_schedule ?? [],
      targets: a.targets ?? [],
      motions: a.motions ?? [],
      build_sequence: a.build_sequence ?? [],
      human_held: a.human_held ?? [],
      integrations: a.integrations ?? [],
    },
    human: seedHuman(d.human as Record<string, string | null | undefined>),
  };
}

/** Read + normalise sow/sow.json. null when absent or unparseable. */
export async function readSowDoc(slug: string): Promise<SowDoc | null> {
  let raw: string;
  try {
    raw = await readClientFile(slug, SOW_PATH);
  } catch {
    return null; // not generated yet
  }
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(`[sow-io] sow.json JSON.parse failed for ${slug}`, err);
    return null;
  }
  return normalize(json);
}

/** Serialise + write sow/sow.json. */
export async function writeSowDoc(
  slug: string,
  doc: SowDoc,
  commitMessage: string,
  author?: { name: string; email: string }
): Promise<CommitResult> {
  const content = `${JSON.stringify(doc, null, 2)}\n`;
  return writeClientFile(slug, SOW_PATH, content, commitMessage, author);
}

export type FieldEditResult =
  | { ok: true; doc: SowDoc }
  | { ok: false; error: string };

const ARRAY_FIELDS = new Set([
  'in_scope',
  'out_of_scope',
  'human_held',
  'integrations',
  'build_sequence',
]);
const OBJECT_ARRAY_PROPS: Record<string, Set<string>> = {
  agent_team: new Set(['name', 'role']),
  capability_schedule: new Set(['name', 'how', 'human_check']),
  targets: new Set(['capability', 'target']),
  motions: new Set(['label', 'description']),
};
const SCALAR_AUTO = new Set(['engagement_name', 'background']);

/**
 * Set a single string value at an allowlisted path into a SowDoc, returning a
 * new doc. Supported paths:
 *   human.<key>
 *   auto.engagement_name | auto.background
 *   auto.<arrayField>.<i>                    (string arrays)
 *   auto.<objectArray>.<i>.<prop>            (agent_team/capability_schedule/targets/motions)
 * Anything else is rejected. Never mutates structure beyond the addressed leaf.
 */
export function applySowFieldEdit(
  doc: SowDoc,
  path: string,
  value: string
): FieldEditResult {
  if (typeof path !== 'string' || typeof value !== 'string') {
    return { ok: false, error: 'path and value must be strings' };
  }
  if (value.length > 8000) {
    return { ok: false, error: 'value too long' };
  }
  const next: SowDoc = JSON.parse(JSON.stringify(doc));
  const segs = path.split('.');

  // human.<key>
  if (segs.length === 2 && segs[0] === 'human') {
    next.human[segs[1]] = value;
    return { ok: true, doc: next };
  }

  if (segs[0] !== 'auto') {
    return { ok: false, error: `unsupported path: ${path}` };
  }

  // auto.<scalar>
  if (segs.length === 2 && SCALAR_AUTO.has(segs[1])) {
    (next.auto as unknown as Record<string, string>)[segs[1]] = value;
    return { ok: true, doc: next };
  }

  // auto.<stringArray>.<i>
  if (segs.length === 3 && ARRAY_FIELDS.has(segs[1])) {
    const i = Number(segs[2]);
    const arr = (next.auto as unknown as Record<string, string[]>)[segs[1]];
    if (!Number.isInteger(i) || i < 0 || i >= arr.length) {
      return { ok: false, error: 'index out of range' };
    }
    arr[i] = value;
    return { ok: true, doc: next };
  }

  // auto.<objectArray>.<i>.<prop>
  if (segs.length === 4 && OBJECT_ARRAY_PROPS[segs[1]]) {
    const props = OBJECT_ARRAY_PROPS[segs[1]];
    if (!props.has(segs[3])) {
      return { ok: false, error: `unsupported field: ${segs[3]}` };
    }
    const i = Number(segs[2]);
    const arr = (next.auto as unknown as Record<string, Record<string, string>[]>)[
      segs[1]
    ];
    if (!Number.isInteger(i) || i < 0 || i >= arr.length) {
      return { ok: false, error: 'index out of range' };
    }
    arr[i][segs[3]] = value;
    return { ok: true, doc: next };
  }

  return { ok: false, error: `unsupported path: ${path}` };
}
