import { Fragment } from 'react';
import Link from 'next/link';
import { DraftingGrid } from '../../_components/DraftingGrid';
import { TrackedLink } from '../../_components/TrackedLink';
import { SiteFooter } from '../../_components/SiteFooter';
import { SiloGlyph, StageGlyph, MapGlyph, GitHubMark } from '../_icons';
import { CapabilityMatrix } from './CapabilityMatrix';
import { StoryPath } from './StoryPath';
import { StoryMotion } from './StoryMotion';
import { ArtefactGlyph } from './ArtefactGlyph';
import { BeatFigure } from './BeatFigure';
import { BOOKING_URL, type MappingContent } from '../content';
import { artefacts, artefactsFootnote, artefactsIntro, storyInputs, type Beat } from './content';
import s from './story.module.css';

/**
 * The capability mapping page, told as a scroll story.
 *
 * Shape, after the 6 Aug founder call:
 *   hero (video inside it) → the story, told as a route → the map → how it runs →
 *   what you keep → proof → what comes next → CTA
 *
 * Two things carry the narrative. The video is the hero, so anyone who would rather
 * watch gets the whole argument without scrolling. And the story section is drawn as
 * a journey (see StoryPath), so the turn line "you cannot go where you need to go
 * without a map" hands directly to a section that answers it: "This is the map."
 *
 * Example sessions and Who it is for were cut. Less is more, per the call.
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
      <StoryMotion />
      <div className={s.page}>
        <StoryNav cta={c.finalCta.button} />

        {/* 1. Hero, video included */}
        <section className={s.hero}>
          <div className={s.heroCopy}>
            <span className={s.titleGlyph}>
              <MapGlyph size={80} />
            </span>
            <h1 className={s.h1}>{c.hero.h1}</h1>
            <p className={s.heroSub}>{c.hero.subhead}</p>
            {/* On its own line so the product name lands as a statement rather than
                trailing off the end of a paragraph. */}
            <p className={s.heroName}>
              We call it <em className={s.heroNameEm}>capability mapping</em>.
            </p>
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

        {/* 2. The story, drawn as a route */}
        <section id="story" className={s.story} aria-label="The problem">
          <StoryPath beatCount={beats.length} />
          {beats.map((b, i) => (
            /* The figure is a SIBLING of the beat, not a child of it. Inside the beat
               it read as a small caption to the text above; in its own band it is
               centred in the gap between one thought and the next, which is where a
               diagram belongs. It also keeps the checkpoint numeral on the copy, since
               StoryPath measures [data-beat] to place them. */
            <Fragment key={i}>
              <div data-beat className={`${s.beat} ${b.turn ? s.beatTurn : ''}`}>
                {b.kicker && <div className={`${s.kicker} ${s.rise}`}>{b.kicker}</div>}
                {/* No .rise here on purpose. StoryMotion animates beat lines on their
                    own slower cue, and carrying both classes put the element in two GSAP
                    batches at once, where overwrite killed one tween mid-flight and left
                    the line stranded at opacity 0. */}
                <p className={b.turn ? s.turnLine : s.beatLine}>{b.line}</p>
                {b.sub && <p className={`${s.beatSub} ${s.riseLate}`}>{b.sub}</p>}
              </div>
              {b.figure && <BeatFigure kind={b.figure} />}
            </Fragment>
          ))}
        </section>

        {/* 3. The answer to the turn: the map itself */}
        <Section eyebrow="Capability mapping" h2={c.whatItIs.h2} glyph>
          <div className={`${s.prose} ${s.rise}`}>
            {c.whatItIs.paras.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>
          <figure className={`${s.matrixFigure} ${s.riseScale}`}>
            {/* The key lives inside CapabilityMatrix now, above the grid, and the
                caption came off: the grid explains itself and the paragraph under it was
                a second explanation nobody read. */}
            <CapabilityMatrix />
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

        {/* 4. How it runs, now three steps */}
        <section id="how" className={s.section}>
          <div className={`${s.sectionHead} ${s.rise}`}>
            <div className={s.eyebrow}>The process</div>
            <h2 className={s.h2}>{c.howItRuns.h2}</h2>
          </div>
          <div className={s.stages3}>
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
          {/* The three inputs step 01 asks for, shown rather than only listed. */}
          <div className={`${s.inputs} ${s.rise}`}>
            {storyInputs.map((it) => (
              <div key={it.label} className={s.input}>
                <span className={s.inputIcon}>
                  <SiloGlyph kind={it.kind} />
                </span>
                <div>
                  <div className={s.inputLabel}>{it.label}</div>
                  <div className={s.inputNote}>{it.note}</div>
                </div>
              </div>
            ))}
          </div>
          <p className={s.stagesLine}>{c.howItRuns.line}</p>
        </section>

        {/* 5. What you keep */}
        <Section eyebrow="What you keep" h2={c.walkaway.h2}>
          <p className={s.leadLine}>{artefactsIntro}</p>
          <div className={s.artefacts}>
            {artefacts.map((a) => (
              <div key={a.n} className={`${s.artefact} ${s.rise}`}>
                <div className={s.artVisual}>
                  <ArtefactGlyph kind={a.kind} />
                </div>
                <div className={s.artNum}>{a.n}</div>
                <div className={s.artTitle}>{a.title}</div>
                <div className={s.artBody}>{a.body}</div>
                <div className={s.artUse}>{a.use}</div>
              </div>
            ))}
          </div>
          <p className={s.walkFootnote}>{artefactsFootnote}</p>
        </Section>

        {/* 6. Proof */}
        <section className={s.section}>
          <div className={`${s.proof} ${s.rise}`}>
            {/* The client is never named in the copy, per the standing rule. The mark
                is the one thing that says who, and it says it quietly. */}
            <span className={s.proofMark} aria-hidden="true">
              <GitHubMark />
            </span>
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

        {/* 7. Final CTA. "Where it leads" came off: the diagnosis is the point, and
            a second forward-looking section before the CTA blunted it. */}
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

/* The page's own nav. Was a local copy so the experiment could not disturb the live
   /mapping page; that page is gone and this is /mapping now. */
function StoryNav({ cta }: { cta: string }) {
  return (
    <nav className={s.nav}>
      <Link className={s.wordmark} href="/">
        <span className={s.mark} aria-hidden>
          <img src="/assets/polynize-mark.png" alt="" width={26} height={26} />
        </span>
        <span>
          polynize
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
  glyph,
}: {
  eyebrow: string;
  h2: string;
  children: React.ReactNode;
  id?: string;
  /** Shows the map glyph beside the heading, tying it back to the hero. */
  glyph?: boolean;
}) {
  return (
    <section className={s.section} id={id}>
      <div className={`${s.sectionHead} ${s.rise}`}>
        <div className={s.eyebrow}>{eyebrow}</div>
        {glyph ? (
          <h2 className={`${s.h2} ${s.h2WithGlyph}`}>
            <span className={s.headGlyph}>
              <MapGlyph size={64} />
            </span>
            {h2}
          </h2>
        ) : (
          <h2 className={s.h2}>{h2}</h2>
        )}
      </div>
      {children}
    </section>
  );
}
