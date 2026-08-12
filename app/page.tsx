import Link from 'next/link';
import s from './_home/home.module.css';
import { CapabilityMapPreview } from './_home/CapabilityMapPreview';
import { DraftingGrid } from './_components/DraftingGrid';
import { TrackedLink } from './_components/TrackedLink';

const BOOKING_URL = 'https://calendar.app.google/rw8Vpd7BkJh5wwig9';
const POLYNIZE_IO = 'https://polynize.io';
const YOUTUBE_CHANNEL = 'https://www.youtube.com/@polynize.agentic';
/** Episode 6. Featured because it is the one that explains capability mapping. */
const EP06_URL = 'https://youtu.be/Xq_Hoyx_ccg';
const LINKEDIN_URL = 'https://www.linkedin.com/company/polynize';
const INSTAGRAM_URL = 'https://www.instagram.com/polynize.ai';

// Title + description live in app/layout.tsx (root metadata) so the homepage
// inherits the canonical Polynize meta. No per-page override here.

/**
 * Homepage. Structure and classnames still come from the Direction C port of
 * design_handoff/designs/Homepage_v2.html, but the narrative was rewritten to
 * the polynize.io positioning: "Humans, amplified", capability benchmarked
 * against what good looks like, powered by capability engineering.
 *
 * Every CTA drives /map-your-team (the capability blueprint flow). The old /agents
 * flow is retired behind a redirect in next.config.mjs. The four How steps map
 * one to one onto the blueprint's tabs so the promise matches the artifact.
 */
export default function HomePage() {
  return (
    <>
      <DraftingGrid />
      <div className={s.dirC}>
        <DirCNav />
        <DirCHero />
        {/* The education beat: what capability modelling is, and that mapping
            your bottleneck is step one of it. */}
        <DirCModelling />
        {/* Act 1 — the problem (AJ quote moved up to right after the hero) */}
        <DirCAjQuoteProblem />
        {/* Act 2 — we mapped the business */}
        <DirCMapHero />
        {/* Act 3 — what the map led to: enablement and deployment */}
        <DirCAjTeam />
        {/* Act 4 — the result */}
        <DirCAjQuoteResult />
        {/* How we work and the rest of the page continue from here */}
        <DirCHow />
        {/* The emotional core of the narrative: why we train before we deploy */}
        <DirCValues />
        <DirCFinal />
        <DirCFooter />
      </div>
    </>
  );
}

/* ---------- Nav ---------- */

function DirCNav() {
  return (
    <nav className={s.dcNav}>
      <Link className={s.dcWordmark} href="/">
        <span className={s.dcMark} aria-hidden>
          {/* Drop /public/assets/polynize-mark.gif to upgrade to the
              animated mark; .png is the static fallback shipped today. */}
          <img src="/assets/polynize-mark.png" alt="" />
        </span>
        <span>
          polynize
        </span>
      </Link>
      <TrackedLink
        className={`${s.dcBtn} ${s.dcBtnGhost}`}
        href={BOOKING_URL}
        external
        event="booking_click"
        eventProps={{ surface: 'home_nav' }}
      >
        Talk to our team <span className={s.dcArr}>→</span>
      </TrackedLink>
    </nav>
  );
}

/* ---------- Hero ---------- */

function DirCHero() {
  return (
    <section className={s.dcHero}>
      <h1 className={s.dcH1}>
        Humans,
        <br />
        <span className={s.dcMintEmph}>amplified.</span>
      </h1>
      <p className={s.dcLede}>We build human capability that drives the AI economy.</p>
      {/* No CTA here (Marrs, 12 Aug 2026). The first ask is now the "Experience it for
          yourself" bar further down, after the methodology claim and the founders have
          earned it. The analytics surface `home_hero` retires with it; `home_modelling`
          is the first-touch surface from now on, which matters when reading the funnel. */}
    </section>
  );
}

/* ---------- Capability modelling (the education beat) ---------- */

/**
 * A folded map, line art at a single weight. Drawn rather than imported so it sits in the
 * same vocabulary as the rest of the site's marks: three panels with the fold creases
 * visible, a route across it, and a pin where the route ends.
 */
function MapGlyph() {
  return (
    <span className={s.dcSectionGlyph} aria-hidden="true">
      <svg viewBox="0 0 48 40" width="44" height="37" fill="none">
        <g stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round">
          <path d="M2 9l15-6 14 6 15-6v28l-15 6-14-6-15 6z" />
          <path d="M17 3v28M31 9v28" opacity="0.55" />
          <path d="M9 24c5-6 9 2 14-4s8 1 12-4" strokeDasharray="2.5 3.5" opacity="0.8" />
        </g>
        <circle cx="35" cy="16" r="3" fill="currentColor" />
      </svg>
    </span>
  );
}

function DirCModelling() {
  return (
    /* Tight both ends: it sits between the hero CTA above and the proof below, and all
       three are one argument. */
    <section className={`${s.dcSection} ${s.dcSectionTightTop} ${s.dcSectionTightBottom}`}>
      <div className={s.dcSectionHead}>
        {/* No eyebrow. The map glyph does that job here, and a label reading "our
            methodology" above a heading that already says what the methodology is was
            saying it twice. */}
        <MapGlyph />
        <h2 className={s.dcH2}>
          It starts with
          <br />
          <span className={s.dcMintEmph}>capability mapping.</span>
        </h2>
        <p className={s.dcSectionLede}>
          Before anything gets built, we model the work. Where your capability sits today, what good
          looks like, and the distance between the two.
        </p>
      </div>

      {/* The founders, immediately after the claim. See DirCPodcast for why it lives here
          rather than at the foot of the page. */}
      <DirCPodcast />

      <div className={s.dcMidCta}>
        <div className={s.dcMidCtaText}>
          <div className={s.dcMidCtaTitle}>Experience it for yourself.</div>
          <div className={s.dcMidCtaSub}>
            Tell us where the work slows down and we will map the capabilities inside it.
          </div>
        </div>
        <TrackedLink
          className={`${s.dcBtn} ${s.dcBtnPrimary}`}
          href="/map-your-team"
          event="cta_click"
          eventProps={{ surface: 'home_modelling', label: 'map_team' }}
        >
          Map your team <span className={s.dcArr}>→</span>
        </TrackedLink>
      </div>
    </section>
  );
}

/* ---------- Capability map hero ---------- */

function DirCMapHero() {
  return (
    <section className={s.dcMapHero}>
      <div className={s.dcSectionHead}>
        <div className={s.dcSectionEyebrow}>What you get</div>
        <h2 className={s.dcH2}>
          Your business, mapped
          <br />
          <span className={s.dcMintEmph}>into capabilities.</span>
        </h2>
        <p className={s.dcSectionLede}>
          Every capability inside the work that is holding you back, allocated human, hybrid or agent,
          scored against what good looks like, and sequenced into what to train and what to deploy.
        </p>
      </div>

      <CapabilityMapPreview />

      <div className={s.dcMidCta}>
        <div className={s.dcMidCtaText}>
          <div className={s.dcMidCtaTitle}>Start mapping your team&apos;s capabilities.</div>
          <div className={s.dcMidCtaSub}>
            Eight questions about the work. A blueprint you can share with your team.
          </div>
        </div>
        <TrackedLink
          className={`${s.dcBtn} ${s.dcBtnPrimary}`}
          href="/map-your-team"
          event="map_click"
          eventProps={{ surface: 'home_mid_cta', label: 'map_team' }}
        >
          Map your team <span className={s.dcArr}>→</span>
        </TrackedLink>
      </div>
    </section>
  );
}

/* ---------- Act 1: the problem (AJ quote moved up) ---------- */

const OPTIO_CAPITAL_URL = 'https://www.optio.capital/';

function DirCAjQuoteProblem() {
  return (
    /* Tight top: it follows the methodology CTA bar, and the bar is the end of that
       argument while this is the evidence for it. */
    <section className={`${s.dcSection} ${s.dcSectionTightTop}`}>
      <div className={s.dcSectionHead}>
        <div className={s.dcSectionEyebrow}>Proof</div>
        <h2 className={s.dcH2}>
          A real customer <span className={s.dcMintEmph}>journey.</span>
        </h2>
        <p className={s.dcSectionLede}>
          Optio Capital is a boutique investment advisory. Every deal demanded weeks of groundwork
          before capital could move. We mapped the work into capabilities, benchmarked each one
          against what good looks like, trained the judgment that had to stay with AJ, then built
          the agents around him.
        </p>
      </div>

      <AjQuoteCard
        body={
          <>
            Every investment decision demanded weeks of groundwork before capital deployment was
            even on the table. We knew AI could enhance our diligence and execution, we just
            lacked a clear model for implementation. Polynize turned that ambition into a working
            team.
          </>
        }
      />
    </section>
  );
}

/* ---------- Act 3: AJ's team at Optio Capital ---------- */

/**
 * What the map led to, and it is deliberately TWO things.
 *
 * This section used to be "the team that emerged" and showed only the agents, which told
 * a purely agentic story: map the work, get robots. That is half of what actually
 * happened and the wrong half to lead with for a company whose thesis is human capability
 * (Marrs, 12 Aug 2026). Once the work is mapped, two things follow, and enablement comes
 * first because the sequence is load-bearing: you train people for the work the map says
 * stays theirs, then you build agents around them.
 *
 * The team diagram survives, shrunk to its shape. It is evidence that agents were in fact
 * built, sitting under the half of the story it belongs to, rather than being the story.
 */
const OUTCOMES: { n: string; t: string; d: string; icon: 'lift' | 'team' }[] = [
  {
    n: '01',
    t: 'Capability enablement',
    d: 'Train our staff on the work they actually need to do, now that we know the work.',
    icon: 'lift',
  },
  {
    n: '02',
    t: 'Capability deployment',
    d: 'Build the agentic tech to scale our business.',
    icon: 'team',
  },
];

/**
 * One mark per outcome, drawn as a pair.
 *
 * `lift` is capability rising: four bars getting taller against a baseline, with the
 * benchmark drawn as a dashed line the last bar reaches. That is what enablement does, so
 * the bar chart is the argument rather than decoration.
 *
 * `team` is the org shape the diagram underneath used to draw at full size. Marrs asked
 * for that card to come off entirely and for the shape to become this icon instead
 * (12 Aug 2026), which is the right trade: the section is about two halves of equal
 * weight, and a full team diagram made one of them visually win.
 *
 * Coral is the human node and mint is an agent, same as everywhere else on the site.
 */
function OutcomeIcon({ kind }: { kind: 'lift' | 'team' }) {
  const line = {
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.7,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };
  return (
    <span className={s.dcCardIcon} aria-hidden="true">
      <svg viewBox="0 0 44 34" width="58" height="45" fill="none">
        {kind === 'lift' ? (
          <>
            <path {...line} d="M3 31h38" opacity="0.5" />
            {/* The benchmark. Dashed, because it is a target rather than a measurement. */}
            <path {...line} d="M3 8h38" strokeDasharray="3 4" opacity="0.55" />
            <path {...line} d="M9 31v-7M19 31v-12M29 31v-17M39 31v-23" strokeWidth="3.4" />
          </>
        ) : (
          <>
            {/* The human, then the wiring, then three agents. */}
            <rect
              x="17"
              y="2"
              width="10"
              height="7"
              rx="2"
              fill="none"
              stroke="var(--coral)"
              strokeWidth="1.7"
            />
            <path {...line} d="M22 9v5M5 14h34M5 14v5M22 14v5M39 14v5" opacity="0.6" />
            <rect x="1" y="19" width="9" height="7" rx="2" {...line} />
            <rect x="17.5" y="19" width="9" height="7" rx="2" {...line} />
            <rect x="34" y="19" width="9" height="7" rx="2" {...line} />
          </>
        )}
      </svg>
    </span>
  );
}

function DirCAjTeam() {
  return (
    <section className={s.dcSection}>
      <div className={s.dcSectionHead}>
        <div className={s.dcSectionEyebrow}>What the map led to</div>
        <h2 className={s.dcH2}>
          Two things happened
          <br />
          at <span className={s.dcMintEmph}>Optio Capital.</span>
        </h2>
        <p className={s.dcSectionLede}>
          Mapping the work does not hand you a pile of agents. It tells you which capabilities have
          to stay with your people and get sharper, and which ones can be built and scaled. AJ got
          both, in that order.
        </p>
      </div>

      <div className={`${s.dcHowGrid} ${s.dcSplitGrid}`}>
        {OUTCOMES.map((o) => (
          <div key={o.n} className={s.dcHowCard}>
            <div className={s.dcHowNum}>{o.n}</div>
            <OutcomeIcon kind={o.icon} />
            <div className={s.dcHowTitle}>{o.t}</div>
            <div className={s.dcHowDesc}>{o.d}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ---------- Act 4: the result ---------- */

function DirCAjQuoteResult() {
  return (
    <section className={s.dcSection}>
      <div className={s.dcSectionHead}>
        <div className={s.dcSectionEyebrow}>The result</div>
        <h2 className={s.dcH2}>
          The best day of work
          <br />
          <span className={s.dcMintEmph}>in nine months.</span>
        </h2>
      </div>

      <AjQuoteCard
        body={
          <>
            The first day we worked with our new structure was the best day of work we had in
            nine months.
          </>
        }
      />
    </section>
  );
}

/* ---------- Shared quote card (problem + result variants) ---------- */

function AjQuoteCard({ body }: { body: React.ReactNode }) {
  return (
    <div className={s.dcQuoteCard}>
      <div className={s.dcQuoteStrip} />
      <div className={s.dcQuoteMark}>&ldquo;</div>
      <p className={s.dcQuoteText}>{body}</p>
      <div className={s.dcQuoteAttr}>
        <div className={s.dcQuoteAv}>
          <img src="/assets/aj-milne.jpg" alt="AJ Milne" />
        </div>
        <div>
          <div className={s.dcQuoteName}>AJ Milne</div>
          <div className={s.dcQuoteRole}>
            Partner,{' '}
            <a
              className={s.dcQuoteRoleLink}
              href={OPTIO_CAPITAL_URL}
              target="_blank"
              rel="noopener noreferrer"
            >
              Optio Capital
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------- How we work ---------- */

/**
 * The four steps map one to one onto the tabs of the blueprint the CTA produces
 * (Capability Map, Benchmarks, Transformation, Agentic Design), so the promise
 * on this page matches the artifact the visitor actually receives.
 */
const HOW_STEPS = [
  {
    n: '01',
    t: 'Map',
    icon: 'map' as const,
    d: 'We break the work into the capabilities inside it, and allocate every one of them: human, hybrid, or agent.',
  },
  {
    n: '02',
    t: 'Benchmark',
    icon: 'model' as const,
    d: 'We score each capability as it runs today against what good looks like, so the gap is measured rather than argued about.',
  },
  {
    n: '03',
    t: 'Train',
    icon: 'build' as const,
    d: 'We lift the human capability first. The judgment calls, the direction setting, the work that only your people can do.',
  },
  {
    n: '04',
    t: 'Deploy',
    icon: 'operate' as const,
    d: 'We build the agent team around the trained human, run it alongside you, and tune it as the work shifts.',
  },
];

function DirCHow() {
  return (
    <section className={s.dcSection}>
      <div className={s.dcSectionHead}>
        <div className={s.dcSectionEyebrow}>Powered by capability engineering</div>
        <h2 className={s.dcH2}>
          Map. Benchmark.
          <br />
          Train. <span className={s.dcMintEmph}>Deploy.</span>
        </h2>
        <p className={s.dcSectionLede}>
          Capability engineering came out of five years of R&amp;D across machine learning,
          cognitive science, reinforcement learning and software engineering. It builds the fast
          feedback loops that uplift human and AI performance together.
        </p>
      </div>

      <div className={s.dcHowGrid}>
        {HOW_STEPS.map((step) => (
          <div key={step.n} className={s.dcHowCard}>
            <div className={s.dcHowNum}>{step.n}</div>
            <div className={s.dcHowIcon}>
              <HowIcon kind={step.icon} />
            </div>
            <div className={s.dcHowTitle}>{step.t}</div>
            <div className={s.dcHowDesc}>{step.d}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

function HowIcon({ kind }: { kind: 'map' | 'model' | 'build' | 'operate' }) {
  const props = {
    width: 28,
    height: 28,
    viewBox: '0 0 28 28',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.4,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };
  if (kind === 'map') {
    return (
      <svg {...props}>
        <rect x="3" y="5" width="22" height="18" rx="1" />
        <path d="M3 11h22M3 17h22M11 5v18M19 5v18" />
        <rect x="11" y="11" width="8" height="6" fill="currentColor" opacity=".15" />
      </svg>
    );
  }
  if (kind === 'model') {
    return (
      <svg {...props}>
        <circle cx="14" cy="6" r="2.6" />
        <circle cx="6" cy="21" r="2.6" />
        <circle cx="22" cy="21" r="2.6" />
        <path d="M12.3 8.1 7.7 18.9M15.7 8.1l4.6 10.8M8.6 21h10.8" />
      </svg>
    );
  }
  if (kind === 'build') {
    // Hard hat — brim, dome, centre ridge.
    return (
      <svg {...props}>
        <path d="M3.5 19h21" />
        <path d="M7 19a7 10 0 0 1 14 0" />
        <path d="M14 9v10" />
      </svg>
    );
  }
  // operate (rocket)
  return (
    <svg {...props}>
      <path d="M14 3c3 3 4 9 4 14h-8c0-5 1-11 4-14z" />
      <circle cx="14" cy="10" r="2.2" />
      <path d="M10 14 6 20l4-1.5M18 14l4 6-4-1.5" />
      <path d="M14 20v4" />
    </svg>
  );
}

/* ---------- Values ---------- */

const VALUES = [
  { k: 'Uplift', v: 'People get the opportunity to increase their capabilities.' },
  { k: 'Transparency', v: 'People see their own capability on a level playing field.' },
  { k: 'Augmentation', v: 'People are augmented by AI to achieve more and thrive.' },
];

function DirCValues() {
  return (
    <section className={s.dcSection}>
      <div className={s.dcSectionHead}>
        <div className={s.dcSectionEyebrow}>What we believe</div>
        <h2 className={s.dcH2}>
          We build AI for people.
          <br />
          <span className={s.dcMintEmph}>Not to replace them.</span>
        </h2>
        <p className={s.dcSectionLede}>
          Most AI plans start by asking what can be automated. Ours starts by asking what has to get
          better. The human capability is trained first, and the agents are deployed around it
          second. That order is the whole difference.
        </p>
      </div>

      {/* Reuses the key/value strip from the map frame: a three-up that reads
          differently from the two card grids already on the page. */}
      <div className={s.dcMapMeta}>
        {VALUES.map((val) => (
          <div key={val.k}>
            <div className={s.dcMapMetaK}>{val.k}</div>
            <div className={s.dcMapMetaV}>{val.v}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ---------- Podcast ---------- */

/**
 * The founders on camera, and nothing else.
 *
 * MOVED UP AND STRIPPED (Marrs, 12 Aug 2026). It used to sit near the bottom as a
 * three-episode podcast module with a featured card, titles, runtimes and a side list.
 * Its job now is different and it is placed to do it: faces and authority immediately
 * after the methodology claim, before a visitor has to decide whether to believe us. A
 * side list of other episodes would pull them sideways at exactly the wrong moment, and
 * the thumbnail already carries the title, so the caption underneath was doing nothing.
 *
 * Still a link out to YouTube rather than an embedded player: an iframe would drop
 * third-party cookies on the homepage to save one click.
 */
function DirCPodcast() {
  return (
    <div className={s.dcVideoBlock}>

      <TrackedLink
        className={s.dcVideoSolo}
        href={EP06_URL}
        external
        event="cta_click"
        eventProps={{ surface: 'home_video', label: 'episode_06' }}
        aria-label="Watch How to Map Your Organisation's Capabilities with Polynize on YouTube"
      >
        <div className={s.dcPodThumb}>
          <img
            src="/assets/podcast-ep06.jpg"
            alt="How to Map Your Organisation's Capabilities with Polynize"
            className={s.dcPodThumbImg}
          />
          <div className={s.dcPodPlay} aria-hidden>
            {/* Rounded by stroking the path in its own fill colour with a round join, the
                same trick as the play mark on /capability-mapping, so the two match. */}
            <svg viewBox="0 0 96 96" width="96" height="96">
              <path
                d="M27 20 L73 48 L27 76 Z"
                fill="currentColor"
                stroke="currentColor"
                strokeWidth="10"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <div className={s.dcPodRuntime}>9:21</div>
        </div>
      </TrackedLink>
    </div>
  );
}

/* ---------- Final CTA ---------- */

function DirCFinal() {
  return (
    <section className={s.dcFinal}>
      <div className={s.dcFinalCard}>
        <div className={s.dcFinalStrip} />
        <div className={s.dcSectionEyebrow}>Ready when you are</div>
        <h2 className={s.dcFinalTitle}>
          See the gap between
          <br />
          now and good.
        </h2>
        <p className={s.dcFinalLede}>
          Eight questions about the work that is holding you back. What comes back is every capability
          inside it, mapped, benchmarked, and sequenced into what to train and what to deploy.
        </p>
        <div className={s.dcCtaRow} style={{ justifyContent: 'center' }}>
          <TrackedLink
            className={`${s.dcBtn} ${s.dcBtnPrimary}`}
            href="/map-your-team"
            event="map_click"
            eventProps={{ surface: 'home_final_cta', label: 'map_team' }}
          >
            Map your team <span className={s.dcArr}>→</span>
          </TrackedLink>
        </div>
      </div>
    </section>
  );
}

/* ---------- Footer ---------- */

function DirCFooter() {
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
            The agentic arm of polynize. We build the human capability that makes an AI economy
            work, and the agents that amplify it.
          </p>
        </div>
        <div className={s.dcFooterCols}>
          <FootCol
            title="Polynize"
            links={[
              ['polynize.io', POLYNIZE_IO, true],
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
        <span className={s.dcText3}>Built in Melbourne</span>
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
          <a
            key={label}
            className={s.dcFootL}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
          >
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
