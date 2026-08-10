import Link from 'next/link';
import s from './_home/home.module.css';
import { CapabilityMapPreview } from './_home/CapabilityMapPreview';
import { AjTeamDiagram } from './_components/AjTeamDiagram';
import { DraftingGrid } from './_components/DraftingGrid';
import { TrackedLink } from './_components/TrackedLink';

const BOOKING_URL = 'https://calendar.app.google/rw8Vpd7BkJh5wwig9';
const POLYNIZE_IO = 'https://polynize.io';
const YOUTUBE_CHANNEL = 'https://www.youtube.com/@polynize.agentic';
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
 * Every CTA drives /blueprint (the capability blueprint flow). The old /agents
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
        {/* Act 3 — the team that emerges */}
        <DirCAjTeam />
        {/* Act 4 — the result */}
        <DirCAjQuoteResult />
        {/* How we work and the rest of the page continue from here */}
        <DirCHow />
        {/* The emotional core of the narrative: why we train before we deploy */}
        <DirCValues />
        <DirCPodcast />
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
        Talk to the Team <span className={s.dcArr}>→</span>
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
      <p className={s.dcLede}>
        We build the human capability that makes an AI economy work.
      </p>

      <div className={s.dcCtaRow}>
        <TrackedLink
          className={`${s.dcBtn} ${s.dcBtnPrimary}`}
          href="/blueprint"
          event="cta_click"
          eventProps={{ surface: 'home_hero', label: 'map_bottleneck' }}
        >
          Map your bottleneck <span className={s.dcArr}>→</span>
        </TrackedLink>
        <TrackedLink
          className={`${s.dcBtn} ${s.dcBtnSecondary}`}
          href={BOOKING_URL}
          external
          event="booking_click"
          eventProps={{ surface: 'home_hero' }}
        >
          Talk to the Team
        </TrackedLink>
      </div>
    </section>
  );
}

/* ---------- Capability modelling (the education beat) ---------- */

/**
 * The first phase of the Polynize Capability Methodology. Modelling comes before
 * enablement and deployment, and step 01 is exactly what the CTA below performs,
 * which is why the first card is marked as the visitor's starting point.
 */
const MODEL_STEPS = [
  {
    n: '01',
    state: 'Current state',
    t: 'Map capabilities',
    d: 'We break the work into the capabilities inside it, and allocate every one of them: human, hybrid, or agent.',
    here: true,
  },
  {
    n: '02',
    state: 'Future state',
    t: 'Set the benchmark',
    d: 'We define what good looks like for each capability, measured in the flow of work rather than in a workshop.',
  },
  {
    n: '03',
    state: 'The distance',
    t: 'Find the gap',
    d: 'The measured distance between the two. That gap is the thing everything afterwards is built to close.',
  },
];

function DirCModelling() {
  return (
    <section className={s.dcSection}>
      <div className={s.dcSectionHead}>
        <div className={s.dcSectionEyebrow}>Our methodology</div>
        <h2 className={s.dcH2}>
          It starts with
          <br />
          <span className={s.dcMintEmph}>capability modelling.</span>
        </h2>
        <p className={s.dcSectionLede}>
          Before anything gets built, we model the work. Where your capability sits today, what good
          looks like, and the distance between the two. Only then does it make sense to talk about
          training people or deploying agents, because both are built to close that distance.
        </p>
      </div>

      <div className={`${s.dcHowGrid} ${s.dcHowGrid3}`}>
        {MODEL_STEPS.map((step) => (
          <div
            key={step.n}
            className={`${s.dcHowCard} ${step.here ? s.dcHowCardHere : ''}`}
          >
            <div className={s.dcHowNum}>
              {step.n} · {step.state}
            </div>
            <div className={s.dcHowTitle}>{step.t}</div>
            <div className={s.dcHowDesc}>{step.d}</div>
            {step.here && (
              <div className={s.dcHereTag}>
                <span className={s.dcHereDot} aria-hidden />
                You are here
              </div>
            )}
          </div>
        ))}
      </div>

      <div className={s.dcMidCta}>
        <div className={s.dcMidCtaText}>
          <div className={s.dcMidCtaTitle}>Start with step one.</div>
          <div className={s.dcMidCtaSub}>
            Tell us where the work slows down and we will map the capabilities inside it.
          </div>
        </div>
        <TrackedLink
          className={`${s.dcBtn} ${s.dcBtnPrimary}`}
          href="/blueprint"
          event="cta_click"
          eventProps={{ surface: 'home_modelling', label: 'map_bottleneck' }}
        >
          Map your bottleneck <span className={s.dcArr}>→</span>
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
          <div className={s.dcMidCtaTitle}>Get your capability blueprint.</div>
          <div className={s.dcMidCtaSub}>
            Eight questions about the work. A blueprint you can share with your team.
          </div>
        </div>
        <TrackedLink
          className={`${s.dcBtn} ${s.dcBtnPrimary}`}
          href="/blueprint"
          event="cta_click"
          eventProps={{ surface: 'home_mid_cta', label: 'map_bottleneck' }}
        >
          Map your bottleneck <span className={s.dcArr}>→</span>
        </TrackedLink>
      </div>
    </section>
  );
}

/* ---------- Act 1: the problem (AJ quote moved up) ---------- */

const OPTIO_CAPITAL_URL = 'https://www.optio.capital/';

function DirCAjQuoteProblem() {
  return (
    <section className={s.dcSection}>
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

function DirCAjTeam() {
  return (
    <section className={s.dcSection}>
      <div className={s.dcSectionHead}>
        <div className={s.dcSectionEyebrow}>The team that emerged</div>
        <h2 className={s.dcH2}>
          AJ&apos;s team
          <br />
          at <span className={s.dcMintEmph}>Optio Capital.</span>
        </h2>
        <p className={s.dcSectionLede}>
          One human at the centre, amplified. AJ still owns every judgment call that matters. The
          agents carry the groundwork around him so his attention lands where it counts.
        </p>
      </div>

      <div className={s.ajWrap}>
        <AjTeamDiagram caption="AJ's team at Optio Capital" />
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
            The first day I worked with our agent team was the best day of work I had in nine
            months.
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

function DirCPodcast() {
  return (
    <section className={s.dcSection}>
      <div className={s.dcSectionHead}>
        <div className={s.dcSectionEyebrow}>From the founders</div>
        <h2 className={s.dcH2}>
          Think Better.
          <br />
          <span className={s.dcText3}>Marrs Coiro &amp; Shourov Bhattacharya, weekly.</span>
        </h2>
      </div>

      <div className={s.dcPodGrid}>
        <TrackedLink
          className={s.dcPodFeat}
          href={YOUTUBE_CHANNEL}
          external
          event="cta_click"
          eventProps={{ surface: 'home_podcast', label: 'youtube_channel' }}
          aria-label="Watch Think Better Podcast Episode 5 on YouTube"
        >
          <div className={s.dcPodThumb}>
            <img
              src="/assets/podcast-thumbnail.jpg"
              alt="The Future of Agentic AI · Think Better Podcast Ep05"
              className={s.dcPodThumbImg}
            />
            <div className={s.dcPodPlay} aria-hidden>
              <svg viewBox="0 0 24 24" width="22" height="22">
                <path d="M8 5v14l11-7z" fill="currentColor" />
              </svg>
            </div>
            <div className={s.dcPodRuntime}>44:49</div>
          </div>
          <div className={s.dcPodMeta}>
            <div className={s.dcPodTag}>Latest episode 5</div>
            <div className={s.dcPodTitle}>Why Your First Agent Changes Everything</div>
            <div className={s.dcPodDesc}>
              Marrs and Shourov go deep on the cognitive layer, the thinking framework that gets
              installed into an agent.
            </div>
          </div>
        </TrackedLink>

        <div className={s.dcPodSide}>
          <PodMini ep="04" run="1:09:30" t="The Missing Layer Between Your Brain and AI" />
          <PodMini ep="03" run="1:03:55" t="The Only Thing to Stop the AI Bubble Bursting" />
          <PodMini ep="02" run="1:00:36" t="How to Think Like a Machine and Learn Like a Human" />
          <TrackedLink
            className={s.dcPodAll}
            href={YOUTUBE_CHANNEL}
            external
            event="cta_click"
            eventProps={{ surface: 'home_podcast', label: 'all_episodes' }}
          >
            All episodes <span className={s.dcArr}>→</span>
          </TrackedLink>
        </div>
      </div>
    </section>
  );
}

function PodMini({ ep, run, t }: { ep: string; run: string; t: string }) {
  return (
    <a className={s.dcPodMini} href={YOUTUBE_CHANNEL} target="_blank" rel="noopener noreferrer">
      <div className={s.dcPodMiniMeta}>
        Ep {ep} · {run}
      </div>
      <div className={s.dcPodMiniTitle}>{t}</div>
    </a>
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
            href="/blueprint"
            event="cta_click"
            eventProps={{ surface: 'home_final_cta', label: 'map_bottleneck' }}
          >
            Map your bottleneck <span className={s.dcArr}>→</span>
          </TrackedLink>
          <TrackedLink
            className={`${s.dcBtn} ${s.dcBtnSecondary}`}
            href={BOOKING_URL}
            external
            event="booking_click"
            eventProps={{ surface: 'home_final_cta' }}
          >
            Talk to the Team
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
              ['Brand', '/brand', false],
              ['Console', '/console-demo', false],
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
              ['Book a call ↗', BOOKING_URL, true],
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
