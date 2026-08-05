import Link from 'next/link';
import { DraftingGrid } from '../_components/DraftingGrid';
import { TrackedLink } from '../_components/TrackedLink';
import { SiteFooter } from '../_components/SiteFooter';
import { BOOKING_URL, type MappingContent } from './content';
import s from './mapping.module.css';

/**
 * Team Capability Mapping landing page. Composed from a MappingContent object so
 * buyer-specific variants (/mapping/<variant>) can pass their own copy and reuse
 * every section component unchanged. Section order here is the page order.
 */
export function MappingLanding({ content: c }: { content: MappingContent }) {
  return (
    <>
      <DraftingGrid />
      <div className={s.page}>
        <MappingNav cta={c.finalCta.button} />

        {/* 1. Hero */}
        <section className={s.hero}>
          <div className={s.heroCopy}>
            <h1 className={s.h1}>{c.hero.h1}</h1>
            <p className={s.heroSub}>{c.hero.subhead}</p>
            <div className={s.ctaRow}>
              <TrackedLink
                className={`${s.btn} ${s.btnPrimary}`}
                href={BOOKING_URL}
                external
                event="booking_click"
                eventProps={{ surface: 'mapping_hero' }}
              >
                {c.hero.primaryCta}
              </TrackedLink>
              <a className={s.btnGhost} href="#how">
                {c.hero.secondaryLabel} <span aria-hidden>↓</span>
              </a>
            </div>
          </div>
        </section>

        {/* 2. Video */}
        <Section eyebrow="From the podcast" h2={c.video.h2}>
          <div className={s.videoWrap}>
            <video
              className={s.video}
              controls
              preload="metadata"
              poster={c.video.poster}
              playsInline
            >
              <source src={c.video.src} type="video/mp4" />
            </video>
          </div>
          <p className={s.videoCaption}>{c.video.caption}</p>
        </Section>

        {/* 3. The problem */}
        <Section eyebrow="The problem" h2={c.problem.h2}>
          <div className={s.prose}>
            {c.problem.paras.map((p, i) => (
              <p key={i} className={i === c.problem.paras.length - 1 ? s.proseEmph : undefined}>
                {p}
              </p>
            ))}
          </div>
        </Section>

        {/* 4. What it is */}
        <Section eyebrow="What it is" h2={c.whatItIs.h2}>
          <div className={s.prose}>
            {c.whatItIs.paras.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>
          <div className={s.cards3}>
            {c.whatItIs.cards.map((card) => (
              <div key={card.title} className={s.card}>
                <div className={s.cardTitle}>{card.title}</div>
                <div className={s.cardBody}>{card.body}</div>
              </div>
            ))}
          </div>
          <figure className={s.matrixFigure}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              className={s.matrixImg}
              src={c.matrixImage.src}
              alt={c.matrixImage.alt}
              loading="lazy"
            />
            <figcaption className={s.matrixCaption}>{c.matrixImage.caption}</figcaption>
          </figure>
        </Section>

        {/* 5. The process */}
        <section id="how" className={s.section}>
          <div className={s.sectionHead}>
            <div className={s.eyebrow}>The process</div>
            <h2 className={s.h2}>{c.howItRuns.h2}</h2>
          </div>
          <div className={s.stages}>
            {c.howItRuns.stages.map((st) => (
              <div key={st.n} className={s.stage}>
                <div className={s.stageNum}>{st.n}</div>
                <div className={s.stageTitle}>{st.title}</div>
                <div className={s.stageWhat}>{st.what}</div>
                <div className={s.stageWho}>
                  <span className={s.stageWhoLabel}>In the room</span>
                  {st.who}
                </div>
              </div>
            ))}
          </div>
          <p className={s.stagesLine}>{c.howItRuns.line}</p>
        </section>

        {/* 6. What you keep */}
        <Section eyebrow="What you keep" h2={c.walkaway.h2}>
          <p className={s.leadLine}>{c.walkaway.intro}</p>
          <div className={s.walkList}>
            {c.walkaway.items.map((it) => (
              <div key={it.n} className={s.walkItem}>
                <div className={s.walkNum}>{it.n}</div>
                <div>
                  <div className={s.walkTitle}>{it.title}</div>
                  <div className={s.walkBody}>{it.body}</div>
                </div>
              </div>
            ))}
          </div>
          <p className={s.walkFootnote}>{c.walkaway.footnote}</p>
        </Section>

        {/* 7. Proof */}
        <section className={s.section}>
          <div className={s.proof}>
            <div className={s.eyebrow}>Proof</div>
            <h2 className={s.proofH2}>{c.proof.h2}</h2>
            <div className={s.prose}>
              {c.proof.paras.map((p, i) => (
                <p key={i}>{p}</p>
              ))}
            </div>
            <div className={s.proofStat}>{c.proof.stat}</div>
          </div>
        </section>

        {/* 8. Example sessions */}
        <Section eyebrow="Example sessions" h2={c.examples.h2}>
          <p className={s.leadLine}>{c.examples.intro}</p>
          <div className={s.cards2}>
            {c.examples.cards.map((card) => (
              <div key={card.title} className={s.card}>
                <div className={s.cardTitle}>{card.title}</div>
                <div className={s.cardBody}>{card.body}</div>
              </div>
            ))}
          </div>
        </Section>

        {/* 9. Who it is for */}
        <Section eyebrow="Who it is for" h2={c.audience.h2}>
          <div className={s.prose}>
            {c.audience.paras.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>
        </Section>

        {/* 10. Where it leads */}
        <Section eyebrow="What comes next" h2={c.leads.h2}>
          <div className={s.prose}>
            {c.leads.paras.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>
          <Link className={s.textLink} href={c.leads.linkHref}>
            {c.leads.linkLabel} <span aria-hidden>→</span>
          </Link>
        </Section>

        {/* 11. Final CTA */}
        <section className={s.section}>
          <div className={s.finalCard}>
            <div className={s.eyebrow}>Ready when you are</div>
            <h2 className={s.finalH2}>{c.finalCta.h2}</h2>
            <p className={s.finalBody}>{c.finalCta.body}</p>
            <TrackedLink
              className={`${s.btn} ${s.btnPrimary}`}
              href={BOOKING_URL}
              external
              event="booking_click"
              eventProps={{ surface: 'mapping_final_cta' }}
            >
              {c.finalCta.button}
            </TrackedLink>
          </div>
        </section>

        {/* 12. Footer */}
        <SiteFooter />
      </div>
    </>
  );
}

function MappingNav({ cta }: { cta: string }) {
  return (
    <nav className={s.nav}>
      <Link className={s.wordmark} href="/">
        <span className={s.mark} aria-hidden>
          <img src="/assets/polynize-mark.png" alt="" />
        </span>
        <span>
          polynize<span style={{ color: 'var(--text-3)' }}>.ai</span>
        </span>
      </Link>
      <TrackedLink
        className={`${s.btn} ${s.btnPrimary} ${s.navBtn}`}
        href={BOOKING_URL}
        external
        event="booking_click"
        eventProps={{ surface: 'mapping_nav' }}
      >
        {cta}
      </TrackedLink>
    </nav>
  );
}

function Section({
  eyebrow,
  h2,
  children,
}: {
  eyebrow: string;
  h2: string;
  children: React.ReactNode;
}) {
  return (
    <section className={s.section}>
      <div className={s.sectionHead}>
        <div className={s.eyebrow}>{eyebrow}</div>
        <h2 className={s.h2}>{h2}</h2>
      </div>
      {children}
    </section>
  );
}
