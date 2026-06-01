import { computeReadiness, type ParsedBlueprint } from '@/app/console/_lib/parse-blueprint';
import s from './blueprint-sections.module.css';

type Props = {
  blueprint: ParsedBlueprint;
  gapsOpen: number;
  gapsBlocking: number;
  phase: string;
  subPhase: string;
  gateNext: string;
  agentCount: number;
  unitCount: number;
  blueprintVersion: string;
  /**
   * Optional display label for the Phase cell. The `phase` prop always
   * drives the readiness CALCULATION (it must be a token computeReadiness
   * understands: marketing/mapping/modelling/build/operate). When the
   * caller's real phase vocabulary differs (e.g. the 2.0 "building"),
   * pass the human label here for display while `phase` carries the
   * mapped calculation token. Legacy callers omit this and the label is
   * derived from `phase` exactly as before.
   */
  phaseLabel?: string;
};

export function ReadinessStrip(props: Props) {
  const completionPercent = computeReadiness({
    blueprint: props.blueprint,
    phase: props.phase,
    subPhase: props.subPhase,
    blockingGapsCount: props.gapsBlocking,
  });

  // Ring geometry
  const size = 80;
  const stroke = 6;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - completionPercent / 100);

  const phaseLabel =
    props.phaseLabel ??
    (props.phase
      ? props.phase.charAt(0).toUpperCase() + props.phase.slice(1)
      : '—');

  return (
    <div className={s.readinessStrip}>
      <div className={`${s.readinessCell} ${s.readinessCellWide}`}>
        <div className={s.cellLabel}>Readiness</div>
        <div className={s.readinessBody}>
          <div className={s.readinessRingWrap}>
            <svg
              viewBox={`0 0 ${size} ${size}`}
              className={s.readinessRing}
              width={size}
              height={size}
              aria-hidden
            >
              <circle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke="rgba(255,255,255,0.06)"
                strokeWidth={stroke}
              />
              <circle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke="var(--bp-mint)"
                strokeWidth={stroke}
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={dashOffset}
                transform={`rotate(-90 ${size / 2} ${size / 2})`}
              />
            </svg>
            <div className={s.readinessPercent}>{completionPercent}%</div>
          </div>
          <div className={s.readinessSubtext}>
            {props.gapsOpen} gap{props.gapsOpen === 1 ? '' : 's'} open · {props.gapsBlocking} blocking sign-off
          </div>
        </div>
      </div>

      <div className={s.readinessCell}>
        <div className={s.cellLabel}>Phase</div>
        <div className={s.cellValue}>{phaseLabel}</div>
        <div className={s.cellSub}>
          {props.subPhase && props.gateNext
            ? `${props.subPhase} → ${props.gateNext}`
            : props.subPhase || props.gateNext || ''}
        </div>
      </div>

      <div className={s.readinessCell}>
        <div className={s.cellLabel}>Team</div>
        <div className={s.cellValue}>
          {props.agentCount} agent{props.agentCount === 1 ? '' : 's'}
        </div>
        <div className={s.cellSub}>
          {props.unitCount} unit{props.unitCount === 1 ? '' : 's'}
        </div>
      </div>

      <div className={s.readinessCell}>
        <div className={s.cellLabel}>Blueprint</div>
        <div className={s.cellValue}>{props.blueprintVersion}</div>
        <div className={s.cellSub}>Auto-generated</div>
      </div>
    </div>
  );
}
