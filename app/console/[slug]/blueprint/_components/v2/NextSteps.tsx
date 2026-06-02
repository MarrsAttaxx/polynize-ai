/**
 * Next Steps (motions) renderer (spec §9.9).
 *
 * Three motion blocks (Agent Deploy / Training / Transform). Each:
 *   - motion label + accent (top border)
 *   - description
 *   - "Covers: rows 01, 03, 07 ..." referencing capability ids, each a
 *     link to #cap-<id> so it scrolls to / highlights that row in the
 *     capability map above.
 *
 * Motion accent (amber / teal / white) mapped to the Console palette.
 */

import type { EngagementModel, Motion } from '@/lib/blueprint/load-v2';
import { EditableText } from './EditableText';
import s from './v2-sections.module.css';

const ACCENT_VAR: Record<Motion['accent'], string> = {
  amber: 'var(--bp-amber)',
  teal: 'var(--bp-mint)',
  white: 'var(--bp-electric)',
};

export function NextSteps({
  model,
  slug,
  canEdit,
  locked,
}: {
  model: EngagementModel;
  slug: string;
  canEdit: boolean;
  locked: boolean;
}) {
  if (model.motions.length === 0) {
    return (
      <p className={s.placeholder}>No motions defined for this engagement yet.</p>
    );
  }

  // Display order: Training, Transform, Agent Deploy — left-to-right mirror
  // of the capability map's Human → Hybrid → Agentic logic (Training =
  // People/Human, Transform = Process/Hybrid, Agent Deploy = AI/Agentic).
  // Display only — the underlying motion data and row references are unchanged.
  const DISPLAY_ORDER: Record<string, number> = {
    training: 0,
    transform: 1,
    agent_deploy: 2,
  };
  const motions = [...model.motions].sort(
    (a, b) => (DISPLAY_ORDER[a.id] ?? 99) - (DISPLAY_ORDER[b.id] ?? 99)
  );

  return (
    <div className={s.motionGrid}>
      {motions.map((motion) => (
        <div
          key={motion.id}
          className={s.motionCard}
          style={
            { '--motion-accent': ACCENT_VAR[motion.accent] } as React.CSSProperties
          }
        >
          <h3 className={s.motionLabel}>{motion.label}</h3>
          <p className={s.motionDesc}>
            <EditableText
              value={motion.description}
              endpoint={`/api/console/${slug}/motion/${motion.id}`}
              bodyKey="description"
              canEdit={canEdit}
              locked={locked}
              emptyDash={false}
              placeholder="Describe what this motion delivers…"
            />
          </p>
          <CoversLine motion={motion} />
        </div>
      ))}
    </div>
  );
}

function CoversLine({ motion }: { motion: Motion }) {
  const { capability_ids, cluster_ids, cross_cutting } = motion.covers;
  const parts: React.ReactNode[] = [];

  if (capability_ids.length > 0) {
    parts.push(
      <span key="caps">
        rows{' '}
        {capability_ids.map((id, i) => (
          <span key={id}>
            <a href={`#cap-${id}`} className={s.motionCoversLink}>
              {id}
            </a>
            {i < capability_ids.length - 1 ? ', ' : ''}
          </span>
        ))}
      </span>
    );
  }
  if (cluster_ids.length > 0) {
    parts.push(<span key="clusters">clusters {cluster_ids.join(', ')}</span>);
  }
  if (cross_cutting.length > 0) {
    parts.push(<span key="cross">{cross_cutting.join(', ')}</span>);
  }

  if (parts.length === 0) return null;

  return (
    <div className={s.motionCovers}>
      Covers:{' '}
      {parts.map((p, i) => (
        <span key={i}>
          {p}
          {i < parts.length - 1 ? ' · ' : ''}
        </span>
      ))}
    </div>
  );
}
