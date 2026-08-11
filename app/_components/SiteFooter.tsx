import Link from 'next/link';
import s from '../_home/home.module.css';

/**
 * Standard Polynize site footer, carrying the "Humans, amplified" line. Shared
 * so landing pages (e.g. /mapping) match the homepage without duplicating the
 * markup. The homepage still renders its own inline copy today; this is the
 * canonical version new pages should use.
 */

const POLYNIZE_IO = 'https://polynize.io';
const YOUTUBE_CHANNEL = 'https://www.youtube.com/@polynize.agentic';
const LINKEDIN_URL = 'https://www.linkedin.com/company/polynize';
const INSTAGRAM_URL = 'https://www.instagram.com/polynize.ai';
const BOOKING_URL = 'https://calendar.app.google/rw8Vpd7BkJh5wwig9';

export function SiteFooter() {
  return (
    <footer className={s.dcFooter}>
      <div className={s.dcFooterTop}>
        <div>
          <Link className={s.dcWordmark} href="/" style={{ marginBottom: 16 }}>
            <span className={s.dcMark} aria-hidden>
              <img src="/assets/polynize-mark.png" alt="" />
            </span>
            <span>
              polynize
            </span>
          </Link>
          <p className={s.dcFooterBlurb}>
            Humans, amplified. We build the human capability that makes an AI economy work, and the
            agents that amplify it.
          </p>
        </div>
        <div className={s.dcFooterCols}>
          <FootCol
            title="Polynize"
            links={[
              ['polynize.io', POLYNIZE_IO, true],
              ['Map your team', '/mapping', false],
              ['Brand', '/brand', false],
            ]}
          />
          <FootCol
            title="Social"
            links={[
              ['LinkedIn', LINKEDIN_URL, true],
              ['YouTube', YOUTUBE_CHANNEL, true],
              ['Instagram', INSTAGRAM_URL, true],
            ]}
          />
          <FootCol
            title="Contact"
            links={[
              ['hello@polynize.ai', 'mailto:hello@polynize.ai', true],
              ['Talk to our team ↗', BOOKING_URL, true],
            ]}
          />
        </div>
      </div>
      <div className={s.dcFooterBase}>
        <span>© 2026 Polynize Pty Ltd</span>
        <span className={s.dcText3}>Built in Sydney</span>
      </div>
    </footer>
  );
}

function FootCol({ title, links }: { title: string; links: [string, string, boolean][] }) {
  return (
    <div>
      <div className={s.dcFootH}>{title}</div>
      {links.map(([label, href, external]) =>
        external ? (
          <a key={label} className={s.dcFootL} href={href} target="_blank" rel="noopener noreferrer">
            {label}
          </a>
        ) : (
          <Link key={label} className={s.dcFootL} href={href}>
            {label}
          </Link>
        )
      )}
    </div>
  );
}
