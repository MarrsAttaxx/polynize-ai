import Link from 'next/link';
import Image from 'next/image';
import { DraftingGrid } from '../../_components/DraftingGrid';
import { TrackedLink } from '../../_components/TrackedLink';
import { SiteFooter } from '../../_components/SiteFooter';
import { SiloGlyph, StageGlyph } from '../_icons';
import { BOOKING_URL, type MappingContent } from '../content';
import type { Beat } from './content';
import s from './story.module.css';

/**
 * Scroll-story variant of the mapping page.
 *
 * Two differences from ../MappingLanding:
 *
 * 1. The video lives INSIDE the hero. It is the hero. Anyone who would rather watch
 *    can press play and get the whole argument; the scroll story then serves everyone
 *    who keeps going. The story therefore starts below the video, not above it.
 *
 * 2. The problem section is told as beats, roughly one thought per screen, revealed
 *    on scroll.
 *
 * The motion is pure CSS (see story.module.css): scroll-driven animations behind an
 * @supports gate, disabled under prefers-reduced-motion. There is no JavaScript and
 * no client component, so every word is in the DOM and readable even if the animation
 * never runs. Motion is a layer on top of a page that already works.
 */
export function StoryLanding({
  content: c,
  beats,
}: {
  content: MappingContent;
  beats: Beat[];
}) {
  return (
    <>
      <DraftingGrid />
      <div className={s.page}>
        <StoryNav cta={c.finalCta.button} />

        {/* 1. Hero, video included */}
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
                eventProps={{ surface: 'story_hero' }}
              >
                {c.hero.primaryCta}
              </TrackedLink>
              <a className={s.btnGhost} href="#story">
                {c.hero.secondaryLabel} <span aria-hidden>↓</span>
              </a>
            </div>
          </div>

          <div className={s.videoWrap}>
            <video className={s.video} controls preload="metadata" poster={c.video.poster} playsInline>
              <source src={c.video.src} type="video/mp4" />
            </video>
          </div>
          <div className={s.videoMeta}>
            <span className={s.avatars} aria-hidden="true">
              {c.video.people.map((p) => (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img key={p.name} className={s.avatar} src={p.src} alt="" width={40} height={40} />
              ))}
            </span>
            <p className={s.videoCaption}>{c.video.caption}</p>
          </div>
        </section>

        {/* 2. The story. One thought per screen. */}
        <section id="story" className={s.story} aria-label="The problem">
          {beats.map((b, i) => (
            <div key={i} className={`${s.beat} ${b.turn ? s.beatTurn : ''}`}>
              {b.kicker && <div className={`${s.kicker} ${s.rise}`}>{b.kicker}</div>}
              <p className={`${b.turn ? s.turnLine : s.beatLine} ${s.rise}`}>{b.line}</p>
              {b.sub && <p className={`${s.beatSub} ${s.riseLate}`}>{b.sub}</p>}
              {b.panels && (
                <div className={`${s.panels} ${s.riseLate}`}>
                  {b.panels.map((p) => (
                    <div key={p.label} className={s.panel}>
                      <span className={s.panelIcon}>
                        <SiloGlyph kind={p.kind} />
                      </span>
                      <div className={s.panelLabel}>{p.label}</div>
                      <div className={s.panelNote}>{p.note}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </section>

        {/* 3. The payoff: the map itself */}
        <Section eyebrow="What it is" h2={c.whatItIs.h2}>
          <div className={`${s.prose} ${s.rise}`}>
            {c.whatItIs.paras.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>
          <figure className={`${s.matrixFigure} ${s.riseScale}`}>
            <div className={s.matrixScroll}>
              <Image
                className={s.matrixImg}
                src={c.matrixImage.src}
                alt={c.matrixImage.alt}
                width={c.matrixImage.width}
                height={c.matrixImage.height}
                sizes="(max-width: 680px) 900px, 1096px"
              />
            </div>
            <div className={s.legend}>
              <span className={s.legendItem}>
                <i className={`${s.legendDot} ${s.dotMint}`} />Strong
              </span>
              <span className={s.legendItem}>
                <i className={`${s.legendDot} ${s.dotAmber}`} />Developing
              </span>
              <span className={s.legendItem}>
                <i className={`${s.legendDot} ${s.dotCoral}`} />Gap
              </span>
            </div>
            <figcaption className={s.matrixCaption}>{c.matrixImage.caption}</figcaption>
          </figure>
          <div className={s.cards3}>
            {c.whatItIs.cards.map((card) => (
              <div key={card.title} className={`${s.card} ${s.rise}`}>
                <div className={s.cardTitle}>{card.title}</div>
                <div className={s.cardBody}>{card.body}</div>
              </div>
            ))}
          </div>
        </Section>

        {/* 4. The process */}
        <section id="how" className={s.section}>
          <div className={s.sectionHead}>
            <div className={s.eyebrow}>The process</div>
            <h2 className={s.h2}>{c.howItRuns.h2}</h2>
          </div>
          <div className={s.stages}>
            {c.howItRuns.stages.map((st) => (
              <div key={st.n} className={`${s.stage} ${s.rise}`}>
                <span className={s.stageIcon}>
                  <StageGlyph kind={st.icon} />
                </span>
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

        {/* 5. What you keep */}
        <Section eyebrow="What you keep" h2={c.walkaway.h2}>
          <p className={s.leadLine}>{c.walkaway.intro}</p>
          <div className={s.walkList}>
            {c.walkaway.items.map((it) => (
              <div key={it.n} className={`${s.walkItem} ${s.rise}`}>
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

        {/* 6. Proof */}
        <section className={s.section}>
          <div className={`${s.proof} ${s.rise}`}>
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

        {/* 7. Example sessions */}
        <Section eyebrow="Example sessions" h2={c.examples.h2}>
          <p className={s.leadLine}>{c.examples.intro}</p>
          <div className={s.cards2}>
            {c.examples.cards.map((card) => (
              <div key={card.title} className={`${s.card} ${s.rise}`}>
                <div className={s.cardTitle}>{card.title}</div>
                <div className={s.cardBody}>{card.body}</div>
              </div>
            ))}
          </div>
        </Section>

        {/* 8. Who it is for */}
        <Section eyebrow="Who it is for" h2={c.audience.h2}>
          <div className={`${s.prose} ${s.rise}`}>
            {c.audience.paras.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>
        </Section>

        {/* 9. Where it leads */}
        <Section eyebrow="What comes next" h2={c.leads.h2}>
          <div className={`${s.prose} ${s.rise}`}>
            {c.leads.paras.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>
          <Link className={s.textLink} href={c.leads.linkHref}>
            {c.leads.linkLabel} <span aria-hidden>→</span>
          </Link>
        </Section>

        {/* 10. Final CTA */}
        <section className={s.section}>
          <div className={`${s.finalCard} ${s.rise}`}>
            <div className={s.eyebrow}>Ready when you are</div>
            <h2 className={s.finalH2}>{c.finalCta.h2}</h2>
            <p className={s.finalBody}>{c.finalCta.body}</p>
            <TrackedLink
              className={`${s.btn} ${s.btnPrimary}`}
              href={BOOKING_URL}
              external
              event="booking_click"
              eventProps={{ surface: 'story_final_cta' }}
            >
              {c.finalCta.button}
            </TrackedLink>
          </div>
        </section>

        <SiteFooter />
      </div>
    </>
  );
}

/* Deliberately a local copy rather than an import from ../MappingLanding, so that
   nothing in this experiment can change the live /mapping page. Fold the two together
   if this variant wins. */
function StoryNav({ cta }: { cta: string }) {
  return (
    <nav className={s.nav}>
      <Link className={s.wordmark} href="/">
        <span className={s.mark} aria-hidden>
          <img src="/assets/polynize-mark.png" alt="" width={26} height={26} />
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
        eventProps={{ surface: 'story_nav' }}
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
  id,
}: {
  eyebrow: string;
  h2: string;
  children: React.ReactNode;
  id?: string;
}) {
  return (
    <section className={s.section} id={id}>
      <div className={`${s.sectionHead} ${s.rise}`}>
        <div className={s.eyebrow}>{eyebrow}</div>
        <h2 className={s.h2}>{h2}</h2>
      </div>
      {children}
    </section>
  );
}
