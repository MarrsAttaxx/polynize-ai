import {
  parseBlueprint,
  parseMarkdownTable,
  type GapRegisterRow,
} from './parse-blueprint';

// ============================================================
// Section splicing (pure markdown manipulation)
// ============================================================

const SECTION_MARKER_RE = /(<!-- section:[a-z0-9-]+ -->)/;

/**
 * Splice the body of a single section in the markdown by a transform.
 * Markers stay intact; only the body text between them is replaced.
 */
function spliceSection(
  markdown: string,
  sectionId: string,
  transform: (currentBody: string) => string
): string {
  const parts = markdown.split(SECTION_MARKER_RE);
  // parts: [preamble, marker1, body1, marker2, body2, ...]
  const target = `<!-- section:${sectionId} -->`;
  let found = false;
  for (let i = 1; i < parts.length; i += 2) {
    if (parts[i] === target && i + 1 < parts.length) {
      parts[i + 1] = transform(parts[i + 1]);
      found = true;
      break;
    }
  }
  if (!found) throw new Error(`Section "${sectionId}" not found`);
  return parts.join('');
}

// ============================================================
// Gap-register table emission + split helpers
// ============================================================

function escapeCell(s: string): string {
  return (s ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ');
}

function capitalize(s: string): string {
  if (!s) return '';
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Re-emit the gap table. Preserves the "Blocking" column only when the source
 * table had one (hasBlockingColumn) so editing a gap in a split table keeps
 * the classification, and editing a legacy table does not grow a new column.
 */
function emitGapTable(rows: GapRegisterRow[], hasBlockingColumn: boolean): string {
  const lines = hasBlockingColumn
    ? [
        '| # | Outstanding question | Owner | Blocks | Blocking | Status | Notes |',
        '|---|---|---|---|---|---|---|',
      ]
    : [
        '| # | Outstanding question | Owner | Blocks | Status | Notes |',
        '|---|---|---|---|---|---|',
      ];
  for (const row of rows) {
    const head = [
      escapeCell(row.id),
      escapeCell(row.question),
      escapeCell(row.owner),
      escapeCell(row.blocks),
    ];
    const tail = [
      escapeCell(capitalize(row.status || 'open')),
      escapeCell(row.notes ?? ''),
    ];
    const cells = hasBlockingColumn
      ? [...head, row.blocking ? 'Yes' : 'No', ...tail]
      : [...head, ...tail];
    lines.push(`| ${cells.join(' | ')} |`);
  }
  return lines.join('\n');
}

type SplitGapSection = {
  lede: string;
  rows: GapRegisterRow[];
  blockingCount: number;
  trailing: string;
  hasBlockingColumn: boolean;
};

function splitGapSection(content: string): SplitGapSection {
  const lines = content.split('\n');

  let tableStart = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim().startsWith('|')) {
      tableStart = i;
      break;
    }
  }
  if (tableStart === -1) {
    throw new Error('No gap-register table found in section content');
  }

  let tableEnd = tableStart;
  while (
    tableEnd + 1 < lines.length &&
    lines[tableEnd + 1].trim().startsWith('|')
  ) {
    tableEnd++;
  }

  let footerLineIdx = -1;
  for (let i = tableEnd + 1; i < lines.length; i++) {
    if (/^\*\*Status:\*\*/.test(lines[i].trim())) {
      footerLineIdx = i;
      break;
    }
  }

  const tableText = lines.slice(tableStart, tableEnd + 1).join('\n');
  const table = parseMarkdownTable(tableText);
  // Header-aware column mapping (mirrors parseGapRegister) so adding a
  // "Blocking" column does not shift the others; falls back to legacy
  // positions when a header is not recognised.
  const H = table?.headers ?? [];
  const find = (...needles: string[]): number => {
    for (let i = 0; i < H.length; i++) {
      const h = H[i].toLowerCase();
      if (needles.some((n) => h.includes(n))) return i;
    }
    return -1;
  };
  const idIdx = find('#', 'id');
  const qIdx = find('question', 'outstanding');
  const ownerIdx = find('owner');
  const blocksIdx = find('blocks');
  const blockingIdx = find('blocking');
  const statusIdx = find('status');
  const notesIdx = find('note');
  const hasBlockingColumn = blockingIdx >= 0;
  const at = (cells: string[], idx: number, fb: number): string =>
    (idx >= 0 ? cells[idx] : cells[fb]) ?? '';
  const rows: GapRegisterRow[] = (table?.rows ?? []).map((cells) => ({
    id: at(cells, idIdx, 0),
    question: at(cells, qIdx, 1),
    owner: at(cells, ownerIdx, 2),
    blocks: at(cells, blocksIdx, 3),
    blocking:
      blockingIdx >= 0
        ? /^\s*(y|yes|true|✓|✔|blocking|critical)/i.test(cells[blockingIdx] ?? '')
        : false,
    status: at(cells, statusIdx, 4).toLowerCase(),
    notes: at(cells, notesIdx, 5),
  }));

  let blockingCount = 0;
  if (footerLineIdx !== -1) {
    const m = lines[footerLineIdx].match(
      /\*\*Status:\*\*\s*\d+\s+gaps?\s+open\s*[·•]\s*(\d+)\s+blocking/i
    );
    if (m) blockingCount = Number(m[1]);
  }

  const lede = lines.slice(0, tableStart).join('\n').trimEnd();
  const trailingStart =
    footerLineIdx !== -1 ? footerLineIdx + 1 : tableEnd + 1;
  const trailing = lines.slice(trailingStart).join('\n').trim();

  return { lede, rows, blockingCount, trailing, hasBlockingColumn };
}

function rebuildGapSectionBody(
  split: SplitGapSection,
  newRows: GapRegisterRow[],
  blockingCountOverride?: number
): string {
  const openCount = newRows.filter(
    (r) => r.status.toLowerCase() === 'open'
  ).length;
  const blockingCount =
    blockingCountOverride ??
    (split.hasBlockingColumn
      ? newRows.filter((r) => r.blocking).length
      : split.blockingCount);
  const newFooter = `**Status:** ${openCount} gap${
    openCount === 1 ? '' : 's'
  } open · ${blockingCount} blocking sign-off.`;

  const table = emitGapTable(newRows, split.hasBlockingColumn);

  const parts: string[] = [];
  if (split.lede) parts.push(split.lede, '');
  parts.push(table, '', newFooter);
  if (split.trailing) parts.push('', split.trailing);
  return parts.join('\n');
}

function replaceGapSectionContent(
  body: string,
  newRows: GapRegisterRow[],
  blockingCountOverride?: number
): string {
  // body looks like "\n## NN · Gap register\n\n...content...\n\n"
  const bodyLines = body.split('\n');
  const h2Idx = bodyLines.findIndex((l) => l.startsWith('## '));
  if (h2Idx === -1) {
    throw new Error('H2 heading not found in gap-register section body');
  }
  const h2Line = bodyLines[h2Idx];
  const contentText = bodyLines
    .slice(h2Idx + 1)
    .join('\n')
    .trim();

  const split = splitGapSection(contentText);
  const newContent = rebuildGapSectionBody(split, newRows, blockingCountOverride);

  return `\n${h2Line}\n\n${newContent}\n\n`;
}

// ============================================================
// Public mutation API
// ============================================================

export function updateGapInBlueprint(
  markdown: string,
  gapId: string,
  partial: Partial<GapRegisterRow>
): { newMarkdown: string; newGapState: GapRegisterRow } {
  const blueprint = parseBlueprint(markdown);
  const section = blueprint.sections.find((s) => s.id === 'gap-register');
  if (!section) throw new Error('gap-register section not found');

  const split = splitGapSection(section.content);
  const targetIdx = split.rows.findIndex((r) => r.id === gapId);
  if (targetIdx === -1) throw new Error(`Gap ${gapId} not found`);

  const updated: GapRegisterRow = {
    ...split.rows[targetIdx],
    ...partial,
    status: (partial.status ?? split.rows[targetIdx].status).toLowerCase(),
    notes: partial.notes === null ? '' : (partial.notes ?? split.rows[targetIdx].notes ?? ''),
  };
  const newRows = [...split.rows];
  newRows[targetIdx] = updated;

  const newMarkdown = spliceSection(markdown, 'gap-register', (body) =>
    replaceGapSectionContent(body, newRows)
  );

  return { newMarkdown, newGapState: updated };
}

export function createGapInBlueprint(
  markdown: string,
  newGap: Omit<GapRegisterRow, 'id'>
): { newMarkdown: string; gapId: string; newGapState: GapRegisterRow } {
  const blueprint = parseBlueprint(markdown);
  const section = blueprint.sections.find((s) => s.id === 'gap-register');
  if (!section) throw new Error('gap-register section not found');

  const split = splitGapSection(section.content);
  const maxId = split.rows.reduce(
    (max, r) => Math.max(max, Number(r.id) || 0),
    0
  );
  const newId = String(maxId + 1).padStart(2, '0');

  const newRow: GapRegisterRow = {
    id: newId,
    question: newGap.question ?? '',
    owner: newGap.owner ?? '',
    blocks: newGap.blocks ?? '',
    blocking: newGap.blocking ?? false,
    status: (newGap.status ?? 'open').toLowerCase(),
    notes: newGap.notes ?? '',
  };
  const newRows = [...split.rows, newRow];

  const newMarkdown = spliceSection(markdown, 'gap-register', (body) =>
    replaceGapSectionContent(body, newRows)
  );

  return { newMarkdown, gapId: newId, newGapState: newRow };
}

export function deleteGapInBlueprint(
  markdown: string,
  gapId: string
): { newMarkdown: string } {
  const blueprint = parseBlueprint(markdown);
  const section = blueprint.sections.find((s) => s.id === 'gap-register');
  if (!section) throw new Error('gap-register section not found');

  const split = splitGapSection(section.content);
  const targetIdx = split.rows.findIndex((r) => r.id === gapId);
  if (targetIdx === -1) throw new Error(`Gap ${gapId} not found`);

  const remaining = [
    ...split.rows.slice(0, targetIdx),
    ...split.rows.slice(targetIdx + 1),
  ];
  const renumbered = remaining.map((r, i) => ({
    ...r,
    id: String(i + 1).padStart(2, '0'),
  }));

  const newMarkdown = spliceSection(markdown, 'gap-register', (body) =>
    replaceGapSectionContent(body, renumbered)
  );

  return { newMarkdown };
}

export function replaceSectionInBlueprint(
  markdown: string,
  sectionId: string,
  newContent: string
): { newMarkdown: string } {
  const newMarkdown = spliceSection(
    markdown,
    sectionId,
    () => `\n${newContent.trim()}\n\n`
  );
  return { newMarkdown };
}

export function recomputeGapStatusFooter(content: string): {
  newContent: string;
  openCount: number;
  blockingCount: number;
} {
  const split = splitGapSection(content);
  const openCount = split.rows.filter(
    (r) => r.status.toLowerCase() === 'open'
  ).length;
  const newContent = rebuildGapSectionBody(split, split.rows);
  return { newContent, openCount, blockingCount: split.blockingCount };
}
