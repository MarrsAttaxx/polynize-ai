import { ClientCard } from './ClientCard';
import type { ClientCardData } from '../_lib/load-clients';
import s from './client-card.module.css';

/**
 * A titled roster section of engagement cards (Client Blueprints / Leads).
 * Extracted from the old combined dashboard so the split Blueprinting and
 * Leads pages render identically.
 */
export function DashSection({
  title,
  count,
  cards,
  actorEmail,
  variant,
}: {
  title: string;
  count: number;
  cards: ClientCardData[];
  actorEmail: string | null;
  variant: 'client' | 'lead';
}) {
  return (
    <section className={s.dashSection}>
      <div className={s.dashSectionHead}>
        <h2 className={s.dashSectionTitle}>{title}</h2>
        <span className={s.dashSectionCount}>{count}</span>
      </div>
      {cards.length === 0 ? (
        <p className={s.dashSectionEmpty}>None yet.</p>
      ) : (
        <div className={s.grid}>
          {cards.map((c) => (
            <ClientCard
              key={c.slug}
              data={c}
              actorEmail={actorEmail}
              variant={variant}
            />
          ))}
        </div>
      )}
    </section>
  );
}
