'use client';

import { useEffect, useRef, useState } from 'react';
import type { Answers, CapabilityMapData, CapabilityMapV05 } from '@/lib/types';
import { v05ToLegacy } from '@/lib/agents/v05-adapter';
import { completeBlueprintFlow } from '@/lib/persist-client';
import { track } from '@/lib/analytics';
import { ResetLink } from '@/app/_components/ResetLink';
import { DayInLife } from '@/app/_components/DayInLife';
import s from './phase-b.module.css';

const BOOKING_URL = 'https://calendly.com/marrscoiro/meeting30';

type Props = {
  answers: Partial<Answers>;
  /** Pre-loaded data (resume from localStorage) — skips LLM call + auto-create. */
  preloaded?: CapabilityMapV05;
  /** Bubbles the v0.5 data up to the controller for resume + persistence. */
  onDataReady: (data: CapabilityMapV05) => void;
};

type Stage = 'loading' | 'intro' | 'reveal' | 'done' | 'error';

const INTRO_MS = 1400;
const REVEAL_INTERVAL_MS = 220;
const DONE_DELAY_MS = 600;

/**
 * Loading-state phase messages. Cycle through these while waiting on the
 * capability-map LLM call (~50s typical with Gemini 3.5 Flash). Each entry's
 * `from` is "show this message after N ms have elapsed since loading started".
 * The last "finalizing" message is the safety net for slow generations; if
 * we ever cross 90s we hold on it. Copy is lowercase to match the existing
 * loading-state aesthetic ("mapping your bottleneck", "this takes a few
 * seconds"). No em-dashes per CLAUDE.md §3.
 */
const LOADING_MESSAGES: { from: number; text: string }[] = [
  { from: 0,     text: 'identifying capabilities from your bottleneck' },
  { from: 10000, text: 'clustering work into phases' },
  { from: 22000, text: 'allocating tasks: human, hybrid, or agent' },
  { from: 34000, text: 'designing your agent team' },
  { from: 46000, text: 'calculating leverage estimate' },
  { from: 60000, text: 'finalizing your map' },
];

export function PhaseB({ answers, preloaded, onDataReady }: Props) {
  const firstName = (answers.name ?? '').trim().split(/\s+/)[0] ?? '';
  const company = (answers.company ?? '').trim() || 'your business';
  const [v05, setV05] = useState<CapabilityMapV05 | null>(preloaded ?? null);
  const [stage, setStage] = useState<Stage>(preloaded ? 'done' : 'loading');
  const [revealIdx, setRevealIdx] = useState<number>(preloaded ? -2 : -1);
  const [blueprintId, setBlueprintId] = useState<string | null>(null);
  const [activeTip, setActiveTip] = useState<number | null>(null);
  const [errorDetail, setErrorDetail] = useState<string | null>(null);
  const [loadingMessage, setLoadingMessage] = useState<string>(
    LOADING_MESSAGES[0].text
  );
  const blueprintFiredRef = useRef(false);

  // Legacy-shape view derived from v0.5 — drives the existing reveal animation
  // and renderer. The full v0.5 data is still passed up to persistence.
  const data: CapabilityMapData | null = v05 ? v05ToLegacy(v05) : null;

  // 1. Fetch the capability map (skipped when preloaded).
  useEffect(() => {
    if (v05) return;
    const controller = new AbortController();
    (async () => {
      try {
        const res = await fetch('/api/capability-map/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ answers }),
          signal: controller.signal,
        });

        // Read the body as text first so we can distinguish between:
        //  - server returned structured { ok, error, detail } JSON
        //  - server returned non-JSON (Vercel's HTML 504/500 gateway page,
        //    or any upstream error that bypassed our route handler)
        // The previous code called res.json() unconditionally, which threw
        // "Unexpected token 'A'..." on Vercel's "An error occurred..." 504
        // body and surfaced as a cryptic React crash instead of the friendly
        // error UI. See Step 7A.3 triage.
        const rawText = await res.text();
        let parsed:
          | {
              ok: boolean;
              data?: CapabilityMapV05;
              error?: string;
              detail?: string;
            }
          | null = null;
        try {
          parsed = JSON.parse(rawText);
        } catch {
          parsed = null;
        }

        if (controller.signal.aborted) return;

        if (parsed && parsed.ok && parsed.data) {
          setV05(parsed.data);
          setStage('intro');
          return;
        }

        // Failure path. If we have structured JSON, use its error/detail.
        // Otherwise synthesize a message from the HTTP status + body preview,
        // so the technical-detail disclosure shows something actionable.
        let reason: string;
        let detail: string;
        if (parsed) {
          reason = parsed.error ?? 'unknown';
          detail = parsed.detail ?? parsed.error ?? 'Unknown error';
          console.error('[phase-b] capability map generation failed:', parsed);
        } else if (res.status === 504) {
          reason = 'gateway_timeout';
          detail =
            'The generation took longer than the function budget allows. The model is likely overloaded; try again in a moment.';
          console.error(
            `[phase-b] capability map fetch got 504, body preview: ${rawText.slice(0, 200)}`
          );
        } else {
          reason = `http_${res.status}`;
          detail = `Server returned HTTP ${res.status}: ${rawText.slice(0, 200)}`;
          console.error(
            `[phase-b] capability map fetch got non-JSON ${res.status}, body preview: ${rawText.slice(0, 200)}`
          );
        }
        setErrorDetail(detail);
        setStage('error');
        track('phase_b_error', { reason });
      } catch (e) {
        if (controller.signal.aborted) return;
        const msg = e instanceof Error ? e.message : 'Network error';
        console.error('[phase-b] capability map fetch threw:', msg);
        setErrorDetail(msg);
        setStage('error');
        track('phase_b_error', { reason: 'network' });
      }
    })();
    return () => controller.abort();
  }, [answers, v05]);

  // 2. Auto-create the blueprint as soon as data is available.
  useEffect(() => {
    if (!v05 || !data || blueprintFiredRef.current) return;
    blueprintFiredRef.current = true;
    onDataReady(v05);

    if (preloaded) {
      void completeBlueprintFlow(v05).then((res) => {
        if ('id' in res) setBlueprintId(res.id);
      });
      return;
    }

    void (async () => {
      const result = await completeBlueprintFlow(v05);
      if ('id' in result) {
        track('blueprint_created', { id: result.id, shape_id: v05.shape_internal });
        setBlueprintId(result.id);
      } else {
        console.warn('[phase-b] blueprint creation failed:', result.error);
      }
    })();
  }, [v05, data, preloaded, onDataReady]);

  // 3a. Cycle loading-state messages while we wait on the LLM call. The
  // generation takes ~50s with Gemini 3.5 Flash, so a static "this takes a
  // few seconds" doesn't survive the actual wait. Each LOADING_MESSAGES entry
  // schedules a setTimeout that swaps the displayed text at its `from` time.
  // On retry (Try again button → stage = 'loading' again) the effect re-runs
  // and resets to the first message.
  useEffect(() => {
    if (stage !== 'loading') return;
    setLoadingMessage(LOADING_MESSAGES[0].text);
    const timers = LOADING_MESSAGES.slice(1).map((msg) =>
      setTimeout(() => setLoadingMessage(msg.text), msg.from)
    );
    return () => timers.forEach(clearTimeout);
  }, [stage]);

  // 3. intro → reveal
  useEffect(() => {
    if (stage !== 'intro') return;
    const t = setTimeout(() => setStage('reveal'), INTRO_MS);
    return () => clearTimeout(t);
  }, [stage]);

  // 4. Reveal one capability at a time, then → done
  useEffect(() => {
    if (stage !== 'reveal' || !data) return;
    setRevealIdx(-1);
    let i = 0;
    const iv = setInterval(() => {
      setRevealIdx(i);
      i++;
      if (i > data.capabilities.length) {
        clearInterval(iv);
        setTimeout(() => setStage('done'), DONE_DELAY_MS);
      }
    }, REVEAL_INTERVAL_MS);
    return () => clearInterval(iv);
  }, [stage, data]);

  // Error state — LLM call failed after retry, or network blew up.
  if (stage === 'error') {
    return (
      <div className={s.phaseB}>
        <div className={s.intro}>
          <div className={s.tag} style={{ color: 'var(--coral)' }}>
            capability_map / failed
          </div>
          <h2
            className={s.title}
            style={{ fontSize: 28, marginTop: 24, marginBottom: 16, textAlign: 'center' }}
          >
            {firstName ? `${firstName}, w` : 'W'}e couldn&apos;t generate your map.
          </h2>
          <p
            className={s.stat}
            style={{
              fontSize: 14.5,
              lineHeight: 1.6,
              maxWidth: 480,
              textAlign: 'center',
              marginInline: 'auto',
              marginBottom: 28,
            }}
          >
            Sometimes the model gets stuck. Try again, or book a call with Marrs
            and he&apos;ll walk you through the mapping live.
          </p>
          <div
            style={{
              display: 'flex',
              gap: 12,
              flexWrap: 'wrap',
              justifyContent: 'center',
              marginBottom: 16,
            }}
          >
            <button
              type="button"
              onClick={() => {
                setErrorDetail(null);
                setV05(null);
                setStage('loading');
                track('cta_click', {
                  surface: 'phase_b_error',
                  label: 'try_again',
                });
              }}
              style={{
                padding: '14px 22px',
                border: '1px solid var(--border-soft)',
                borderRadius: 12,
                background: 'transparent',
                color: 'inherit',
                cursor: 'pointer',
                fontSize: 14,
              }}
            >
              Try again
            </button>
            <a
              href={BOOKING_URL}
              target="_blank"
              rel="noopener noreferrer"
              className={`${s.cta} ${s.ctaPrimary}`}
              onClick={() =>
                track('booking_click', { surface: 'phase_b_error' })
              }
              style={{ textDecoration: 'none' }}
            >
              Book a call with Marrs <span className={s.ctaArr}>→</span>
            </a>
          </div>
          {errorDetail && (
            <details
              style={{
                fontSize: 11,
                color: 'var(--text-3)',
                fontFamily: 'monospace',
                maxWidth: 480,
                marginInline: 'auto',
                textAlign: 'left',
              }}
            >
              <summary style={{ cursor: 'pointer' }}>technical detail</summary>
              <pre
                style={{
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  marginTop: 8,
                }}
              >
                {errorDetail}
              </pre>
            </details>
          )}
        </div>
      </div>
    );
  }

  if (stage === 'loading' || !data) {
    return (
      <div className={s.phaseB}>
        <div className={s.intro}>
          <div className={s.tag}>mapping your bottleneck</div>
          <div className={s.scan}>
            <div className={s.scanLine} />
            <div className={`${s.scanLine} ${s.scanLineD2}`} />
            <div className={`${s.scanLine} ${s.scanLineD3}`} />
          </div>
          {/* key={loadingMessage} forces React to remount this node on every
              message change so the CSS fade-in animation on .stat replays. */}
          <div key={loadingMessage} className={s.stat}>
            {loadingMessage}
          </div>
        </div>
      </div>
    );
  }

  if (stage === 'intro') {
    return (
      <div className={s.phaseB}>
        <div className={s.intro}>
          <div className={s.tag}>capability_map / generated</div>
          <div className={s.scan}>
            <div className={s.scanLine} />
            <div className={`${s.scanLine} ${s.scanLineD2}`} />
            <div className={`${s.scanLine} ${s.scanLineD3}`} />
          </div>
          <div className={s.stat}>{data.capabilities.length} capabilities identified</div>
        </div>
      </div>
    );
  }

  const allRevealed = stage === 'done' || preloaded;

  return (
    <div className={s.phaseB}>
      <div className={s.main}>
        <div className={s.head}>
          <div className={s.eyebrow}>§ capability_map</div>
          <h1 className={s.title}>
            {firstName ? `${firstName}, here's your bottleneck,` : "Here's your bottleneck,"}
            <br />
            mapped<span className={s.titleAccent}>.</span>
          </h1>
        </div>

        <div className={s.grid}>
          <div className={s.colHead}>
            <div className={s.colHeadFn}>capability</div>
            <div className={s.colHeadC} style={{ color: 'var(--coral)' }}>
              HUMAN
            </div>
            <div className={s.colHeadC} style={{ color: 'var(--amber)' }}>
              HYBRID
            </div>
            <div className={s.colHeadC} style={{ color: 'var(--mint)' }}>
              AGENT
            </div>
          </div>
          {data.capabilities.map((cap, i) => {
            const on = allRevealed || i <= revealIdx;
            const tipOpen = activeTip === i;
            return (
              <div
                key={i}
                className={`${s.row} ${on ? s.rowLit : ''} ${tipOpen ? s.rowActive : ''}`}
                style={{ transitionDelay: `${i * 40}ms` }}
                role="row"
                aria-label={`${cap.label}: allocated to ${cap.allocation}`}
                onMouseEnter={on ? () => setActiveTip(i) : undefined}
                onMouseLeave={on ? () => setActiveTip(null) : undefined}
                onClick={on ? () => setActiveTip((cur) => (cur === i ? null : i)) : undefined}
              >
                <div className={s.fn}>
                  <div>{cap.label}</div>
                  <div className={s.fnDetail}>{cap.detail}</div>
                </div>
                {(['human', 'hybrid', 'agent'] as const).map((c) => {
                  const active = cap.allocation === c && on;
                  const toneClass =
                    c === 'human' ? s.cellHuman : c === 'hybrid' ? s.cellHybrid : s.cellAgent;
                  return (
                    <div
                      key={c}
                      className={`${s.cell} ${active ? toneClass : ''}`}
                      role="cell"
                      aria-hidden="true"
                    />
                  );
                })}
                {tipOpen && (
                  <CapabilityTooltip
                    label={cap.label}
                    allocation={cap.allocation}
                    detail={cap.detail}
                  />
                )}
              </div>
            );
          })}
        </div>

        {stage === 'done' && (
          <div className={s.summary}>
            <div className={s.pct}>
              <Pct label="Human-led" v={data.percentages.human} color="var(--coral)" />
              <Pct label="Hybrid" v={data.percentages.hybrid} color="var(--amber)" />
              <Pct label="Agent-exec" v={data.percentages.agent} color="var(--mint)" />
            </div>
            <p className={s.caption}>{data.interpretation}</p>

            <div className={s.leverageRow}>
              <div className={s.leverageBadge}>
                <div className={s.eyebrow}>§ estimated leverage</div>
                <div className={s.leverageValue}>{data.leverage_estimate}</div>
              </div>
              <p className={s.captionSub}>{data.leverage_rationale}</p>
            </div>

            <div className={s.teamPreview}>
              <div className={s.eyebrow}>§ the team that emerges</div>

              <div className={s.teamHumanRow}>
                <article className={`${s.dossierCard} ${s.dossierCardHuman}`}>
                  <div className={`${s.dossierAvatar} ${s.dossierAvatarHuman}`}>
                    <HumanIcon className={s.dossierIcon} />
                  </div>
                  <div className={s.dossierName}>{firstName || 'You'}</div>
                  <div className={s.dossierRole}>{data.team.human_owner.role}</div>
                </article>
              </div>

              {(() => {
                // CWU formation: human -> lead agent -> worker agents. Lead is
                // the agent whose name matches team_leader (D4); fall back to a
                // flat human -> all-agents row if there's no match.
                const all = data.team.agents;
                const li = data.team.team_leader
                  ? all.findIndex((a) => a.name === data.team.team_leader)
                  : -1;
                const lead = li >= 0 ? all[li] : null;
                const workers = lead ? all.filter((_, i) => i !== li) : all;
                const card = (a: (typeof all)[number], isLead: boolean) => (
                  <article
                    key={`${a.name}-${a.role}`}
                    className={s.dossierCard}
                    aria-label={`${a.name}, ${a.role}${isLead ? ' (team lead)' : ''}`}
                  >
                    {isLead && (
                      <div className={s.dossierBadge} style={{ color: 'var(--mint)' }}>
                        LEAD
                      </div>
                    )}
                    <div className={s.dossierAvatar}>
                      <BotIcon className={s.dossierIcon} />
                    </div>
                    <div className={s.dossierName}>{a.name}</div>
                    <div className={s.dossierRole}>{a.role}</div>
                    <p className={s.dossierDesc}>{a.short_desc}</p>
                  </article>
                );

                if (lead) {
                  return (
                    <>
                      <TeamBranchSvg agentCount={1} />
                      <div className={s.teamAgentRow} style={{ ['--agent-count' as string]: 1 }}>
                        {card(lead, true)}
                      </div>
                      <TeamBranchSvg agentCount={workers.length} />
                      <div
                        className={s.teamAgentRow}
                        style={{ ['--agent-count' as string]: workers.length }}
                      >
                        {workers.map((a) => card(a, false))}
                      </div>
                    </>
                  );
                }
                return (
                  <>
                    <TeamBranchSvg agentCount={all.length} />
                    <div
                      className={s.teamAgentRow}
                      style={{ ['--agent-count' as string]: all.length }}
                    >
                      {all.map((a) => card(a, false))}
                    </div>
                  </>
                );
              })()}
            </div>

            <div className={s.dayPreview}>
              <div className={s.eyebrow}>§ a day in the life</div>
              <h3 className={s.dayTitle}>
                What a Tuesday actually looks like<span style={{ color: 'var(--mint)' }}>.</span>
              </h3>
              <p className={s.dayLede}>
                Based on the bottleneck you described at {company}, here&apos;s a lightly
                fictionalised walk-through of a typical day with the team in place. The point
                isn&apos;t the specifics. It&apos;s the rhythm. You show up, you make decisions, the
                execution happens around you.
              </p>
              <DayInLife data={data} firstName={firstName || 'you'} />
            </div>

            <div className={s.readyHead}>
              <h3 className={s.readyTitle}>
                Ready to build this{firstName ? `, ${firstName}` : ''}
                <span style={{ color: 'var(--mint)' }}>?</span>
              </h3>
              <p className={s.readyLede}>
                A 30-minute call to walk you through the blueprint, sharpen the shape, and discuss
                the most effective way to unblock this bottleneck with an agentic team.
              </p>
            </div>

            <div className={s.ctas}>
              <a
                href={BOOKING_URL}
                target="_blank"
                rel="noopener noreferrer"
                className={`${s.cta} ${s.ctaPrimary}`}
                onClick={() =>
                  track('booking_click', { surface: 'phase_b_cta' })
                }
              >
                Book a call with Marrs <span className={s.ctaArr}>→</span>
              </a>

              <ShareCta
                blueprintId={blueprintId}
                onClick={() =>
                  track('cta_click', {
                    surface: 'phase_b_cta',
                    label: 'send_this_to_someone',
                  })
                }
              />
            </div>

            <div className={s.startOverWrap}>
              <ResetLink
                className={s.startOverLink}
                eventProps={{ surface: 'phase_b_done', label: 'start_over' }}
              >
                + map another bottleneck
              </ResetLink>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------- Sub-components ---------- */

function Pct({ label, v, color }: { label: string; v: number; color: string }) {
  const [w, setW] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setW(v), 200);
    return () => clearTimeout(t);
  }, [v]);
  return (
    <div>
      <div className={s.pctTop}>
        <span>{label}</span>
        <span className={s.pctValue} style={{ color }}>
          {v}%
        </span>
      </div>
      <div className={s.pctBar}>
        <div
          style={{
            width: `${w}%`,
            background: color,
            boxShadow: `0 1px 0 rgba(255,255,255,0.4) inset, 0 -1px 0 rgba(0,0,0,0.25) inset, 0 0 12px ${color}`,
          }}
        />
      </div>
    </div>
  );
}

function CapabilityTooltip({
  label,
  allocation,
  detail,
}: {
  label: string;
  allocation: 'human' | 'hybrid' | 'agent';
  detail: string;
}) {
  const left =
    allocation === 'human'
      ? 'calc(40% - 2.4px)'
      : allocation === 'hybrid'
        ? 'calc(60% + 2.4px)'
        : 'calc(80% + 7.2px)';

  const why =
    allocation === 'human'
      ? 'Human-critical: requires trust, judgment, or accountability that an agent cannot carry.'
      : allocation === 'hybrid'
        ? 'Hybrid: an agent does the groundwork, you review and steer the substance.'
        : 'Agent-executable: structured and repeatable enough for an agent to run end-to-end.';
  return (
    <div
      className={s.tooltip}
      role="tooltip"
      style={
        {
          '--tip-left': left,
          '--tip-width': 'calc(20% - 7.2px)',
        } as React.CSSProperties
      }
    >
      <div className={`${s.tooltipBadge} ${s[`tooltipBadge_${allocation}`]}`}>
        {allocation}
      </div>
      <div className={s.tooltipLabel}>{label}</div>
      <p className={s.tooltipDetail}>{detail}</p>
      <p className={s.tooltipWhy}>{why}</p>
    </div>
  );
}

function ShareCta({
  blueprintId,
  onClick,
}: {
  blueprintId: string | null;
  onClick: () => void;
}) {
  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    onClick();
    const url = blueprintId
      ? `${window.location.origin}/blueprints/${blueprintId}`
      : `${window.location.origin}/agents`;
    const subject = 'Check out this capability map I just created';
    const body = [
      'Hey,',
      '',
      'I just mapped a business bottleneck on polynize.ai and got back a really interesting capability map showing which parts of the work should stay human and which could be handled by agents.',
      '',
      `Take a look: ${url}`,
      '',
      'You can create your own at polynize.ai/agents',
      '',
      'Worth a look.',
    ].join('\n');
    window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };

  return (
    <div className={s.ctaShareWrap}>
      <p className={s.ctaShareLede}>
        Your capability map has been sent to your email. Want to share it with someone else?
      </p>
      <a
        href="#"
        className={`${s.cta} ${s.ctaSecondary}`}
        onClick={handleClick}
      >
        Send this to someone
      </a>
    </div>
  );
}

/* ---------- Icons ---------- */

function HumanIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 12a4.5 4.5 0 100-9 4.5 4.5 0 000 9z" />
      <path d="M3.5 21.25c0-4.4 3.8-7.75 8.5-7.75s8.5 3.35 8.5 7.75a.75.75 0 01-.75.75H4.25a.75.75 0 01-.75-.75z" />
    </svg>
  );
}

function BotIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      fillRule="evenodd"
      clipRule="evenodd"
      aria-hidden="true"
    >
      <path d="M12 2.5a.75.75 0 01.75.75V5h-1.5V3.25A.75.75 0 0112 2.5zM12 4.75a1.25 1.25 0 100 2.5 1.25 1.25 0 000-2.5z" />
      <path d="M5.5 8.5A2.5 2.5 0 018 6h8a2.5 2.5 0 012.5 2.5v8.75A2.75 2.75 0 0115.75 20h-7.5A2.75 2.75 0 015.5 17.25V8.5zM9 11a1.5 1.5 0 100 3 1.5 1.5 0 000-3zm6 0a1.5 1.5 0 100 3 1.5 1.5 0 000-3zm-6 5.25a.75.75 0 010-1.5h6a.75.75 0 010 1.5H9z" />
      <path d="M3.75 11.5a.75.75 0 01.75-.75H5v4H4.5a.75.75 0 01-.75-.75v-2.5zM19 10.75h.5a.75.75 0 01.75.75v2.5a.75.75 0 01-.75.75H19v-4z" />
    </svg>
  );
}

function TeamBranchSvg({ agentCount }: { agentCount: number }) {
  const n = Math.max(1, Math.min(5, agentCount));
  const gapPct = (24 / 760) * 100;
  const totalGapPct = (n - 1) * gapPct;
  const cellW = (100 - totalGapPct) / n;
  const legXs = Array.from(
    { length: n },
    (_, i) => i * (cellW + gapPct) + cellW / 2
  );
  const leftX = legXs[0];
  const rightX = legXs[legXs.length - 1];
  const branchY = 32;
  return (
    <svg
      className={s.teamBranchSvg}
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      aria-hidden
    >
      <line
        x1={50} y1={0} x2={50} y2={branchY}
        stroke="currentColor" strokeWidth={1.5}
        vectorEffect="non-scaling-stroke" strokeLinecap="round"
      />
      {n > 1 && (
        <line
          x1={leftX} y1={branchY} x2={rightX} y2={branchY}
          stroke="currentColor" strokeWidth={1.5}
          vectorEffect="non-scaling-stroke" strokeLinecap="round"
        />
      )}
      {legXs.map((x) => (
        <line
          key={x}
          x1={x} y1={branchY} x2={x} y2={100}
          stroke="currentColor" strokeWidth={1.5}
          vectorEffect="non-scaling-stroke" strokeLinecap="round"
        />
      ))}
    </svg>
  );
}
