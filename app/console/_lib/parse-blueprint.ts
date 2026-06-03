export type BlueprintSection = {
  id: string;
  title: string;
  content: string;
};

export type ParsedBlueprint = {
  preamble: {
    title: string;
    intro: string;
  };
  sections: BlueprintSection[];
};

const SECTION_MARKER = /<!-- section:([a-z0-9-]+) -->/;

function extractPreamble(text: string): { title: string; intro: string } {
  const lines = text.split('\n');
  let title = '';
  let titleLineIndex = -1;
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^# (.+)$/);
    if (m) {
      title = m[1].trim();
      titleLineIndex = i;
      break;
    }
  }

  if (titleLineIndex === -1) {
    return { title: '', intro: text.trim() };
  }

  const before = lines.slice(0, titleLineIndex);
  const after = lines.slice(titleLineIndex + 1);
  return { title, intro: [...before, ...after].join('\n').trim() };
}

function extractSection(id: string, body: string): BlueprintSection {
  const lines = body.split('\n');
  let title = id;
  let titleLineIndex = -1;
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^## (.+)$/);
    if (m) {
      title = m[1].trim();
      titleLineIndex = i;
      break;
    }
  }

  const content =
    titleLineIndex === -1
      ? body.trim()
      : lines.slice(titleLineIndex + 1).join('\n').trim();

  return { id, title, content };
}

export function parseBlueprint(markdown: string): ParsedBlueprint {
  // String.split with a capture group returns [preamble, id1, body1, id2, body2, ...]
  const parts = markdown.split(SECTION_MARKER);

  const preamble = extractPreamble(parts[0] ?? '');

  const sections: BlueprintSection[] = [];
  for (let i = 1; i < parts.length; i += 2) {
    const id = parts[i];
    const body = parts[i + 1] ?? '';
    sections.push(extractSection(id, body));
  }

  return { preamble, sections };
}

// ============================================================
// Section-specific parsers — return null if structure doesn't match
// ============================================================

export type CapabilityRow = {
  id: string;
  capability: string;
  human: boolean;
  hybrid: boolean;
  agent: boolean;
  owner: string;
};

export type CapabilityGroup = {
  title: string;
  rows: CapabilityRow[];
};

export type CapabilityMapUnit = {
  groups: CapabilityGroup[];
};

export type AgentCapabilityCard = {
  name: string;
  roleParts: string[];
  description: string;
  capabilities: string[];
  isHuman: boolean;
};

export type GapRegisterRow = {
  id: string;
  question: string;
  owner: string;
  blocks: string;
  /**
   * Whether this gap gates Modelling sign-off. The source of truth is the
   * per-row "Blocking" column when present; legacy tables without that
   * column read every row as non-blocking (false).
   */
  blocking: boolean;
  status: string;
  notes?: string;
};

export type GapRegisterParsed = {
  rows: GapRegisterRow[];
  openCount: number;
  blockingCount: number;
  /** Critical blockers (blocking: true) that are resolved (answered/closed). */
  blockingResolved: number;
  /**
   * True when the table carries an explicit "Blocking" column. Drives the
   * two-group split rendering; legacy tables (no column) render flat.
   */
  hasBlockingColumn: boolean;
};

export type AgentDescription = {
  name: string;
  role: string;
  description: string;
};

export type TeamOrgParsed = {
  agents: AgentDescription[];
  asciiChart: string | null;
};

export function parseRow(line: string): string[] {
  return line
    .trim()
    .replace(/^\||\|\s*$/g, '')
    .split('|')
    .map((c) => c.trim());
}

export function isSeparator(line: string): boolean {
  return /^\|[\s\-:|]+\|?\s*$/.test(line.trim());
}

export type ParsedTable = { headers: string[]; rows: string[][] };

export function parseMarkdownTable(text: string): ParsedTable | null {
  const lines = text
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.startsWith('|'));
  if (lines.length < 2 || !isSeparator(lines[1])) return null;
  return {
    headers: parseRow(lines[0]),
    rows: lines.slice(2).map(parseRow),
  };
}

export function parseCapabilityMapUnit(content: string): CapabilityMapUnit | null {
  const chunks = content.split(/\n(?=### )/);
  const groups: CapabilityGroup[] = [];

  for (const chunk of chunks) {
    if (!chunk.trim().startsWith('### ')) continue;
    const lines = chunk.split('\n');
    const title = lines[0].replace(/^### /, '').trim();
    const tableText = lines.slice(1).join('\n');
    const table = parseMarkdownTable(tableText);
    if (!table || table.rows.length === 0) continue;

    const rows: CapabilityRow[] = table.rows.map((cells) => ({
      id: cells[0] ?? '',
      capability: cells[1] ?? '',
      human: (cells[2] ?? '').includes('●'),
      hybrid: (cells[3] ?? '').includes('●'),
      agent: (cells[4] ?? '').includes('●'),
      owner: cells[5] ?? '',
    }));

    groups.push({ title, rows });
  }

  if (groups.length === 0) return null;
  return { groups };
}

export function parseCapabilityMapAgent(content: string): AgentCapabilityCard[] | null {
  const chunks = content.split(/\n(?=### )/);
  const cards: AgentCapabilityCard[] = [];

  for (const chunk of chunks) {
    if (!chunk.trim().startsWith('### ')) continue;
    const lines = chunk.split('\n');
    const headerText = lines[0].replace(/^### /, '').trim();
    const parts = headerText.split(/\s*·\s*/);
    const name = parts[0] ?? '';
    const roleParts = parts.slice(1);
    const isHuman = roleParts.some((p) => /human/i.test(p));

    const descriptionLines: string[] = [];
    const capLines: string[] = [];
    let sawList = false;

    for (const raw of lines.slice(1)) {
      const trimmed = raw.trim();
      if (!trimmed) continue;
      if (trimmed.startsWith('- ')) {
        sawList = true;
        capLines.push(trimmed.slice(2).trim());
      } else if (!sawList) {
        descriptionLines.push(trimmed);
      }
    }

    if (!name) continue;

    cards.push({
      name,
      roleParts,
      description: descriptionLines.join(' '),
      capabilities: capLines,
      isHuman,
    });
  }

  if (cards.length === 0) return null;
  return cards;
}

/** Find a column index by header substring (case-insensitive). -1 if absent. */
function findCol(headers: string[], ...needles: string[]): number {
  for (let i = 0; i < headers.length; i++) {
    const h = headers[i].toLowerCase();
    if (needles.some((n) => h.includes(n))) return i;
  }
  return -1;
}

const RESOLVED_STATUSES = new Set(['answered', 'closed', 'resolved', 'done']);
const BLOCKING_TRUE = /^\s*(y|yes|true|✓|✔|blocking|critical)/i;

/**
 * Parse the gap register markdown table. Column mapping is HEADER-AWARE (by
 * name, not fixed position) so adding a "Blocking" column does not shift the
 * others; it falls back to the legacy fixed positions when a header is not
 * recognised, so older tables still parse identically.
 *
 * The per-row `blocking` flag comes from the "Blocking" column when present.
 * `blockingCount` is the per-row count when that column exists, else the
 * footer's "N blocking" number (preserving legacy readiness behaviour, which
 * reads the footer count via computeReadiness).
 */
export function parseGapRegister(content: string): GapRegisterParsed | null {
  const table = parseMarkdownTable(content);
  if (!table || table.rows.length === 0) return null;

  const H = table.headers;
  const idIdx = findCol(H, '#', 'id');
  const qIdx = findCol(H, 'question', 'outstanding');
  const ownerIdx = findCol(H, 'owner');
  const blocksIdx = findCol(H, 'blocks');
  const blockingIdx = findCol(H, 'blocking');
  const statusIdx = findCol(H, 'status');
  const notesIdx = findCol(H, 'note');
  const hasBlockingColumn = blockingIdx >= 0;

  // Read a cell by resolved header index, falling back to a legacy position.
  const at = (cells: string[], idx: number, fallback: number): string =>
    (idx >= 0 ? cells[idx] : cells[fallback]) ?? '';

  const rows: GapRegisterRow[] = table.rows.map((cells) => ({
    id: at(cells, idIdx, 0),
    question: at(cells, qIdx, 1),
    owner: at(cells, ownerIdx, 2),
    blocks: at(cells, blocksIdx, 3),
    blocking: blockingIdx >= 0 ? BLOCKING_TRUE.test(cells[blockingIdx] ?? '') : false,
    status: at(cells, statusIdx, 4).toLowerCase(),
    notes: at(cells, notesIdx, 5),
  }));

  // Footer line: "**Status:** 11 gaps open · 5 blocking sign-off."
  const footerMatch = content.match(
    /\*\*Status:\*\*\s*(\d+)\s+gaps?\s+open\s*[·•]\s*(\d+)\s+blocking/i
  );
  const openCount = footerMatch
    ? Number(footerMatch[1])
    : rows.filter((r) => r.status === 'open').length;
  // Per-row count is authoritative once the Blocking column exists; the footer
  // is the legacy fallback for older tables (keeps computeReadiness stable).
  const blockingCount = hasBlockingColumn
    ? rows.filter((r) => r.blocking).length
    : footerMatch
      ? Number(footerMatch[2])
      : 0;
  const blockingResolved = rows.filter(
    (r) => r.blocking && RESOLVED_STATUSES.has(r.status)
  ).length;

  return { rows, openCount, blockingCount, blockingResolved, hasBlockingColumn };
}

// ============================================================
// Infrastructure section — split into Polynize / Client subsections
// (Step 7A.2). Looks for `### Polynize Infrastructure` and
// `### Client Infrastructure` H3 headings inside the section.
// Tolerant of casing and extra whitespace. If neither heading is
// present, returns the whole content under `legacy` so old-format
// Blueprints still render via the markdown fallback.
// ============================================================

export type InfrastructureSubsection = {
  description?: string;
  content: string;
};

export type InfrastructureParsed = {
  polynize?: InfrastructureSubsection;
  client?: InfrastructureSubsection;
  legacy?: string;
};

const POLYNIZE_H3 = /^###\s+polynize\s+infrastructure\s*$/i;
const CLIENT_H3 = /^###\s+client\s+infrastructure\s*$/i;
const ANY_H3 = /^###\s+/;
const ITALIC_LINE = /^\*([^*]+)\*\s*$/;

/**
 * Pull the first italic line (treated as the descriptive paragraph) off
 * the front of a subsection's body, returning { description, rest }.
 * Skips blank lines between the H3 and the first non-blank line.
 */
function splitDescription(body: string): {
  description?: string;
  content: string;
} {
  const lines = body.split('\n');
  let i = 0;
  // skip blank lines after the H3
  while (i < lines.length && lines[i].trim() === '') i++;
  if (i < lines.length) {
    const m = lines[i].match(ITALIC_LINE);
    if (m) {
      const description = m[1].trim();
      const rest = lines
        .slice(i + 1)
        .join('\n')
        .replace(/^\n+/, '');
      return { description, content: rest.trim() };
    }
  }
  return { content: body.trim() };
}

export function parseInfrastructure(
  content: string
): InfrastructureParsed | null {
  if (!content.trim()) return null;
  const lines = content.split('\n');

  let polynizeStart = -1;
  let clientStart = -1;
  for (let i = 0; i < lines.length; i++) {
    if (polynizeStart < 0 && POLYNIZE_H3.test(lines[i])) {
      polynizeStart = i;
      continue;
    }
    if (clientStart < 0 && CLIENT_H3.test(lines[i])) {
      clientStart = i;
    }
  }

  // No subheadings found → legacy format. Pass through unchanged so the
  // markdown fallback renders it as-is.
  if (polynizeStart < 0 && clientStart < 0) {
    return { legacy: content.trim() };
  }

  /**
   * Find the line index that ends the subsection starting at `headingIdx`.
   * Stops at: the other named H3 if it comes after this one, OR the next
   * H3 of any kind (defensive — guards against future subheadings being
   * added), OR EOF.
   */
  const endOfSubsection = (headingIdx: number, otherIdx: number): number => {
    const stops: number[] = [];
    if (otherIdx > headingIdx) stops.push(otherIdx);
    for (let i = headingIdx + 1; i < lines.length; i++) {
      if (ANY_H3.test(lines[i])) {
        stops.push(i);
        break;
      }
    }
    return stops.length > 0 ? Math.min(...stops) : lines.length;
  };

  const out: InfrastructureParsed = {};

  if (polynizeStart >= 0) {
    const end = endOfSubsection(polynizeStart, clientStart);
    const body = lines.slice(polynizeStart + 1, end).join('\n');
    out.polynize = splitDescription(body);
  }
  if (clientStart >= 0) {
    const end = endOfSubsection(clientStart, polynizeStart);
    const body = lines.slice(clientStart + 1, end).join('\n');
    out.client = splitDescription(body);
  }

  return out;
}

export function parseTeamOrg(content: string): TeamOrgParsed | null {
  // Extract first triple-backtick code block as the ASCII chart, if any.
  const codeFenceMatch = content.match(/```(?:\w*)?\n([\s\S]*?)```/);
  const asciiChart = codeFenceMatch ? codeFenceMatch[1].replace(/\n+$/, '') : null;

  // Match paragraphs starting with **Name** — Role. Description...
  // Em-dash, en-dash, or hyphen surrounded by spaces.
  const pattern = /^\*\*([^*]+)\*\*\s+[—–-]\s+([^.]+?)\.\s*(.+)$/gm;
  const agents: AgentDescription[] = [];
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(content)) !== null) {
    agents.push({
      name: match[1].trim(),
      role: match[2].trim(),
      description: match[3].trim(),
    });
  }

  if (agents.length === 0) return null;
  return { agents, asciiChart };
}

export function extractBlueprintVersion(introMarkdown: string): string | null {
  const m = introMarkdown.match(/Auto-generated\s+(v\d+(?:\.\d+)?)/i);
  return m ? m[1] : null;
}

// ============================================================
// Team role identification
// ============================================================

const HUMAN_ROLE_PATTERN =
  /\(?\bhuman\b\)?|\bco-?founder\b|\bfounder\b|\bceo\b|\bdirector\b|\bowner\b/i;

const SPOC_ROLE_PATTERN =
  /\bteam\s+(lead|manager)\b|\bSPOC\b|\bsingle\s+point\s+of\s+contact\b/i;

export function isHumanRole(role: string): boolean {
  return HUMAN_ROLE_PATTERN.test(role);
}

export type TeamRoles = {
  accountableLead: AgentDescription | null;
  spoc: AgentDescription | null;
  children: AgentDescription[];
};

export function identifyTeamRoles(parsed: TeamOrgParsed): TeamRoles {
  const accountableLead =
    parsed.agents.find((a) => isHumanRole(a.role)) ?? null;
  const nonHumans = parsed.agents.filter((a) => !isHumanRole(a.role));
  if (nonHumans.length === 0) {
    return { accountableLead, spoc: null, children: [] };
  }
  const spoc =
    nonHumans.find((a) => SPOC_ROLE_PATTERN.test(a.role)) ?? nonHumans[0];
  const children = nonHumans.filter((a) => a !== spoc);
  return { accountableLead, spoc, children };
}

// ============================================================
// Phase-aware readiness math
// ============================================================

const DECISION_SECTIONS = [
  'capability-map-unit',
  'capability-map-agent',
  'team',
];
const MIN_POPULATED_CHARS = 100;

function isSectionPopulated(content: string): boolean {
  const t = content.trim();
  if (t.length <= MIN_POPULATED_CHARS) return false;
  if (t.startsWith('_To be added._')) return false;
  if (t.includes('_To be populated_')) return false;
  return true;
}

export type ReadinessInput = {
  blueprint: ParsedBlueprint;
  phase: string;
  subPhase: string;
  blockingGapsCount: number;
};

export function computeReadiness(input: ReadinessInput): number {
  const { blueprint, phase, subPhase, blockingGapsCount } = input;

  // Base by phase + sub-phase. Represents engagement progress from Gate 01
  // (Discovery) through Gate 03 (Agreement & Build Plan). Post-Gate-03 the
  // Blueprint is locked and readiness is 100% (Build/Operate phases).
  const baseForPhase = (): number => {
    const p = phase.toLowerCase();
    const sp = subPhase.toUpperCase();
    if (p === 'marketing') return 0;
    if (p === 'mapping') return 30;
    if (p === 'modelling') {
      if (sp === 'M1') return 55;
      if (sp === 'M2') return 65;
      if (sp === 'M3') return 85;
      return 65;
    }
    if (p === 'build' || p === 'operate') return 100;
    return 0;
  };

  // Substance bonus: +5 per populated decision section, up to +15.
  let substanceBonus = 0;
  for (const id of DECISION_SECTIONS) {
    const section = blueprint.sections.find((s) => s.id === id);
    if (section && isSectionPopulated(section.content)) substanceBonus += 5;
  }

  // Override: zero populated decision sections → 0%, even if phase says
  // otherwise. Catches placeholder Blueprints where the config has been
  // filled in but no Modelling content has landed.
  if (substanceBonus === 0) return 0;

  // Gap penalty: −2 per blocking gap, capped at −15.
  const gapPenalty = Math.min(blockingGapsCount * 2, 15);

  const score = baseForPhase() + substanceBonus - gapPenalty;
  return Math.max(0, Math.min(100, Math.round(score)));
}
