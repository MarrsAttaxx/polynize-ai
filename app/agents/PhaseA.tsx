'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Answers } from '@/lib/types';
import { QUESTIONS, resolveLabel, type Question } from '@/lib/agents/questions';
import s from './phase-a.module.css';

type Props = {
  initial?: Partial<Answers>;
  initialStep?: number;
  onAnswersChange?: (answers: Partial<Answers>, step: number) => void;
  onComplete: (answers: Partial<Answers>) => void;
};

const BLANK: Partial<Answers> = {
  name: '',
  company: '',
  business_description: '',
  role: '',
  bottleneck_full: '',
  ideal_outcome: '',
  work_shape: '',
  volume: '',
  team_size: '',
  context: '',
  urgency: '',
  email: '',
};

const MAX_PROBES = 2;

type Exchange = { user: string; follow_up?: string };

export function PhaseA({ initial, initialStep, onAnswersChange, onComplete }: Props) {
  const [answers, setAnswers] = useState<Partial<Answers>>({ ...BLANK, ...initial });
  const [step, setStep] = useState(initialStep ?? 0);
  const [direction, setDirection] = useState<1 | -1>(1);
  const skipNextNotify = useRef(true);

  // Bottleneck-question state. Reset on mount per step transition.
  const [exchanges, setExchanges] = useState<Exchange[]>([]);
  const [bottleneckDraft, setBottleneckDraft] = useState('');
  const [probing, setProbing] = useState(false);

  const q = QUESTIONS[step];
  const firstName = (answers.name ?? '').trim().split(/\s+/)[0] ?? '';
  const label = resolveLabel(q, firstName);
  const progress = ((step + 1) / QUESTIONS.length) * 100;

  // Reset bottleneck state whenever the step changes onto/off of the bottleneck.
  useEffect(() => {
    if (q.type !== 'bottleneck') {
      setExchanges([]);
      setBottleneckDraft('');
      setProbing(false);
    }
  }, [q.type, step]);

  // Notify parent of state changes (for persistence). Skip first run.
  useEffect(() => {
    if (skipNextNotify.current) {
      skipNextNotify.current = false;
      return;
    }
    onAnswersChange?.(answers, step);
  }, [answers, step, onAnswersChange]);

  const setField = useCallback(<K extends keyof Answers>(key: K, value: Answers[K]) => {
    setAnswers((prev) => ({ ...prev, [key]: value }));
  }, []);

  const advance = useCallback(
    (current: Partial<Answers>) => {
      setDirection(1);
      if (step < QUESTIONS.length - 1) {
        setStep(step + 1);
      } else {
        onComplete(current);
      }
    },
    [step, onComplete]
  );

  const next = useCallback(() => {
    if (q.type === 'bottleneck') return;
    if (!checkCanAdvance(q, answers)) return;
    advance(answers);
  }, [q, answers, advance]);

  const prev = useCallback(() => {
    if (step > 0) {
      setDirection(-1);
      setStep(step - 1);
    }
  }, [step]);

  // Submit a bottleneck answer (initial or follow-up). Hits the probe endpoint
  // and either appends a follow-up exchange or commits + advances.
  const submitBottleneck = useCallback(async () => {
    const trimmed = bottleneckDraft.trim();
    if (!trimmed || probing) return;
    const lastFollowUp = exchanges.length > 0 ? exchanges[exchanges.length - 1].follow_up : undefined;
    // The `newExchange` that used to sit here was dead: both branches of its ternary were
    // identical, and nothing read the result. The follow_up belongs to the PRIOR exchange, per
    // the note below, so this one never carried one either way. lastFollowUp is still used.
    // The follow_up belongs to the PRIOR exchange (it was the question we asked).
    // We model exchanges as the user's reply; the follow_up field on each entry
    // records the probe text shown TO the user before they wrote that reply.
    const nextExchanges: Exchange[] = (() => {
      if (exchanges.length === 0) return [{ user: trimmed }];
      // Attach the new user reply with the follow-up that prompted it.
      const out = [...exchanges];
      out.push({ user: trimmed, follow_up: lastFollowUp });
      return out;
    })();

    const probesUsed = nextExchanges.length - 1; // how many follow-ups we've already shown
    const reachedCap = probesUsed >= MAX_PROBES;

    setProbing(true);
    setExchanges(nextExchanges);
    setBottleneckDraft('');

    let sufficient = true;
    let followUp: string | undefined;

    if (!reachedCap) {
      try {
        const res = await fetch('/api/bottleneck/probe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ exchanges: nextExchanges.map((e) => ({ user: e.user, follow_up: e.follow_up })) }),
        });
        const json = (await res.json().catch(() => ({}))) as { sufficient?: boolean; follow_up?: string };
        sufficient = json.sufficient !== false;
        if (!sufficient && typeof json.follow_up === 'string' && json.follow_up.trim().length > 0) {
          followUp = json.follow_up.trim();
        } else {
          sufficient = true;
        }
      } catch {
        sufficient = true;
      }
    }

    if (sufficient) {
      const fullText = formatBottleneckFull(nextExchanges);
      const updated = { ...answers, bottleneck_full: fullText };
      setAnswers(updated);
      setProbing(false);
      // Small pause so the user sees their last bubble land before transitioning.
      setTimeout(() => advance(updated), 350);
      return;
    }

    // Append the follow-up to the latest exchange so it renders + queues a new textarea.
    setExchanges((prev) => {
      const out = [...prev];
      out[out.length - 1] = { ...out[out.length - 1] };
      // Stash the probe on a synthetic next exchange placeholder via state we already track.
      out.push({ user: '', follow_up: followUp });
      return out;
    });
    setProbing(false);
  }, [bottleneckDraft, probing, exchanges, answers, advance]);

  // Plain Enter advances on chip-style inputs; Cmd/Ctrl+Enter advances in textareas.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key !== 'Enter' || e.shiftKey) return;
      if (q.type === 'bottleneck') {
        if (e.metaKey || e.ctrlKey) {
          e.preventDefault();
          void submitBottleneck();
        }
        return;
      }
      const isTextLike = q.type === 'textarea' || q.type === 'business' || q.type === 'urgency_email';
      if (!isTextLike) {
        e.preventDefault();
        next();
      } else if (e.metaKey || e.ctrlKey) {
        e.preventDefault();
        next();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [q.type, next, submitBottleneck]);

  const cardClass = direction === 1 ? `${s.card} ${s.cardEnter}` : `${s.card} ${s.cardBack}`;

  // Latest probe (if any) sits on the last exchange entry whose `user` is empty.
  const pendingProbe =
    q.type === 'bottleneck' && exchanges.length > 0 && exchanges[exchanges.length - 1].user === ''
      ? exchanges[exchanges.length - 1].follow_up
      : null;
  const renderableExchanges = exchanges.filter((e) => e.user !== '');

  return (
    <div className={s.phaseA}>
      <div className={s.progress}>
        <div className={s.progressFill} style={{ width: `${progress}%` }} />
        <div className={s.progressLabel}>
          {q.tag} · {step + 1} / {QUESTIONS.length}
        </div>
      </div>

      <div className={s.stage}>
        <div key={step} className={cardClass}>
          <div className={s.num}>[{String(step + 1).padStart(2, '0')}]</div>
          <h2 className={s.q}>{label}</h2>
          {q.sub && <p className={s.sub}>{q.sub}</p>}

          {q.type === 'textarea' && (
            <textarea
              className={s.input}
              placeholder={q.placeholder}
              value={(answers[q.id as keyof Answers] as string) ?? ''}
              autoFocus
              onChange={(e) => setField(q.id as keyof Answers, e.target.value as never)}
            />
          )}

          {q.type === 'business' && (
            <div className={s.business}>
              <input
                className={s.input}
                type="text"
                placeholder="your first name"
                value={answers.name ?? ''}
                autoFocus
                onChange={(e) => setField('name', e.target.value)}
              />
              <input
                className={`${s.input} ${s.inputThin}`}
                type="text"
                placeholder="business name"
                value={answers.company ?? ''}
                onChange={(e) => setField('company', e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && checkCanAdvance(q, answers)) {
                    e.preventDefault();
                    next();
                  }
                }}
              />
            </div>
          )}

          {q.type === 'multi' && q.options && (
            <div className={s.multi}>
              {q.options.map((o) => {
                const cur = (answers[q.id as keyof Answers] as string[] | undefined) ?? [];
                const on = cur.includes(o);
                return (
                  <button
                    key={o}
                    type="button"
                    className={`${s.opt} ${on ? s.optOn : ''}`}
                    onClick={() => {
                      const nextVal = on ? cur.filter((x) => x !== o) : [...cur, o];
                      setField(q.id as keyof Answers, nextVal as never);
                    }}
                  >
                    <span className={s.check}>{on ? '●' : '○'}</span>
                    <span>{o}</span>
                  </button>
                );
              })}
            </div>
          )}

          {q.type === 'single' && q.options && (
            <div className={s.single}>
              {q.options.map((o) => (
                <button
                  key={o}
                  type="button"
                  className={`${s.opt} ${answers[q.id as keyof Answers] === o ? s.optOn : ''}`}
                  onClick={() => {
                    const updated = { ...answers, [q.id]: o };
                    setAnswers(updated);
                    setTimeout(() => advance(updated), 260);
                  }}
                >
                  <span className={s.check}>{answers[q.id as keyof Answers] === o ? '●' : '○'}</span>
                  <span>{o}</span>
                </button>
              ))}
            </div>
          )}

          {q.type === 'urgency_email' && q.options && (
            <div className={s.urgencyEmail}>
              <div className={s.single}>
                {q.options.map((o) => (
                  <button
                    key={o}
                    type="button"
                    className={`${s.opt} ${answers.urgency === o ? s.optOn : ''}`}
                    onClick={() => setField('urgency', o)}
                  >
                    <span className={s.check}>{answers.urgency === o ? '●' : '○'}</span>
                    <span>{o}</span>
                  </button>
                ))}
              </div>

              <div className={s.email}>
                <div className={s.sublabel} style={{ marginBottom: 12, marginTop: 24 }}>
                  {q.emailLabel}
                </div>
                <input
                  className={s.input}
                  type="email"
                  placeholder="you@company.com"
                  value={answers.email ?? ''}
                  onChange={(e) => setField('email', e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && checkCanAdvance(q, { ...answers, email: (e.target as HTMLInputElement).value })) {
                      e.preventDefault();
                      next();
                    }
                  }}
                />
                <div className={s.emailPromise}>
                  <span className={s.lock}>▲</span>
                  We won&apos;t share it. You&apos;ll get your report within two minutes.
                </div>
              </div>
            </div>
          )}

          {q.type === 'bottleneck' && (
            <div className={s.bottleneck}>
              {renderableExchanges.length > 0 && (
                <div className={s.exchanges}>
                  {renderableExchanges.map((ex, i) => (
                    <div key={i} className={s.exchangeBlock}>
                      {ex.follow_up && (
                        <div className={s.probeBubble}>
                          <div className={s.probeWho}>POLYNIZE</div>
                          <div className={s.probeText}>{ex.follow_up}</div>
                        </div>
                      )}
                      <div className={s.userBubble}>
                        <div className={s.userText}>{ex.user}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {pendingProbe && (
                <div className={s.probeBubble}>
                  <div className={s.probeWho}>POLYNIZE</div>
                  <div className={s.probeText}>{pendingProbe}</div>
                </div>
              )}

              {probing && (
                <div className={s.probing} aria-live="polite">
                  <span className={s.probingDot} />
                  <span className={s.probingDot} />
                  <span className={s.probingDot} />
                  <span className={s.probingLabel}>thinking</span>
                </div>
              )}

              {!probing && (
                <textarea
                  className={s.input}
                  placeholder={renderableExchanges.length === 0 ? q.placeholder : 'go deeper…'}
                  value={bottleneckDraft}
                  autoFocus
                  onChange={(e) => setBottleneckDraft(e.target.value)}
                />
              )}
            </div>
          )}

          <div className={s.controls}>
            {step > 0 && (
              <button type="button" className={s.back} onClick={prev}>
                ← back
              </button>
            )}
            <div className={s.spacer} />
            {q.type === 'bottleneck' ? (
              <button
                type="button"
                className={s.next}
                disabled={probing || bottleneckDraft.trim().length < 4}
                onClick={() => void submitBottleneck()}
              >
                {probing ? 'thinking…' : renderableExchanges.length === 0 ? 'next →' : 'send →'}
              </button>
            ) : (
              <button
                type="button"
                className={s.next}
                disabled={!checkCanAdvance(q, answers)}
                onClick={next}
              >
                {q.type === 'urgency_email'
                  ? 'send_my_capability_map →'
                  : step === QUESTIONS.length - 1
                    ? 'generate_capability_map →'
                    : 'next →'}
              </button>
            )}
            {(q.type === 'textarea' || q.type === 'bottleneck') && (
              <span className={s.hint}>⌘ + enter</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function checkCanAdvance(q: Question, answers: Partial<Answers>): boolean {
  if (q.type === 'business') {
    return ((answers.name ?? '').trim().length >= 2) && ((answers.company ?? '').trim().length >= 2);
  }
  if (q.type === 'multi') {
    return ((answers[q.id as keyof Answers] as string[] | undefined)?.length ?? 0) > 0;
  }
  if (q.type === 'urgency_email') {
    return Boolean(answers.urgency) && /^\S+@\S+\.\S+$/.test(answers.email ?? '');
  }
  if (q.type === 'textarea') {
    return ((answers[q.id as keyof Answers] as string | undefined) ?? '').trim().length > 3;
  }
  if (q.type === 'bottleneck') {
    return (answers.bottleneck_full ?? '').length > 0;
  }
  return Boolean(answers[q.id as keyof Answers]);
}

function formatBottleneckFull(exchanges: Exchange[]): string {
  return exchanges
    .filter((e) => e.user !== '')
    .map((e) => {
      const probe = e.follow_up ? `[Follow-up: ${e.follow_up}]\n` : '';
      return `${probe}"${e.user.trim()}"`;
    })
    .join('\n\n');
}
