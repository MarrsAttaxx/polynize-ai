/**
 * Helpers that let the 2.0 renderer reuse the 1.x markdown-sourced sections
 * (Infrastructure, Integration, Throughput, Gap register, Sign-off) and the
 * 1.x readiness calculation, alongside the 2.0 JSON-sourced sections.
 *
 * The 1.x renderer (LegacyView) reads modelling/blueprint.md and parses it
 * into sections. The 2.0 renderer now reads the SAME file for those
 * narrative sections, while sourcing capability map / benchmarking / uplift
 * / work plans / timeline from the JSON canonical files.
 */

import { readClientFile } from '@/lib/github-client';
import {
  parseBlueprint,
  type ParsedBlueprint,
  type BlueprintSection,
} from '@/app/console/_lib/parse-blueprint';
import type { BlueprintV2 } from '@/lib/blueprint/load-v2';

const BLUEPRINT_MD = 'modelling/blueprint.md';

/** Read + parse modelling/blueprint.md. Returns null if absent. */
export async function loadParsedMarkdown(
  slug: string
): Promise<ParsedBlueprint | null> {
  try {
    const md = await readClientFile(slug, BLUEPRINT_MD);
    return parseBlueprint(md);
  } catch {
    return null;
  }
}

/** Find a section by id. */
export function findSection(
  parsed: ParsedBlueprint | null,
  id: string
): BlueprintSection | null {
  if (!parsed) return null;
  return parsed.sections.find((s) => s.id === id) ?? null;
}

/**
 * Is a markdown section meaningfully populated (not a placeholder)? Mirrors
 * the 1.x `isSectionPopulated` heuristic so restored sections hide cleanly
 * when they only carry "_To be added._".
 */
export function isPopulated(content: string | undefined | null): boolean {
  if (!content) return false;
  const t = content.trim();
  if (t.length === 0) return false;
  if (t.startsWith('_To be added._')) return false;
  if (t.includes('_To be populated_')) return false;
  return true;
}

/**
 * Map the 2.0 engagement_phase vocabulary onto the token the 1.x
 * `computeReadiness` formula understands. The FORMULA is unchanged — this
 * only translates the phase name:
 *   building → build, archive → operate, others pass through.
 */
export function mapPhaseForReadiness(phase: string | null | undefined): string {
  switch (phase) {
    case 'building':
      return 'build';
    case 'archive':
      return 'operate';
    case 'marketing':
    case 'mapping':
    case 'modelling':
    case 'operate':
      return phase;
    default:
      return phase ?? '';
  }
}

/**
 * Build a ParsedBlueprint whose three "decision sections"
 * (capability-map-unit, capability-map-agent, team) carry real content
 * derived from the 2.0 JSON, so the 1.x `computeReadiness` substance bonus
 * reflects reality. In 2.0 this data lives in capability-map.json, not the
 * markdown, so without this the formula's "zero populated sections → 0%"
 * override would wrongly zero a fully-mapped engagement. The formula is
 * untouched; only its inputs are adapted.
 */
export function syntheticReadinessBlueprint(v2: BlueprintV2): ParsedBlueprint {
  const cm = v2.capabilityMap;
  const capText = cm.capabilities
    .map((c) => `${c.id} ${c.name}: ${c.description} [${c.allocation}]`)
    .join('\n');
  const agentText = cm.team.agents
    .map((a) => `${a.name} — ${a.role}: ${a.short_desc}`)
    .join('\n');
  const teamText = `${cm.team.human_owner.name} (${cm.team.human_owner.role})\n${agentText}`;

  return {
    preamble: { title: cm.scope_brief.name, intro: cm.interpretation },
    sections: [
      { id: 'capability-map-unit', title: 'Capability map', content: capText },
      { id: 'capability-map-agent', title: 'Per agent', content: agentText },
      { id: 'team', title: 'Team', content: teamText },
    ],
  };
}
