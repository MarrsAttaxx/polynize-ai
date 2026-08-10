import { Fragment } from 'react';
import Link from 'next/link';
import { DraftingGrid } from '../_components/DraftingGrid';
import { TrackedLink } from '../_components/TrackedLink';
import { SiteFooter } from '../_components/SiteFooter';
import { SiloGlyph, StageGlyph, MapGlyph, GitHubMark } from './icons';
import { StoryPath } from './StoryPath';
import { StoryMotion } from './StoryMotion';
import { FocusVeil } from './FocusVeil';
import { ArtefactGlyph } from './ArtefactGlyph';
import { BeatFigure, type FigureRegistry } from './BeatFigure';
import {
  BOOKING_URL,
  type Artefact,
  type Beat,
  type MappingContent,
  type Silo,
} from './content-base';
import s from './story.module.css';

/**
 * The landing page engine. One layout, several narratives.
 *
 * Shape:
 *   hero (video inside it) → the story, told as a route → THE RESULT → how it runs →
 *   what you keep → proof → CTA
 *
 * Two things carry every narrative. The video is the hero, so anyone who would rather
 * watch gets the whole argument without scrolling. And the story section is drawn as a
 * journey (see StoryPath), so the turn line hands directly to the section that answers
 * it.
 *
 * WHAT VARIES BETWEEN PAGES, and therefore what is a prop: the beats, the figures those
 * beats draw, and the RESULT, which is the artefact the turn line has just promised. On
 * /mapping that is the capability matrix; on /capability-mapping it is the three lane
 * capability map. Everything else is the same page, which is the point of sharing it.
 *
 * `surface` goes into the analytics event props so the three CTAs on each page stay
 * distinguishable from the same CTAs on a sibling page.
 */
export function StoryLanding({
  content: c,
  beats,
  figures,
  result,
  resultEyebrow = 'Capability mapping',
  artefacts,
  artefactsIntro,
  artefactsFootnote,
  inputs,
  scale,
  surface,
}: {
  content: MappingContent;
  beats: Beat[];
  /** The figures this page's beats may name. See BeatFigure. */
  figures: FigureRegistry;
  /** The artefact the turn line promised: a matrix, a capability map, whatever comes next. */
  result: React.ReactNode;
  resultEyebrow?: string;
  artefacts: Artefact[];
  artefactsIntro: string;
  artefactsFootnote: string;
  inputs: Silo[];
  /**
   * Optional. Sits between the result and the proof, and says the thing a reader is
   * thinking the moment they finish reading the result: this was one team and one
   * process, does it go wider.
   */
  scale?: ScaleBlock;
  surface: string;
}) {
  return (
    <>
      <DraftingGrid />
      <StoryMotion />
      {/* Outside .page, so nothing in the content column can become its containing
          block. A transform or filter on an ancestor breaks position: fixed. */}
      <FocusVeil />
      <div className={s.page}>
        <StoryNav cta={c.finalCta.button} surface={surface} />

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
                eventProps={{ surface: `${surface}_hero` }}
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
              {b.figure && <BeatFigure kind={b.figure} figures={figures} />}
            </Fragment>
          ))}
        </section>

        {/* 3. The answer to the turn: whatever this page's result is */}
        <Section eyebrow={resultEyebrow} h2={c.whatItIs.h2} glyph>
          <div className={`${s.prose} ${s.rise}`}>
            {c.whatItIs.paras.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>
          {/* data-veil-stop: the focus veil releases here. Everything from the result
              down is reference material you read across rather than one thought at a
              time, and softening it fights the reader. See FocusVeil. */}
          {/* No caption underneath. The result explains itself and the paragraph that
              used to sit here was a second explanation nobody read. */}
          <figure className={`${s.matrixFigure} ${s.riseScale}`} data-veil-stop>
            {result}
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
            {inputs.map((it) => (
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

        {/* 6. From one map to a model of the whole organisation */}
        {scale && <ScaleSection scale={scale} />}

        {/* 7. Proof */}
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

        {/* 8. Final CTA. "Where it leads" came off: the diagnosis is the point, and
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
              eventProps={{ surface: `${surface}_final_cta` }}
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

/**
 * One bottleneck, then the whole organisation.
 *
 * A reader who has just understood the result immediately wants to know whether it goes
 * wider, and if the page does not answer it there they leave assuming it does not. The
 * steps are drawn as a widening run rather than a list, because the claim is that the
 * METHOD does not change as the scope grows, only how much is in it.
 */
export type ScaleBlock = {
  eyebrow: string;
  h2: string;
  paras: string[];
  /** Three widening scopes, smallest first. */
  steps: string[];
};

function ScaleSection({ scale }: { scale: ScaleBlock }) {
  return (
    <section className={s.section}>
      <div className={`${s.sectionHead} ${s.rise}`}>
        <div className={s.eyebrow}>{scale.eyebrow}</div>
        <h2 className={s.h2}>{scale.h2}</h2>
      </div>
      <ol className={`${s.scaleRun} ${s.rise}`}>
        {scale.steps.map((step, i) => (
          <li key={step} className={s.scaleStep} style={{ ['--i' as string]: i }}>
            <span className={s.scaleBar} aria-hidden="true" />
            <span className={s.scaleLabel}>{step}</span>
          </li>
        ))}
      </ol>
      <div className={`${s.prose} ${s.rise}`}>
        {scale.paras.map((p, i) => (
          <p key={i}>{p}</p>
        ))}
      </div>
    </section>
  );
}

/* The landing pages' own nav, separate from the homepage's. */
function StoryNav({ cta, surface }: { cta: string; surface: string }) {
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
        eventProps={{ surface: `${surface}_nav` }}
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
