/**
 * SoW toolbar (screen-only chrome above the document): the colour key, the
 * remaining-field counters, and the team-only "Send to client" action.
 *
 * Server component: counts are derived from the SowDoc + the HUMAN_FIELDS
 * ownership, and recompute on the router.refresh() that follows each field
 * save, so the counters update as fields are filled. The send action is a
 * plain mailto link, gated to team scope AND all Polynize fields complete.
 *
 * Hidden in print (see .toolbar in @media print) so the printed agreement is
 * clean.
 */

import { HUMAN_FIELDS } from '@/lib/sow/template';
import type { SowDoc } from '@/lib/sow/schema';
import type { SowViewerScope } from './SowField';
import s from '../sow.module.css';

function isFilled(v: string | null | undefined): boolean {
  return !!(v && v.trim());
}

export function SowToolbar({
  doc,
  scope,
  clientEmail,
  sowUrl,
}: {
  doc: SowDoc;
  scope: SowViewerScope;
  /** Engagement's client email for the mailto to-field (may be empty). */
  clientEmail: string;
  sowUrl: string;
}) {
  const polynizeRemaining = HUMAN_FIELDS.filter(
    (f) => f.owner === 'polynize' && !isFilled(doc.human[f.key])
  ).length;
  const clientRemaining = HUMAN_FIELDS.filter(
    (f) => f.owner === 'client' && !isFilled(doc.human[f.key])
  ).length;

  const isTeam = scope === 'team';
  const isClient = scope === 'client';
  const allPolynizeFilled = polynizeRemaining === 0;

  const subject = 'Your Polynize Statement of Works';
  const body = `Hi,

Your Polynize Statement of Works is ready for review. You can open it here:

${sowUrl}

Please review it, complete the fields marked for you, and sign when you are ready. If you have any questions, just reply to this email.

Thanks,
Polynize`;
  const mailto = `mailto:${clientEmail}?subject=${encodeURIComponent(
    subject
  )}&body=${encodeURIComponent(body)}`;

  return (
    <div className={s.toolbar}>
      <div className={s.legend}>
        <span className={s.legendItem}>
          <span className={`${s.swatch} ${s.swatchMint}`} aria-hidden /> Mint =
          Polynize to complete
        </span>
        <span className={s.legendItem}>
          <span className={`${s.swatch} ${s.swatchOrange}`} aria-hidden /> Orange
          = Client to complete
        </span>
      </div>

      <div className={s.counters}>
        {isTeam && (
          <span className={s.counterMint}>
            Polynize: {polynizeRemaining} field
            {polynizeRemaining === 1 ? '' : 's'} remaining
          </span>
        )}
        {(isTeam || isClient) && (
          <span className={s.counterOrange}>
            Client: {clientRemaining} field
            {clientRemaining === 1 ? '' : 's'} remaining
          </span>
        )}
      </div>

      {isTeam &&
        (allPolynizeFilled ? (
          <a className={s.sendBtn} href={mailto}>
            Send to client →
          </a>
        ) : (
          <span className={s.sendHint}>
            Send to client unlocks once all Polynize fields are complete.
          </span>
        ))}
    </div>
  );
}
