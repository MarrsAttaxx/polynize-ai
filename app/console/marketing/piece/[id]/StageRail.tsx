/**
 * The short-form video production spine, as a compact rail across the top of a
 * piece. Shows every middle-module stage in order, highlights the current one,
 * links the built stages, and marks the rest "soon". Presentational only.
 */

import { Fragment } from 'react';
import Link from 'next/link';
import { SHORT_FORM_STAGES, type StageRole } from '@/lib/marketing/stages';
import s from './stage-rail.module.css';

const roleClass: Record<StageRole, string> = {
  human: s.roleHuman,
  hybrid: s.roleHybrid,
  agent: s.roleAgent,
};

/**
 * The short-form production spine, drawn as a FLOW (item 6): the stages sit
 * inside one bordered track under a "Production flow" label, joined by chevrons
 * so it reads as a process rather than a menu of buttons. Current stage is
 * highlighted; built stages link; the rest are marked "soon".
 */
export function StageRail({ pieceId, current }: { pieceId: string; current: string }) {
  return (
    <div className={s.railWrap}>
      <span className={s.railTitle}>Production flow</span>
      <nav className={s.rail} aria-label="Production stages">
        {SHORT_FORM_STAGES.map((st, i) => {
          const isCurrent = st.id === current;
          const inner = (
            <span
              className={`${s.stage} ${isCurrent ? s.current : ''} ${
                st.built ? '' : s.planned
              }`}
            >
              <span className={`${s.dot} ${roleClass[st.role]}`} aria-hidden />
              {st.label}
              {st.built ? null : <span className={s.soon}>soon</span>}
            </span>
          );
          const linked = st.built && st.href && !isCurrent;
          return (
            <Fragment key={st.id}>
              {i > 0 ? (
                <span className={s.sep} aria-hidden>
                  ›
                </span>
              ) : null}
              <span className={s.item}>
                {linked ? (
                  <Link href={st.href!(pieceId)} className={s.link}>
                    {inner}
                  </Link>
                ) : (
                  inner
                )}
              </span>
            </Fragment>
          );
        })}
      </nav>
    </div>
  );
}
