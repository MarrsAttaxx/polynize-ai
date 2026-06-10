import type { Metadata } from 'next';
import Link from 'next/link';
import { DraftingGrid } from '@/app/_components/DraftingGrid';
import s from './links.module.css';

export const metadata: Metadata = {
  title: 'links · polynize.ai',
  description:
    'polynize.ai resources. Map your business, run build protocols, talk to our team.',
  openGraph: {
    title: 'links | polynize.ai',
    description:
      'polynize.ai resources. Map your business, run build protocols, talk to our team.',
    url: 'https://polynize.ai/links',
    siteName: 'polynize.ai',
    type: 'website',
  },
  twitter: { card: 'summary' },
};

const MISSION_CONTROL_URL =
  'https://app.polynize.io/#/loop/0f5acd09-8627-479b-9c74-1f044c2e880b/execute?from=%2Fstudio%2Fdesign';
const BOOKING_URL = 'https://calendly.com/marrscoiro/meeting30';

type LinkCard = {
  href: string;
  external?: boolean;
  featured?: boolean;
  tag?: { label: string; mint?: boolean };
  meta?: string;
  title: string;
  desc: string;
  icon: React.ReactNode;
  tail?: string;
};

const GET_STARTED: LinkCard[] = [
  {
    href: '/agents',
    featured: true,
    tag: { label: 'recommended', mint: true },
    meta: '5 min · free',
    title: 'Map your business',
    desc: 'Answer 11 questions. See your heat map. Meet your agent team.',
    icon: (
      <svg viewBox="0 0 24 24">
        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
      </svg>
    ),
    tail: '→',
  },
  {
    href: MISSION_CONTROL_URL,
    external: true,
    featured: true,
    tag: { label: 'protocol' },
    meta: 'studio',
    title: 'Mission control build protocol',
    desc: 'Run the structured build protocol in polynize studio.',
    icon: (
      <svg viewBox="0 0 24 24">
        <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
        <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
      </svg>
    ),
    tail: '↗',
  },
  {
    href: BOOKING_URL,
    external: true,
    tag: { label: 'calendly' },
    meta: '20 min',
    title: 'Book a call with Marrs',
    desc: 'Talk to our co-founder about your agent needs.',
    icon: (
      <svg viewBox="0 0 24 24">
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
      </svg>
    ),
    tail: '↗',
  },
];

const CONNECT: LinkCard[] = [
  {
    href: 'https://www.tiktok.com/@polynize.labs',
    external: true,
    tag: { label: 'tiktok' },
    meta: '@polynize.labs',
    title: 'TikTok',
    desc: 'Behind the scenes at polynize labs.',
    icon: (
      <svg viewBox="0 0 24 24">
        <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1v-3.52a6.37 6.37 0 0 0-.79-.05A6.34 6.34 0 0 0 3.15 15a6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.34-6.34V8.98a8.22 8.22 0 0 0 4.76 1.52V7.05a4.83 4.83 0 0 1-1-0.36z" />
      </svg>
    ),
    tail: '↗',
  },
  {
    href: 'https://www.instagram.com/polynize.labs/',
    external: true,
    tag: { label: 'instagram' },
    meta: '@polynize.labs',
    title: 'Instagram',
    desc: 'Follow polynize labs for updates and insights.',
    icon: (
      <svg viewBox="0 0 24 24">
        <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
        <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
        <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
      </svg>
    ),
    tail: '↗',
  },
  {
    href: 'https://www.youtube.com/@polynize-labs',
    external: true,
    tag: { label: 'youtube' },
    meta: '@polynize-labs',
    title: 'YouTube',
    desc: 'Watch Think Better podcast and agent demos.',
    icon: (
      <svg viewBox="0 0 24 24">
        <path d="M22.54 6.42a2.78 2.78 0 0 0-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 0 0-1.94 2A29 29 0 0 0 1 11.75a29 29 0 0 0 .46 5.33A2.78 2.78 0 0 0 3.4 19.13C5.12 19.56 12 19.56 12 19.56s6.88 0 8.6-.46a2.78 2.78 0 0 0 1.94-2 29 29 0 0 0 .46-5.25 29 29 0 0 0-.46-5.33z" />
        <polygon points="10 15 16 12 10 9 10 15" fill="currentColor" stroke="none" />
      </svg>
    ),
    tail: '↗',
  },
  {
    href: 'https://www.linkedin.com/in/marrscoiro/',
    external: true,
    tag: { label: 'linkedin' },
    meta: 'marrs coiro',
    title: 'LinkedIn',
    desc: 'Connect with Marrs Coiro.',
    icon: (
      <svg viewBox="0 0 24 24">
        <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" />
        <rect x="2" y="9" width="4" height="12" />
        <circle cx="4" cy="4" r="2" />
      </svg>
    ),
    tail: '↗',
  },
  {
    href: 'https://polynize.io',
    external: true,
    tag: { label: 'studio' },
    meta: 'polynize.io',
    title: 'Polynize cognitive studio',
    desc: 'Run thinking protocols and design cognitive systems.',
    icon: (
      <svg viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="10" />
        <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
      </svg>
    ),
    tail: '↗',
  },
];

export default function LinksPage() {
  return (
    <>
    <DraftingGrid />
    <div className={s.page}>
      {/* Terminal chrome */}
      <div className={s.chrome}>
        <div className={s.chromeBar}>
          <span className={`${s.chromeDot} ${s.chromeDotLive}`} />
          <span className={s.chromeDot} />
          <span className={s.chromeDot} />
          <span className={s.chromePath}>~/polynize/links</span>
          <span className={s.chromeRight}>online</span>
        </div>
        <div className={s.hero}>
          <div className={s.heroPrompt}>
            resources<span className={s.heroCursor} />
          </div>
          <h1 className={s.heroTitle}>
            links<span className={s.heroDot}>.</span>
          </h1>
          <p className={s.heroSub}>
            map your business into an agent workforce. run the build protocol. talk to our team.
          </p>
        </div>
      </div>

      {/* Get started */}
      <div className={s.sectionLabel}>
        <span className={s.sectionIdx}>01</span>
        &nbsp;get started
      </div>
      <div className={s.stack}>
        {GET_STARTED.map((c) => (
          <LinkCardItem key={c.href + c.title} card={c} />
        ))}
      </div>

      {/* Connect */}
      <div className={s.sectionLabel}>
        <span className={s.sectionIdx}>02</span>
        &nbsp;connect
      </div>
      <div className={s.stack}>
        {CONNECT.map((c) => (
          <LinkCardItem key={c.href + c.title} card={c} />
        ))}
      </div>

      <div className={s.footer}>
        <div className={s.footerRow}>
          <Link href="/">polynize.ai</Link>
          <a href="https://polynize.io" target="_blank" rel="noopener noreferrer">
            polynize.io
          </a>
          <a href="https://polynize.io/misc/tos.pdf" target="_blank" rel="noopener noreferrer">
            terms
          </a>
        </div>
        <div className={s.footerCopy}>© 2026 polynize pty ltd</div>
      </div>
    </div>
    </>
  );
}

function LinkCardItem({ card }: { card: LinkCard }) {
  const className = `${s.card} ${card.featured ? s.cardFeatured : ''}`;
  const content = (
    <>
      <div className={s.cardGutter}>{card.icon}</div>
      <div className={s.cardBody}>
        <div className={s.cardMeta}>
          {card.tag && (
            <span className={`${s.tag} ${card.tag.mint ? s.tagMint : ''}`}>{card.tag.label}</span>
          )}
          {card.meta && <span>{card.meta}</span>}
        </div>
        <div className={s.cardTitle}>{card.title}</div>
        <div className={s.cardDesc}>{card.desc}</div>
      </div>
      <div className={s.cardTail}>{card.tail ?? '→'}</div>
    </>
  );

  if (card.external) {
    return (
      <a href={card.href} target="_blank" rel="noopener noreferrer" className={className}>
        {content}
      </a>
    );
  }
  return (
    <Link href={card.href} className={className}>
      {content}
    </Link>
  );
}
