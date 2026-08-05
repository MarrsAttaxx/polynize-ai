import { SiloGlyph, type SiloIcon } from './_icons';
import s from './mapping.module.css';

/**
 * The problem section says it in words: "People over here, processes over there,
 * technology somewhere else... Everyone holds one piece." This draws exactly that
 * and nothing more.
 *
 * Deliberately NOT grid-shaped. A grid on this page reads as the capability matrix,
 * and a hand-drawn stand-in for the real product was already rejected once. Three
 * separated panels with broken connectors carry the idea without impersonating the
 * thing the page is selling.
 */

export type Silo = { kind: SiloIcon; label: string; note: string };

export function SiloDiagram({ items }: { items: Silo[] }) {
  return (
    <div className={s.silos} role="group" aria-label="People, processes and technology held separately">
      {items.map((it) => (
        /* The dashed connector between panels is drawn by .siloCell::after in CSS,
           so it never competes for layout width and stays equal-column. */
        <div className={s.siloCell} key={it.label}>
          <div className={s.silo}>
            <span className={s.siloIcon}>
              <SiloGlyph kind={it.kind} />
            </span>
            <div className={s.siloLabel}>{it.label}</div>
            <div className={s.siloNote}>{it.note}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
