import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/console-auth';
import { countByOwner, listAllContacts, type CrmContact } from '@/lib/crm/contact-store';
import { STREAMS, STREAM_AVATARS, streamLabel } from '@/lib/marketing/streams';
import s from '../_components/client-card.module.css';
import l from '../_components/launcher.module.css';
import c from './crm.module.css';

export const dynamic = 'force-dynamic';

/**
 * THE CRM — one card per person, exactly like the Marketing dashboard.
 *
 * Marrs: "The idea is similar to the one we have inside of Marketing, where we have a
 * dashboard with Polynize, Marrs, Shourov, Kristin and Julian."
 *
 * So it reuses the SAME STREAMS list rather than declaring its own five names. If a
 * person is added or renamed, both dashboards move together instead of drifting apart
 * until somebody notices.
 *
 * POLYNIZE IS THE INBOUND ONE. Website blueprint-form leads land in it automatically
 * (lib/leads.ts sets owner='polynize'), which is why its card says so: the others fill up
 * because someone put a contact in, that one fills up on its own.
 *
 * Team-visible, per Marrs's call, so everybody can open everybody's CRM. There is no
 * per-person hiding here yet; that arrives with the D28 permissions layer.
 */
export default async function LeadsPage() {
  const user = await getCurrentUser();
  if (!user) return null;
  if (user.scope.type === 'client') {
    redirect(`/console/${user.scope.slug}/blueprint`);
  }

  let contacts: CrmContact[] = [];
  let loadError: string | null = null;
  try {
    contacts = await listAllContacts();
  } catch (err) {
    // Shown, not swallowed. An empty CRM and a broken CRM look identical, and telling
    // someone they have no contacts when they have forty is the worse failure.
    console.error('[crm.dashboard] load failed:', err);
    loadError = 'Could not load contacts. The counts below are not real.';
  }

  const counts = countByOwner(contacts);
  const total = contacts.length;
  const due = contacts.filter(
    (x) => x.next_action_at && new Date(x.next_action_at).getTime() <= Date.now()
  ).length;

  return (
    <>
      <div className={s.bgPattern} aria-hidden />
      <div className={s.dashboard}>
        <div className={s.header}>
          <Link href="/console" className={s.marketingBack}>
            ← Console
          </Link>
          <div className={s.eyebrow}>crm</div>
          <h1 className={s.title}>Leads</h1>
          <p className={c.subhead}>
            {total === 0
              ? 'No contacts yet. Open a CRM and add one, or wait for the website to send one in.'
              : `${total} contact${total === 1 ? '' : 's'}${due > 0 ? ` · ${due} due or overdue` : ''}`}
          </p>
        </div>

        {loadError ? <p className={c.error}>{loadError}</p> : null}

        <div className={l.cards}>
          {STREAMS.map((st) => {
            const n = counts.get(st.id) ?? { total: 0, open: 0, new_count: 0, won: 0 };
            const avatar = STREAM_AVATARS[st.id];
            const inbound = st.id === 'polynize';
            return (
              <Link
                key={st.id}
                href={`/console/leads/${st.id}`}
                className={`${l.card} ${s.hasAvatar}`}
              >
                <span className={l.cardEyebrow}>
                  {n.total === 0
                    ? inbound
                      ? 'inbound · nothing yet'
                      : 'no contacts yet'
                    : `${n.open} open · ${n.total} total`}
                </span>
                <span className={l.cardTitle}>{streamLabel(st.id)}</span>
                <span className={l.cardDesc}>
                  {inbound
                    ? 'Everyone who fills in the form on polynize.ai lands here.'
                    : `${streamLabel(st.id)}'s own contacts and follow-ups.`}
                </span>
                {n.new_count > 0 ? (
                  <span className={c.newFlag}>
                    {n.new_count} new, untouched
                  </span>
                ) : null}
                {avatar ? (
                  <div className={s.streamAvatar}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img className={s.streamAvatarImg} src={avatar} alt="" />
                  </div>
                ) : null}
              </Link>
            );
          })}
        </div>
      </div>
    </>
  );
}
