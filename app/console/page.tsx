import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/console-auth';
import s from './_components/client-card.module.css';
import l from './_components/launcher.module.css';

export const dynamic = 'force-dynamic';

/**
 * PAM Control Centre — the launcher. Three section cards route to the
 * Marketing engine (the console's new primary), the website Leads funnel,
 * and the (legacy, EverStock-only) Blueprinting roster. Client-scoped users
 * never see this; they are sent straight to their own Blueprint.
 */
const SECTIONS = [
  {
    href: '/console/marketing',
    eyebrow: 'Primary · new',
    title: 'Marketing',
    desc: 'The marketing engine. Content, campaigns, and channels — the new core of the console.',
    featured: true,
  },
  {
    href: '/console/leads',
    eyebrow: 'Inbound',
    title: 'Leads',
    desc: 'Lead generation from the polynize.ai funnel. Prospects mapped and ready to work.',
    featured: false,
  },
  {
    href: '/console/blueprinting',
    eyebrow: 'Delivery',
    title: 'Blueprinting',
    desc: 'Client capability blueprints and Statements of Work.',
    featured: false,
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
            <Link
              key={sec.href}
              href={sec.href}
              className={`${l.card} ${sec.featured ? l.cardFeatured : ''}`}
            >
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
