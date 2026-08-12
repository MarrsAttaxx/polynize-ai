import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/console-auth';
import s from './_components/client-card.module.css';
import l from './_components/launcher.module.css';

export const dynamic = 'force-dynamic';

/**
 * PAM Control Centre — the launcher. TWO doors, equal weight: Marketing and Leads.
 *
 * Marrs: "just make it 'Marketing' and 'Leads' the same size and the same weight, just
 * two big buttons." That is the whole console now — a marketing engine and a CRM. So
 * neither is featured over the other, and nothing else competes with them.
 *
 * The STUDIO used to be here and is not any more, on his call: it lives beside Calendar
 * on the marketing dashboard, "near the Calendar button is enough". BLUEPRINTING is also
 * gone from the launcher, but the ROUTE AND ITS CODE STAY, deliberately: "we can keep the
 * capability in the background in case something changes". /console/blueprinting still
 * resolves for anyone who has the link; it is just no longer a front door.
 *
 * Client-scoped users never see this; they are sent straight to their own Blueprint.
 */
const SECTIONS = [
  {
    href: '/console/marketing',
    eyebrow: 'Make',
    title: 'Marketing',
    desc: 'Concepts, content and the calendar. Every stream, from idea to posted.',
  },
  {
    href: '/console/leads',
    eyebrow: 'Sell',
    title: 'Leads',
    desc: 'The CRM. Inbound from polynize.ai, and every contact each of us is working.',
  },
];

export default async function ConsoleHome() {
  const user = await getCurrentUser();

  // Client-scoped users land directly on their own Blueprint. The layout's
  // auth gate already handles the !user case (renders SignInGate).
  if (user && user.scope.type === 'client') {
    redirect(`/console/${user.scope.slug}/blueprint`);
  }

  return (
    <>
      <div className={s.bgPattern} aria-hidden />
      <div className={s.dashboard}>
        <div className={s.header}>
          <div className={s.eyebrow}>polynize agentic management console</div>
          <h1 className={s.title}>PAM Control Centre</h1>
        </div>

        <div className={l.cards}>
          {SECTIONS.map((sec) => (
            <Link key={sec.href} href={sec.href} className={`${l.card} ${l.cardDoor}`}>
              <span className={l.cardEyebrow}>{sec.eyebrow}</span>
              <span className={l.cardTitle}>{sec.title}</span>
              <span className={l.cardDesc}>{sec.desc}</span>
              <span className={l.cardArrow} aria-hidden>
                →
              </span>
            </Link>
          ))}
        </div>
      </div>
    </>
  );
}
