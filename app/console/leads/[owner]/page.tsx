import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/console-auth';
import { listContacts, type CrmContact } from '@/lib/crm/contact-store';
import { getNotifyMap, type NotifyMap } from '@/lib/crm/notify-store';
import { CRM_STAGES, isCrmStage, isDue, sortForWork } from '@/lib/crm/model';
import { STREAMS, streamLabel } from '@/lib/marketing/streams';
import { AddContact, AddOwner, ContactRow, FirefliesReview } from '../CrmClient';
import s from '../../_components/client-card.module.css';
import c from '../crm.module.css';

export const dynamic = 'force-dynamic';

/**
 * One person's CRM.
 *
 * SORTED BY WHAT IS DUE, not alphabetically and not by stage. A CRM's only real question
 * is "who am I chasing today", so a dated follow-up outranks an undated one and the
 * undated remainder falls back to newest first. See sortForWork.
 *
 * A KANBAN WAS THE OBVIOUS CHOICE AND IS NOT THIS. Columns look like a pipeline but they
 * hide the date, which is the field that actually tells you to act, and they collapse
 * badly on a phone. The stage is a control on each row instead, and the stage filter at
 * the top does the job of looking at one column.
 */
export default async function OwnerCrmPage({
  params,
  searchParams,
}: {
  params: Promise<{ owner: string }>;
  searchParams: Promise<{ stage?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) return null;
  if (user.scope.type === 'client') {
    redirect(`/console/${user.scope.slug}/blueprint`);
  }

  const { owner } = await params;
  // Only a real stream is a CRM, so a typed url cannot open an empty sixth one that
  // silently accepts contacts nothing else will ever show.
  if (!STREAMS.some((st) => st.id === owner)) notFound();

  const { stage: stageParam } = await searchParams;
  const filter = isCrmStage(stageParam) ? stageParam : null;

  let contacts: CrmContact[] = [];
  let loadError: string | null = null;
  try {
    contacts = await listContacts(owner);
  } catch (err) {
    console.error('[crm.owner] load failed:', err);
    loadError = 'Could not load this CRM. Nothing below is real.';
  }

  // Separately, and tolerant of its own failure: not knowing the notify list must not stop
  // the contacts rendering.
  const notify =
    (await getNotifyMap().catch((): NotifyMap => ({})))[owner] ?? [];

  const shown = sortForWork(filter ? contacts.filter((x) => x.stage === filter) : contacts);
  const perStage = new Map<string, number>();
  for (const x of contacts) perStage.set(x.stage, (perStage.get(x.stage) ?? 0) + 1);
  const dueCount = contacts.filter((x) => isDue(x)).length;
  const inbound = owner === 'polynize';

  return (
    <>
      <div className={s.bgPattern} aria-hidden />
      <div className={s.dashboard}>
        <div className={s.header}>
          <Link href="/console/leads" className={s.marketingBack}>
            ← Leads
          </Link>
          <div className={c.headRow}>
            <div>
              <div className={s.eyebrow}>crm</div>
              <h1 className={s.title}>{streamLabel(owner)}</h1>
            </div>
            {inbound ? <AddOwner owner={owner} recipients={notify} /> : null}
          </div>
          <p className={c.subhead}>
            {contacts.length === 0
              ? inbound
                ? 'Nothing has come in from the website yet.'
                : 'No contacts yet.'
              : `${contacts.length} contact${contacts.length === 1 ? '' : 's'}${
                  dueCount > 0 ? ` · ${dueCount} due or overdue` : ''
                }`}
          </p>
        </div>

        {loadError ? <p className={c.error}>{loadError}</p> : null}

        <div className={c.toolbar}>
          <AddContact owner={owner} />
          {/* Meetings become contacts, by review. On every CRM, since each person's meetings
              belong in their own. */}
          <FirefliesReview owner={owner} />
        </div>

        {contacts.length > 0 ? (
          <div className={c.filters}>
            <Link
              href={`/console/leads/${owner}`}
              className={filter === null ? c.filterOn : c.filter}
            >
              All {contacts.length}
            </Link>
            {CRM_STAGES.map((st) => {
              const n = perStage.get(st.id) ?? 0;
              // A stage with nobody in it is not a useful filter, so it is not offered.
              if (n === 0) return null;
              return (
                <Link
                  key={st.id}
                  href={`/console/leads/${owner}?stage=${st.id}`}
                  className={filter === st.id ? c.filterOn : c.filter}
                  title={st.hint}
                >
                  {st.label} {n}
                </Link>
              );
            })}
          </div>
        ) : null}

        {contacts.length === 0 && !loadError ? (
          <p className={c.empty}>
            {inbound ? (
              <>
                This CRM fills itself. Everyone who completes the form on polynize.ai lands
                here as a <strong>New</strong> contact, with the blueprint they generated
                attached. You can also add someone by hand above.
              </>
            ) : (
              <>
                Add a contact above and it appears here. Set a{' '}
                <strong>next action and a date</strong> on anyone you are chasing: this list
                sorts by what is due, so dated rows come first and overdue ones are flagged.
              </>
            )}
          </p>
        ) : null}

        <div className={c.rows}>
          {shown.map((contact) => (
            <ContactRow key={contact.id} contact={contact} />
          ))}
        </div>

        {contacts.length > 0 && shown.length === 0 ? (
          <p className={c.empty}>Nobody is at that stage right now.</p>
        ) : null}
      </div>
    </>
  );
}
