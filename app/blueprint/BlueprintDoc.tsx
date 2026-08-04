'use client';

import { useEffect, useRef, useState } from 'react';
import type { SalesBlueprint } from '@/lib/agents/sales-blueprint-schema';
import s from './blueprint.module.css';

type TabKey = 'overview' | 'map' | 'benchmarks' | 'transformation' | 'team' | 'build';
const TABS: { key: TabKey; label: string }[] = [
  { key: 'overview', label: 'Overview' },
  { key: 'map', label: 'Capability Map' },
  { key: 'benchmarks', label: 'Benchmarks' },
  { key: 'transformation', label: 'Transformation' },
  { key: 'team', label: 'Agentic Design' },
  { key: 'build', label: 'Build & Outcomes' },
];

function severity(gap: number): 'low' | 'mod' | 'high' | 'maj' {
  if (gap < 15) return 'low';
  if (gap < 30) return 'mod';
  if (gap < 50) return 'high';
  return 'maj';
}
function sevColor(sev: string): string {
  return sev === 'low' ? 'var(--mint)' : sev === 'mod' ? 'var(--amber)' : 'var(--coral)';
}
const ALLOC_CLASS: Record<string, string> = { human: 'alloc-human', hybrid: 'alloc-hybrid', agent: 'alloc-agent' };
/** Dropdown accent classes, keyed by allocation (module-scoped in blueprint.module.css). */
const EXPAND_CLASS: Record<string, string> = { human: 'aHuman', hybrid: 'aHybrid', agent: 'aAgent' };
function isNotEnough(v: string): boolean {
  return v.trim().toLowerCase().startsWith('not enough information');
}

type ChatMsg = { role: 'user' | 'bot' | 'err' | 'working'; text: string };

/* The 8 Cognitive Work Unit shapes (config/cwu-shapes.json). */
const SHAPES: { id: number; label: string; name: string; sig: string }[] = [
  { id: 1, label: 'Decision', name: 'Analysis and Judgment', sig: 'Parallel streams into a synthesis, then a human judgment call.' },
  { id: 2, label: 'Pipeline', name: 'Pipeline and Conversion', sig: 'Sequential stages with the human at the key gates and the close.' },
  { id: 3, label: 'Delivery', name: 'Execution and Delivery', sig: 'Spec, decompose, build, test, iterate. The human is the architect.' },
  { id: 4, label: 'Command', name: 'Executive Leverage', sig: 'Agents expand the reach of one high-value human whose attention is scarce.' },
  { id: 5, label: 'Relationships', name: 'Relationship Continuity', sig: 'Continuous monitoring, with the human at the high-value moments.' },
  { id: 6, label: 'Service', name: 'High-Volume Operations', sig: 'Inverted: agents are primary execution, the human handles exceptions.' },
  { id: 7, label: 'Creative', name: 'Creative Direction', sig: 'Human direction, agent generation, human curation, agent production.' },
  { id: 8, label: 'Training', name: 'Learning and Capability', sig: 'Assessment, gaps, development, and cohort intelligence.' },
];

const MOVE_ORDER: Record<string, number> = { train: 0, deploy: 1, hold: 2 };
const MOVE_CLASS: Record<string, string> = { train: 'moveTrain', deploy: 'moveDeploy', hold: 'moveHold' };
/** Rail node shape follows allocation: human = circle, agent = square, hybrid = diamond. */
const ALLOC_NODE: Record<string, string> = { human: 'nodeHuman', hybrid: 'nodeHybrid', agent: 'nodeAgent' };
function uplift(cap: SalesBlueprint['capabilities'][number]): number {
  return Math.max(0, cap.benchmark_level - cap.current_level);
}

function TabIcon({ k }: { k: TabKey }) {
  const p = { width: 15, height: 15, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true };
  switch (k) {
    case 'overview':
      return (<svg {...p}><rect x="5" y="4" width="14" height="16" rx="2" /><path d="M8.5 9h7M8.5 13h7M8.5 17h4" /></svg>);
    case 'map':
      return (<svg {...p}><rect x="4" y="4" width="7" height="7" rx="1.5" /><rect x="13" y="4" width="7" height="7" rx="1.5" /><rect x="4" y="13" width="7" height="7" rx="1.5" /><rect x="13" y="13" width="7" height="7" rx="1.5" /></svg>);
    case 'benchmarks':
      return (<svg {...p}><path d="M5 20V11M12 20V5M19 20v-6" /></svg>);
    case 'transformation':
      return (<svg {...p}><circle cx="6" cy="6" r="2" /><circle cx="6" cy="18" r="2" /><path d="M6 8v8M10 6h9M10 18h9M10 12h6" /></svg>);
    case 'team':
      return (<svg {...p}><rect x="3.5" y="9.5" width="5" height="5" rx="1" /><circle cx="19" cy="12" r="2.6" /><path d="M8.5 12H16" /></svg>);
    case 'build':
      return (<svg {...p}><path d="M12 3l2 4 4 .6-3 2.9.7 4.3L12 12.9 8.6 14.8l.7-4.3-3-2.9L10 7z" /></svg>);
    default:
      return null;
  }
}

function ShapeIcon({ id, active }: { id: number; active?: boolean }) {
  const c = active ? 'var(--mint)' : 'var(--text-3)';
  const p = { width: 26, height: 22, viewBox: '0 0 40 30', fill: 'none', stroke: c, strokeWidth: 1.6, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true };
  const sq = (x: number, y: number, s = 6) => <rect x={x} y={y} width={s} height={s} rx="1.4" />;
  switch (id) {
    case 1: // Decision: streams -> synthesis -> call
      return (<svg {...p}>{sq(4, 3)}{sq(4, 12)}{sq(4, 21)}<path d="M10 6h7M10 15h7M10 24h7" /><circle cx="24" cy="15" r="4" /><path d="M28 15h7" /></svg>);
    case 2: // Pipeline: boxes in a row -> circle
      return (<svg {...p}>{sq(3, 12)}{sq(13, 12)}{sq(23, 12)}<path d="M9 15h4M19 15h4" /><circle cx="34" cy="15" r="3.4" /><path d="M29 15h1.5" /></svg>);
    case 3: // Delivery: stacked -> out
      return (<svg {...p}>{sq(5, 4)}{sq(5, 13)}{sq(5, 22)}<path d="M11 7l9 8M11 25l9-8" /><circle cx="24" cy="15" r="3.4" /></svg>);
    case 4: // Command: hub and spokes
      return (<svg {...p}><circle cx="20" cy="15" r="3.6" />{sq(4, 3)}{sq(30, 3)}{sq(4, 21)}{sq(30, 21)}<path d="M10 6l7 6M30 6l-7 6M10 24l7-6M30 24l-7-6" /></svg>);
    case 5: // Relationships: diamonds around a node
      return (<svg {...p}><circle cx="20" cy="15" r="3.4" /><path d="M20 4l3 3-3 3-3-3zM20 20l3 3-3 3-3-3zM8 12l3 3-3 3-3-3zM32 12l3 3-3 3-3-3z" /></svg>);
    case 6: // Service: row of boxes into one node (inverted)
      return (<svg {...p}>{sq(4, 4)}{sq(16, 4)}{sq(28, 4)}<path d="M7 10l10 8M19 10l0 8M31 10l-10 8" /><circle cx="20" cy="23" r="3.2" /></svg>);
    case 7: // Creative: nodes -> circle -> node
      return (<svg {...p}>{sq(3, 8)}{sq(3, 18)}<path d="M9 11l5 3M9 21l5-3" /><circle cx="19" cy="15" r="3.6" /><path d="M23 15h6" />{sq(30, 12)}</svg>);
    case 8: // Training: chart up
      return (<svg {...p}><path d="M5 24l8-7 6 4 9-11" /><path d="M24 10h5v5" /></svg>);
    default:
      return (<svg {...p}>{sq(16, 12)}</svg>);
  }
}

/**
 * Full blueprint renderer + chat editor + persistence. Used by the create flow
 * (/blueprint) with initialData from a fresh generation, and by /blueprint/[id]
 * with initialData + initialId loaded from storage. Owns its own `data` state so
 * chat edits and autosave stay self-contained.
 */
export function BlueprintDoc({
  initialData,
  initialId,
  lead,
  onRestart,
}: {
  initialData: SalesBlueprint;
  initialId?: string;
  /** Captured at intake on the public funnel. Absent on the shared /blueprint/[id] view. */
  lead?: { name: string; email: string; business: string };
  onRestart?: () => void;
}) {
  const [data, setData] = useState<SalesBlueprint>(initialData);
  const [tab, setTab] = useState<TabKey>('overview');
  const [blueprintId, setBlueprintId] = useState<string | null>(initialId ?? null);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>(
    initialId ? 'saved' : 'idle'
  );

  // Persist. Insert on first save (create flow), update thereafter.
  const savingRef = useRef(false);
  async function persist(next: SalesBlueprint) {
    if (savingRef.current) return;
    savingRef.current = true;
    setSaveState('saving');
    try {
      const res = await fetch('/api/blueprint-map/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: blueprintId ?? undefined,
          data: next,
          name: lead?.name || undefined,
          email: lead?.email || undefined,
          business: lead?.business || undefined,
        }),
      });
      const j = (await res.json()) as { ok: boolean; id?: string };
      if (j.ok && j.id) {
        setBlueprintId(j.id);
        setSaveState('saved');
      } else {
        setSaveState('error');
      }
    } catch {
      setSaveState('error');
    } finally {
      savingRef.current = false;
    }
  }

  // Save once on mount for a freshly generated (unsaved) blueprint.
  const mountSavedRef = useRef(false);
  useEffect(() => {
    if (initialId || mountSavedRef.current) return;
    mountSavedRef.current = true;
    void persist(initialData);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reveal capability rows once on first render; never replay on edits.
  const revealedRef = useRef(false);
  const [revealed, setRevealed] = useState(0);
  useEffect(() => {
    if (revealedRef.current) {
      setRevealed(data.capabilities.length);
      return;
    }
    setRevealed(0);
    let i = 0;
    const iv = setInterval(() => {
      i++;
      setRevealed(i);
      if (i >= data.capabilities.length) {
        clearInterval(iv);
        revealedRef.current = true;
      }
    }, 140);
    return () => clearInterval(iv);
  }, [data]);

  function applyEdit(next: SalesBlueprint) {
    setData(next);
    void persist(next);
  }

  const hasGaps = data.capabilities.some((c) => c.gap_question);

  return (
    <div className={s.doc}>
      <div className={s.docTopbar}>
        <div className={s.docHead}>
          <div className={s.wm}>polynize</div>
          <h1 className={s.h1}>
            {data.client} <span className={s.org}>Blueprint</span>
          </h1>
          {data.session && <div className={s.session}>{data.session}</div>}
        </div>
        <ShareButton blueprintId={blueprintId} saveState={saveState} />
      </div>

      <div className={s.tabs}>
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            className={`${s.tab} ${tab === t.key ? s.active : ''}`}
            onClick={() => setTab(t.key)}
          >
            <span className={s.tabIcon}><TabIcon k={t.key} /></span>
            {t.label}
            {t.key === 'map' && hasGaps && <span className={s.tabDot} aria-hidden="true" />}
          </button>
        ))}
      </div>

      <div className={s.docPad}>
        {tab === 'overview' && <OverviewTab data={data} />}
        {tab === 'map' && <MapTab data={data} revealed={revealed} />}
        {tab === 'benchmarks' && <BenchmarksTab data={data} />}
        {tab === 'transformation' && <TransformationTab data={data} />}
        {tab === 'team' && <TeamTab data={data} />}
        {tab === 'build' && <BuildTab data={data} onRestart={onRestart} />}
      </div>

      <ChatDock data={data} onApply={applyEdit} />
    </div>
  );
}

/* ---------- Share ---------- */

function ShareButton({
  blueprintId,
  saveState,
}: {
  blueprintId: string | null;
  saveState: 'idle' | 'saving' | 'saved' | 'error';
}) {
  const [copied, setCopied] = useState(false);
  if (!blueprintId) {
    return (
      <div className={s.shareWrap}>
        <button type="button" className={s.shareBtn} disabled>
          {saveState === 'error' ? 'Share unavailable' : 'Saving…'}
        </button>
      </div>
    );
  }
  const url = typeof window !== 'undefined' ? `${window.location.origin}/blueprint/${blueprintId}` : '';
  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      /* clipboard may be blocked; the field below is selectable as a fallback */
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2200);
  }
  return (
    <div className={s.shareWrap}>
      <button type="button" className={s.shareBtn} onClick={copy}>
        {copied ? 'Link copied ✓' : 'Share ↗'}
      </button>
      {copied && <div className={s.shareUrl}>{url}</div>}
    </div>
  );
}

/* ---------- Tabs ---------- */

function OverviewTab({ data }: { data: SalesBlueprint }) {
  return (
    <>
      <div className={s.bottleneck}>
        <div className={s.bl}>Bottleneck</div>
        <p>{data.bottleneck}</p>
      </div>
      <section className={s.section}>
        <div className={s.sechead}>
          <span className={s.sn}>00</span>
          <h2>Purpose</h2>
        </div>
        <p className={s.prose}>{data.purpose}</p>
      </section>
      <section className={s.section}>
        <div className={s.sechead}>
          <span className={s.sn}>01</span>
          <h2>Current Workflow</h2>
        </div>
        <p className={s.secNote}>{data.current_workflow.narrative}</p>
        <div className={s.wf}>
          {data.current_workflow.phases.map((ph, i) => (
            <div key={i} className={s.wfItem}>
              <div className={s.wfCard}>
                <div className={s.wfHead}>
                  <span className={s.wfDot} style={{ background: sevColor(ph.risk) }} aria-hidden="true" />
                  <span className={s.wfName}>{ph.name}</span>
                </div>
                <p className={s.wfSummary}>{ph.summary}</p>
              </div>
              {i < data.current_workflow.phases.length - 1 && (
                <span className={s.wfArrow} aria-hidden="true">→</span>
              )}
            </div>
          ))}
        </div>
      </section>
    </>
  );
}

function MapTab({ data, revealed }: { data: SalesBlueprint; revealed: number }) {
  const [open, setOpen] = useState<Set<string>>(new Set());
  function toggle(id: string) {
    setOpen((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  const clusters: { name: string; caps: SalesBlueprint['capabilities'] }[] = [];
  for (const cap of data.capabilities) {
    const last = clusters[clusters.length - 1];
    if (last && last.name === cap.cluster) last.caps.push(cap);
    else clusters.push({ name: cap.cluster, caps: [cap] });
  }
  const counts = data.capabilities.reduce(
    (acc, c) => {
      acc[c.allocation]++;
      return acc;
    },
    { human: 0, hybrid: 0, agent: 0 } as Record<string, number>
  );
  let rowIndex = -1;

  return (
    <section className={s.section}>
      <div className={s.sechead}>
        <span className={s.sn}>02</span>
        <h2>Capability Map</h2>
      </div>
      <div className={s.panel}>
        <div className={s.cmapHead}>
          <span className={`${s.ch} ${s.first}`}>Capability</span>
          <span className={s.ch} style={{ color: 'var(--coral)' }}>Human</span>
          <span className={s.ch} style={{ color: 'var(--amber)' }}>Hybrid</span>
          <span className={s.ch} style={{ color: 'var(--mint)' }}>Agent</span>
        </div>
        {clusters.map((cl, ci) => (
          <div key={ci}>
            <div className={s.clusterLbl}>{cl.name}</div>
            {cl.caps.map((cap) => {
              rowIndex++;
              const lit = rowIndex < revealed;
              const faded = cap.completeness === 'ghost' || cap.confidence === 'low';
              const isOpen = open.has(cap.id);
              return (
                <div key={cap.id} className={`${s.capWrap} ${lit ? s.lit : ''} ${faded ? s.faded : ''}`}>
                  <div className={s.cmapRow} role="row" aria-label={`${cap.name}: allocated to ${cap.allocation}`}>
                    <button
                      type="button"
                      className={s.rowToggle}
                      onClick={() => toggle(cap.id)}
                      aria-expanded={isOpen}
                    >
                      <span className={`${s.chev} ${isOpen ? s.chevOpen : ''}`} aria-hidden="true">⌄</span>
                      <span className={s.rid}>{cap.id}</span>
                      <span className={s.rnameText}>{cap.name}</span>
                      {cap.gap_question && <span className={s.gapPill}>? 1</span>}
                    </button>
                    {(['human', 'hybrid', 'agent'] as const).map((c) => {
                      const on = cap.allocation === c && lit;
                      return (
                        <div key={c} className={`${s.allocCell} ${on ? s.on : ''} ${ALLOC_CLASS[c]}`} aria-hidden="true" />
                      );
                    })}
                  </div>
                  {isOpen && (
                    <div className={`${s.capExpand} ${s[EXPAND_CLASS[cap.allocation]]}`}>
                      {cap.detail && <p className={s.capDetailLine}>{cap.detail}</p>}
                      {cap.tasks.length > 0 && (
                        <ul className={s.taskList}>
                          {cap.tasks.map((t, ti) => (
                            <li key={ti} className={s.taskItem}>
                              <span className={s.taskPlus}>+</span>
                              {t}
                            </li>
                          ))}
                        </ul>
                      )}
                      {cap.gap_question && (
                        <div className={s.gapQ}>
                          <span className={s.qm}>?</span>
                          {cap.gap_question}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
        <div className={s.cmapFoot}>
          <span>
            Target allocation · <b>{counts.agent}</b> agent · <b>{counts.hybrid}</b> hybrid ·{' '}
            <b>{counts.human}</b> human
          </span>
        </div>
      </div>
    </section>
  );
}

function BenchmarksTab({ data }: { data: SalesBlueprint }) {
  return (
    <section className={s.section}>
      <div className={s.sechead}>
        <span className={s.sn}>03</span>
        <h2>Benchmarks</h2>
      </div>
      <p className={s.secNote}>{data.benchmark_summary}</p>
      <div className={s.chartWrap}>
        <BenchmarkChart caps={data.capabilities} />
      </div>
      <div className={s.panel}>
        {data.capabilities.map((cap) => {
          const gap = Math.max(0, cap.benchmark_level - cap.current_level);
          const sev = severity(gap);
          return (
            <div key={cap.id} className={s.benchRow}>
              <div>
                <div className={s.benchName}>{cap.name}</div>
                <div className={s.benchCluster}>{cap.cluster}</div>
              </div>
              <div>
                <div className={s.gapbar}>
                  <div className={`${s.fill} ${s[`sev-${sev}`]}`} style={{ width: `${cap.current_level}%` }} />
                  <div className={s.mark} style={{ left: `${cap.benchmark_level}%` }} />
                </div>
                <div className={s.gapMeta}>
                  <span>now {cap.current_level}</span>
                  <span className={s[`sev-${sev}`]}>gap {gap}</span>
                  <span>target {cap.benchmark_level}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function BenchmarkChart({ caps }: { caps: SalesBlueprint['capabilities'] }) {
  const n = caps.length;
  const step = 84;
  const padX = 24;
  const W = Math.max(560, n * step + padX * 2);
  const H = 210;
  const topY = 34; // the benchmark line = "what good looks like" ceiling
  const baseY = 184;
  const plotH = baseY - topY;
  const bw = 46;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Current capability level against the benchmark, by capability">
      {/* benchmark reference line + label */}
      <line x1={padX} y1={topY} x2={W - padX} y2={topY} stroke="var(--text-2)" strokeWidth={1} strokeDasharray="5 4" opacity={0.75} />
      <text x={padX} y={topY - 9} fontSize={10} letterSpacing="1.4" fill="var(--text-2)">BENCHMARK — WHAT GOOD LOOKS LIKE</text>
      <line x1={padX} y1={baseY} x2={W - padX} y2={baseY} stroke="var(--border-soft)" strokeWidth={1} />
      {caps.map((c, i) => {
        const cx = padX + i * step + step / 2;
        const color = sevColor(severity(uplift(c)));
        // Bar reaches the top line at the benchmark level; solid portion = current.
        const benchH = (plotH * c.benchmark_level) / 100;
        const curH = (plotH * c.current_level) / 100;
        return (
          <g key={c.id}>
            {/* faint gap portion up to benchmark */}
            <rect x={cx - bw / 2} y={baseY - benchH} width={bw} height={benchH} rx={3} fill={color} fillOpacity={0.08} />
            {/* solid current portion */}
            <rect x={cx - bw / 2} y={baseY - curH} width={bw} height={curH} rx={3} fill={color} fillOpacity={0.55} stroke={color} strokeOpacity={0.85} />
            <text x={cx} y={baseY - curH - 6} textAnchor="middle" fontSize={11} fill="var(--text-2)">{c.current_level}</text>
            <text x={cx} y={baseY + 16} textAnchor="middle" fontSize={9.5} fill="var(--text-3)">{c.id}</text>
          </g>
        );
      })}
    </svg>
  );
}

function TransformationTab({ data }: { data: SalesBlueprint }) {
  // Sort: train first, then deploy (by uplift desc), then hold at the bottom.
  const rows = [...data.capabilities].sort((a, b) => {
    const m = MOVE_ORDER[a.transformation.move] - MOVE_ORDER[b.transformation.move];
    if (m !== 0) return m;
    return uplift(b) - uplift(a);
  });
  const firstHoldIdx = rows.findIndex((c) => c.transformation.move === 'hold');

  return (
    <section className={s.section}>
      <div className={s.sechead}>
        <span className={s.sn}>04</span>
        <h2>Transformation Plan</h2>
      </div>
      <p className={s.secNote}>
        The sequence: train the human judgment first, deploy the agent capabilities by impact, hold what is
        already at the benchmark.
      </p>
      <div className={s.panel}>
        <div className={s.actHead}>
          <span className={s.railSpacer} />
          <span>Move</span>
          <span>Capability</span>
          <span>Rationale</span>
          <span className={s.upliftHead}>Uplift</span>
        </div>
        {rows.map((cap, i) => {
          const mv = cap.transformation.move;
          const up = uplift(cap);
          const upClass = mv === 'hold' ? 'sev-low' : `sev-${severity(up)}`;
          return (
            <div key={cap.id}>
              {i === firstHoldIdx && firstHoldIdx > 0 && (
                <div className={s.actGroup}>Hold — already at the benchmark</div>
              )}
              <div className={s.actRow}>
                <span className={s.railCell}>
                  <span className={s.railSeg} aria-hidden="true" />
                  <span className={`${s.railNode} ${s[ALLOC_NODE[cap.allocation]]}`} aria-hidden="true" />
                </span>
                <span className={`${s.movePill} ${s[MOVE_CLASS[mv]]}`}>{mv}</span>
                <span className={s.actCap}>{cap.name}</span>
                <span className={s.actRat}>{cap.transformation.rationale}</span>
                <span className={`${s.actUplift} ${s[upClass]}`}>+{up}</span>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function TeamTab({ data }: { data: SalesBlueprint }) {
  const shape = SHAPES.find((sh) => sh.id === data.team_shape.id) ?? SHAPES[1];
  return (
    <section className={s.section}>
      <div className={s.sechead}>
        <span className={s.sn}>05</span>
        <h2>Agentic Design</h2>
        <span className={s.tbc}>Proposed · to confirm</span>
      </div>
      <p className={s.secNote}>
        Agents are not one shape. The work has a shape, and the agents are designed around the human who owns
        it. We match this unit to one of eight Cognitive Work Unit shapes, then compose the agents that fit it.
      </p>

      <div className={s.shapeSelector}>
        {SHAPES.map((sh) => {
          const on = sh.id === shape.id;
          return (
            <div key={sh.id} className={`${s.shapeChip} ${on ? s.shapeChipOn : ''}`}>
              <ShapeIcon id={sh.id} active={on} />
              <span className={s.shapeChipLabel}>{sh.label}</span>
            </div>
          );
        })}
      </div>

      <div className={s.shapePanel}>
        <div className={s.shapePanelHead}>
          Team shape · <b>{shape.name}</b>
        </div>
        <p className={s.shapeSig}>{shape.sig}</p>
        {data.team_shape.why && <p className={s.shapeWhy}>{data.team_shape.why}</p>}
      </div>

      <div className={s.teamList}>
        {data.team_design.agents.map((a, i) => (
          <div key={i} className={s.teamListRow}>
            <span className={s.teamListTag}>agent · {i + 1}</span>
            <span className={s.teamListBot} aria-hidden="true"><BotIcon /></span>
            <div className={s.teamListBody}>
              <div className={s.teamListName}>
                {a.name} <span className={s.teamListRole}>{a.role}</span>
              </div>
              <div className={s.teamListDesc}>{a.desc}</div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function BuildTab({ data, onRestart }: { data: SalesBlueprint; onRestart?: () => void }) {
  return (
    <>
      <section className={s.section}>
        <div className={s.sechead}>
          <span className={s.sn}>06</span>
          <h2>Build Plan</h2>
          <span className={s.tbc}>Indicative</span>
        </div>
        {isNotEnough(data.build_plan) ? (
          <div className={s.notEnough}>Not enough information yet. We will scope this together.</div>
        ) : (
          <p className={s.prose}>{data.build_plan}</p>
        )}
      </section>
      <section className={s.section}>
        <div className={s.sechead}>
          <span className={s.sn}>07</span>
          <h2>Outcomes</h2>
          <span className={s.tbc}>Indicative</span>
        </div>
        {isNotEnough(data.outcomes) ? (
          <div className={s.notEnough}>Not enough information yet. We will scope this together.</div>
        ) : (
          <p className={s.prose}>{data.outcomes}</p>
        )}
        <p className={s.secNote} style={{ marginTop: 16 }}>
          <strong style={{ color: 'var(--text)' }}>What good looks like:</strong>{' '}
          {data.what_good_looks_like}
        </p>
      </section>
      {onRestart && (
        <div className={s.restart}>
          <button type="button" className={s.restartLink} onClick={onRestart}>
            + map another bottleneck
          </button>
        </div>
      )}
    </>
  );
}

/* ---------- Chat editor ---------- */

function ChatDock({ data, onApply }: { data: SalesBlueprint; onApply: (d: SalesBlueprint) => void }) {
  const [collapsed, setCollapsed] = useState(true);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const msgsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    msgsRef.current?.scrollTo({ top: msgsRef.current.scrollHeight });
  }, [messages]);

  async function send() {
    const text = input.trim();
    if (!text || busy) return;
    setInput('');
    setBusy(true);
    setMessages((m) => [...m, { role: 'user', text }, { role: 'working', text: 'applying your change' }]);
    try {
      const res = await fetch('/api/blueprint-map/revise', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ current: data, instruction: text }),
      });
      const j = (await res.json()) as { ok: boolean; data?: SalesBlueprint; summary?: string };
      setMessages((m) => m.filter((x) => x.role !== 'working'));
      if (j.ok && j.data) {
        onApply(j.data);
        setMessages((m) => [...m, { role: 'bot', text: j.summary || 'Updated the blueprint.' }]);
      } else {
        setMessages((m) => [...m, { role: 'err', text: 'Could not apply that. Try rephrasing the change.' }]);
      }
    } catch {
      setMessages((m) => m.filter((x) => x.role !== 'working').concat({ role: 'err', text: 'Network error. Try again.' }));
    } finally {
      setBusy(false);
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void send();
    }
  }

  return (
    <div className={`${s.chatDock} ${collapsed ? s.collapsed : ''}`}>
      <div className={s.chatHead} onClick={() => setCollapsed((c) => !c)}>
        <span className={s.chatDot} />
        <span className={s.chatTitle}>Refine the map</span>
        <span className={s.chatHint}>{busy ? 'working…' : collapsed ? 'click to edit' : 'natural language'}</span>
        <span className={s.chatChevron}>⌄</span>
      </div>
      <div className={s.chatBody}>
        <div className={s.chatMsgs} ref={msgsRef}>
          {messages.length === 0 && (
            <div className={s.chatEmpty}>
              Tell me what to change and I will update the map live. Try:{' '}
              <code>move the second capability to hybrid</code> or{' '}
              <code>reword the purpose to emphasise security</code>.
            </div>
          )}
          {messages.map((m, i) => (
            <div key={i} className={`${s.msg} ${s[m.role]}`}>{m.text}</div>
          ))}
        </div>
        <div className={s.chatForm}>
          <textarea
            className={s.chatInput}
            rows={1}
            value={input}
            placeholder="Change project direction to hybrid…"
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            disabled={busy}
          />
          <button type="button" className={s.chatSend} onClick={send} disabled={busy || !input.trim()}>
            {busy ? '…' : 'Send'}
          </button>
        </div>
      </div>
    </div>
  );
}

function BotIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="5" y="8" width="14" height="11" rx="2.5" />
      <path d="M12 4.5v3.5" />
      <circle cx="12" cy="3.4" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="9.3" cy="13" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="14.7" cy="13" r="1.1" fill="currentColor" stroke="none" />
      <path d="M9.5 16.3h5" />
    </svg>
  );
}
