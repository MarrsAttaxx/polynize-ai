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
function isNotEnough(v: string): boolean {
  return v.trim().toLowerCase().startsWith('not enough information');
}

type ChatMsg = { role: 'user' | 'bot' | 'err' | 'working'; text: string };

/**
 * Full blueprint renderer + chat editor + persistence. Used by the create flow
 * (/blueprint) with initialData from a fresh generation, and by /blueprint/[id]
 * with initialData + initialId loaded from storage. Owns its own `data` state so
 * chat edits and autosave stay self-contained.
 */
export function BlueprintDoc({
  initialData,
  initialId,
  onRestart,
}: {
  initialData: SalesBlueprint;
  initialId?: string;
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
        body: JSON.stringify({ id: blueprintId ?? undefined, data: next }),
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
            {data.client} <span className={s.org}>capability map</span>
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
        <div className={s.flow}>
          {data.current_workflow.phases.map((ph, i) => (
            <div key={i} className={s.phase}>
              <div className={s.phaseName}>{ph.name}</div>
              {ph.steps.map((st, j) => (
                <div key={j} className={s.step}>
                  <div className={s.stepLabel}>{st.label}</div>
                  <div className={`${s.stepBar} ${s[`sev-${st.risk}`]}`} />
                </div>
              ))}
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
                    <div className={s.capExpand}>
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
  const W = Math.max(560, n * step);
  const H = 200;
  const padT = 18;
  const padB = 40;
  const plotH = H - padT - padB;
  const bw = 46;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Current capability level against benchmark, by capability">
      <line x1={0} y1={padT + plotH} x2={W} y2={padT + plotH} stroke="var(--border-soft)" strokeWidth={1} />
      {caps.map((c, i) => {
        const cx = i * step + step / 2;
        const gap = Math.max(0, c.benchmark_level - c.current_level);
        const color = sevColor(severity(gap));
        const curH = (plotH * c.current_level) / 100;
        const curY = padT + plotH - curH;
        const benchY = padT + plotH - (plotH * c.benchmark_level) / 100;
        return (
          <g key={c.id}>
            <rect x={cx - bw / 2} y={curY} width={bw} height={curH} rx={3} fill={color} fillOpacity={0.55} stroke={color} />
            <line x1={cx - bw / 2 - 4} x2={cx + bw / 2 + 4} y1={benchY} y2={benchY} stroke="var(--text-2)" strokeWidth={1.4} strokeDasharray="5 3" />
            <text x={cx} y={curY - 6} textAnchor="middle" fontSize={11} fill="var(--text-2)">{c.current_level}</text>
            <text x={cx} y={H - 20} textAnchor="middle" fontSize={10} fill="var(--text-3)">{c.id}</text>
            <text x={cx} y={H - 6} textAnchor="middle" fontSize={9} fill="var(--text-3)">target {c.benchmark_level}</text>
          </g>
        );
      })}
    </svg>
  );
}

function TransformationTab({ data }: { data: SalesBlueprint }) {
  return (
    <section className={s.section}>
      <div className={s.sechead}>
        <span className={s.sn}>04</span>
        <h2>Transformation Plan</h2>
      </div>
      <div className={s.panel}>
        {data.capabilities.map((cap) => {
          const agentEmpty = isNotEnough(cap.transformation.agent_move);
          return (
            <div key={cap.id} className={s.planRow}>
              <div className={s.planCap}>
                <span className={`${s.glyph} ${s[cap.allocation]}`} aria-hidden="true" />
                {cap.name}
              </div>
              <div className={`${s.box} ${s.person}`}>
                <span className={s.bl}>Person-led</span>
                {cap.transformation.person_led}
              </div>
              {agentEmpty ? (
                <div className={`${s.box} ${s.empty}`}>stays human</div>
              ) : (
                <div className={`${s.box} ${s.agent}`}>
                  <span className={s.bl}>Agent move</span>
                  {cap.transformation.agent_move}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function TeamTab({ data }: { data: SalesBlueprint }) {
  return (
    <section className={s.section}>
      <div className={s.sechead}>
        <span className={s.sn}>05</span>
        <h2>Agentic Design</h2>
        <span className={s.tbc}>Proposed · to confirm</span>
      </div>
      <div className={s.teamGrid}>
        {data.team_design.agents.map((a, i) => (
          <div key={i} className={s.agentCard}>
            <span className={s.agentBot} aria-label="agent" title="Agent">
              <BotIcon />
            </span>
            <div className={s.agentName}>{a.name}</div>
            <div className={s.agentRole}>{a.role}</div>
            <div className={s.agentDesc}>{a.desc}</div>
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
              <code>make Historical site assessment retrieval an agent</code> or{' '}
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
