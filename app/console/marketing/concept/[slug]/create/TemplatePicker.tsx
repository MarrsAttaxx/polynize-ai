'use client';

/**
 * The template picker (D25, revised 2026-08-04). Two changes from Marrs trying to get
 * into a writing flow and finding the piece incoherent:
 *
 * 1. AN ANGLE IS ASKED FOR BEFORE ANYTHING IS DRAFTED. Choosing a template used to create
 *    the piece and draft it in the same click, so April had the concept and the shape but
 *    no editorial intent and had to guess. "The script is way off" is the predictable
 *    result of drafting blind, not a prompt-quality problem. The concept says what the
 *    piece is ABOUT, the template says what SHAPE it takes, and the angle is the third
 *    thing that only the human has.
 * 2. The card no longer prints "You bring / You get / Example". Between the concept and
 *    the template the piece is already described, so at the moment of choosing those read
 *    as noise. A FORMAT ICON carries the one thing that was genuinely hard to see at a
 *    glance: whether this makes a video, a written post, or an image.
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { ContentTemplate } from '@/lib/marketing/template-store';
import type { LibraryTemplate } from '@/lib/marketing/template-library';
import { formatById, type FormatKind } from '@/lib/marketing/output-plan';
import { channelLabel } from '@/lib/marketing/channels';
import { BackLink } from '@/app/console/marketing/_components/BackLink';
import s from './create.module.css';

type AnyTemplate = (ContentTemplate | LibraryTemplate) & { stream?: string };

/**
 * What this template MAKES, at a glance. Inline SVG rather than an icon font or an emoji:
 * it inherits currentColor, stays crisp at any size, and adds no dependency for 3 marks.
 */
function FormatIcon({ kind }: { kind: FormatKind }) {
  const p = {
    width: 15,
    height: 15,
    viewBox: '0 0 16 16',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.5,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  };
  if (kind === 'video')
    return (
      <svg {...p}>
        <rect x="1.5" y="3.5" width="9" height="9" rx="1.5" />
        <path d="M10.5 7l4-2.2v6.4L10.5 9z" />
      </svg>
    );
  if (kind === 'image')
    return (
      <svg {...p}>
        <rect x="1.5" y="2.5" width="13" height="11" rx="1.5" />
        <circle cx="5.5" cy="6" r="1.1" />
        <path d="M2 11.5l3.5-3 3 2.5 2-1.8 3.5 3" />
      </svg>
    );
  return (
    <svg {...p}>
      <rect x="2.5" y="1.5" width="11" height="13" rx="1.5" />
      <path d="M5 5h6M5 8h6M5 11h3.5" />
    </svg>
  );
}

export function TemplatePicker({
  streamTemplates,
  libraryTemplates,
  stream,
  conceptSlug,
  backHref,
  dashboardHref,
  planHref,
}: {
  streamTemplates: ContentTemplate[];
  libraryTemplates: LibraryTemplate[];
  stream: string;
  conceptSlug: string;
  backHref: string;
  dashboardHref: string;
  planHref: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // The template chosen but not yet committed: the angle is asked for in between.
  const [chosen, setChosen] = useState<{ t: AnyTemplate; source: 'stream' | 'library' } | null>(
    null
  );
  const [angle, setAngle] = useState('');

  /**
   * THE ANGLE DRAFT IS NEVER LOST. Marrs wrote a long angle, and it went with the page.
   * It is real writing, often the most considered thing in the whole piece, and at that
   * moment it exists nowhere but an uncommitted textarea. So it is mirrored to
   * localStorage per concept+template as he types, restored on return, and cleared only
   * once a piece has actually been created from it. Local rather than server-side on
   * purpose: it has to survive a failed request and a closed tab, which is exactly when a
   * save to the server would not have happened either.
   */
  const draftKey = chosen
    ? `pam.angle.${conceptSlug}.${chosen.source}:${chosen.t.template_id}`
    : null;
  useEffect(() => {
    if (!draftKey) return;
    try {
      const saved = window.localStorage.getItem(draftKey);
      if (saved) setAngle(saved);
    } catch {
      /* private mode; the box just starts empty */
    }
  }, [draftKey]);
  useEffect(() => {
    if (!draftKey) return;
    try {
      if (angle.trim()) window.localStorage.setItem(draftKey, angle);
      else window.localStorage.removeItem(draftKey);
    } catch {
      /* nothing to do; the text is still on screen */
    }
  }, [draftKey, angle]);

  // Hide library templates the stream has already copied (same id).
  const streamIds = new Set(streamTemplates.map((t) => t.template_id));
  const library = libraryTemplates.filter((t) => !streamIds.has(t.template_id));

  const create = async () => {
    if (!chosen || busy) return;
    const { t, source } = chosen;
    const key = `${source}:${t.template_id}`;
    setBusy(key);
    setError(null);
    try {
      const url = window.location.pathname.replace(/\/+$/, '') + '/go';
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ source, template_id: t.template_id, angle: angle.trim() }),
      });
      const b = (await res.json().catch(() => null)) as
        | { target?: string; error?: string }
        | null;
      if (!res.ok || !b?.target) {
        setError(b?.error ?? 'Could not create from this template.');
        setBusy(null);
        return;
      }
      // Committed: the angle now lives on the piece, so the local copy can go.
      try {
        if (draftKey) window.localStorage.removeItem(draftKey);
      } catch {
        /* harmless */
      }
      router.push(b.target);
    } catch {
      setError('Network error. Try again.');
      setBusy(null);
    }
  };

  const renderCard = (t: AnyTemplate, source: 'stream' | 'library') => {
    const fmt = formatById(t.format);
    const usable = fmt?.module === 'built' && t.status === 'active';
    const key = `${source}:${t.template_id}`;
    return (
      <div key={key} className={`${s.card} ${usable ? '' : s.cardDim}`}>
        <div className={s.cardHead}>
          <span className={s.cardName}>
            <span className={s.formatIcon}>
              <FormatIcon kind={fmt?.kind ?? 'text'} />
            </span>
            {t.name}
          </span>
          <span className={`${s.status} ${t.status === 'active' ? s.stActive : s.stDev}`}>
            {t.status}
          </span>
        </div>
        <p className={s.cardDesc}>{t.description}</p>
        <p className={s.cardMakes}>
          Makes: <strong>{fmt?.label ?? t.format}</strong>
          {t.platforms.length ? <> → {t.platforms.map(channelLabel).join(', ')}</> : null}
        </p>
        {t.length ? (
          <p className={s.cardIo}>
            <span className={s.ioLabel}>Length:</span> {t.length}
          </p>
        ) : null}
        <div className={s.cardFoot}>
          {usable ? (
            <button
              type="button"
              className={s.useBtn}
              onClick={() => {
                setChosen({ t, source });
                setError(null);
              }}
              disabled={busy !== null}
            >
              {busy === key ? 'Creating…' : 'Use this template →'}
            </button>
          ) : (
            <span className={s.comingNote}>
              {fmt?.module !== 'built' ? 'Production module coming' : 'In development'}
            </span>
          )}
          {source === 'library' ? <span className={s.libTag}>library</span> : null}
        </div>
      </div>
    );
  };

  // THE ANGLE. One box, deliberately: the angle and the rough points arrive in the same
  // breath when someone describes what they want, and splitting them into separate fields
  // would be the form-filling this step exists to remove. One question on the screen,
  // because this is the moment the piece gets its intent and anything else competes.
  if (chosen) {
    const cf = formatById(chosen.t.format);
    return (
      <div className={s.angleWrap}>
        <button type="button" className={s.angleBack} onClick={() => setChosen(null)}>
          &larr; Choose a different template
        </button>
        <p className={s.angleChosen}>
          <span className={s.formatIcon}>
            <FormatIcon kind={cf?.kind ?? 'text'} />
          </span>
          {chosen.t.name}
        </p>
        <h2 className={s.angleQ}>What angle do you want to take on this?</h2>
        <p className={s.angleHelp}>
          The concept says what this is about and the template says what shape it takes.
          The angle is the part only you have: which argument you are making, who it is
          for, and any rough points you already know you want in. Write it however it comes
          out.
        </p>
        <textarea
          className={s.angleInput}
          value={angle}
          onChange={(e) => setAngle(e.target.value)}
          placeholder={
            'e.g. for ops leaders about to buy AI licences for the whole team. AI is a force multiplier, so mapping the work has to come first or you just multiply the mess. Points I want in: the three tiers, and that a map tells you what should stay human.'
          }
          rows={8}
          autoFocus
          disabled={busy !== null}
        />
        <div className={s.angleFoot}>
          <button
            type="button"
            className={s.useBtn}
            onClick={create}
            disabled={busy !== null || !angle.trim()}
          >
            {busy ? 'Writing it\u2026' : 'Create the piece \u2192'}
          </button>
          <button type="button" className={s.angleSkip} onClick={create} disabled={busy !== null}>
            Skip, just use the concept
          </button>
        </div>
        {error ? <p className={s.error}>{error}</p> : null}
      </div>
    );
  }
  return (
    <div className={s.picker}>
      {/* The header lives here rather than on the page so it can stand down on the angle
          screen, where everything above the question is a distraction (Marrs). */}
      <header className={s.head}>
        <BackLink fallbackHref={backHref} className={s.back} dashboardHref={dashboardHref} />
        <span className={s.eyebrow}>create content · {stream}</span>
        <h1 className={s.title}>Pick a content template</h1>
        <p className={s.sub}>
          A content template already knows its format, platforms, audience, and production
          recipe; you bring the concept. Or{' '}
          <Link href={planHref} className={s.customLink}>
            plan a custom output →
          </Link>
        </p>
      </header>

      {error ? <p className={s.error}>{error}</p> : null}

      <section className={s.panel}>
        <h2 className={s.groupTitle}>Your templates</h2>
        {streamTemplates.length === 0 ? (
          <p className={s.emptyNote}>
            No templates in this stream yet.{' '}
            <Link href={`/console/marketing/stream/${stream}/templates`} className={s.manageLink}>
              Create one →
            </Link>
          </p>
        ) : (
          <div className={s.cards}>{streamTemplates.map((t) => renderCard(t, 'stream'))}</div>
        )}
      </section>

      {library.length > 0 ? (
        <section className={s.panel}>
          <h2 className={s.groupTitle}>From the template library</h2>
          <div className={s.cards}>{library.map((t) => renderCard(t, 'library'))}</div>
        </section>
      ) : null}

      <p className={s.manageFoot}>
        <Link href={`/console/marketing/stream/${stream}/templates`} className={s.manageLink}>
          Manage this stream&rsquo;s templates →
        </Link>
      </p>
    </div>
  );
}
