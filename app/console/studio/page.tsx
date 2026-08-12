import { headers } from 'next/headers';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/console-auth';
import { buildShootQueue } from '@/lib/marketing/shoot-queue';
import { streamLabel } from '@/lib/marketing/streams';
import { qrSvg } from '@/lib/qr';
import { RecordedButton } from './ShootRowActions';
import s from '../_components/client-card.module.css';
import d from './studio.module.css';

export const dynamic = 'force-dynamic';

/**
 * THE STUDIO. What to shoot, in the order to shoot it.
 *
 * Marrs described the whole job in one sentence: "I can get into the studio, set up the cameras, select
 * one, put the Prezi on the screen, put the text in the teleprompter on the iPad, record it, done, click
 * OK, and go to the next one." This page is that sentence, and nothing else. No editing, no drafting, no
 * navigation into the rest of the console: he is standing up, the room is set, and everything that is not
 * the next take is in the way.
 *
 * CROSS-STREAM, because a session is one room and not one brand. The stream is on every row, since it
 * tells him which voice he is in, but it does not group anything.
 *
 * GROUPED BY FORMAT, because format is the RIG. Screen-rig groups come first so the heaviest setup is done
 * while the room is fresh.
 */
export default async function StudioPage() {
  const user = await getCurrentUser();
  if (!user) return null;
  if (user.scope.type === 'client') {
    redirect(`/console/${user.scope.slug}/blueprint`);
  }

  const { groups, total, with_prezie } = await buildShootQueue(user.email);

  /**
   * THE QR HAS TO CARRY AN ABSOLUTE URL. A relative path is meaningless to a camera, so the row's own
   * `/console/...` path (which is right for the anchors on this page) cannot be encoded as it stands.
   *
   * Read off the request rather than an env var, so it is correct on localhost, on a preview deploy and on
   * pam.polynize.ai with nothing to configure. A `/console/...` path is served as-is on every host: the pam
   * rewrite only fires for paths that do NOT already start with /console, so one form works everywhere.
   */
  const h = await headers();
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? '';
  const proto = h.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https');
  const origin = host ? `${proto}://${host}` : '';
  const absolute = (path: string) => (origin ? `${origin}${path}` : path);

  // Generated on the server, so the page arrives ready to point an iPad at. In parallel because each one is
  // independent and a session could be a dozen rows.
  const qrByPiece = new Map<string, string>();
  await Promise.all(
    groups.flatMap((g) =>
      g.rows.map(async (r) => {
        // No origin means no scannable code, so the url is shown as text instead of a QR that cannot work.
        if (!origin) return;
        const svg = await qrSvg(absolute(r.teleprompter_url), { size: 132 });
        if (svg) qrByPiece.set(r.piece_id, svg);
      })
    )
  );

  return (
    <>
      <div className={s.bgPattern} aria-hidden />
      <div className={s.dashboard}>
        <div className={s.header}>
          <Link href="/console" className={s.marketingBack}>
            ← Console
          </Link>
          <div className={s.eyebrow}>studio</div>
          <h1 className={s.title}>Ready to record</h1>
          {/* THE SESSION COUNT, so the room is worth setting up before it is set up. */}
          <p className={d.count}>
            {total === 0
              ? 'Nothing queued.'
              : `${total} ready${with_prezie ? `, ${with_prezie} with prezies` : ''}`}
          </p>
        </div>

        {total === 0 ? (
          <p className={d.empty}>
            Nothing is queued for the studio. Open a piece, get its script and prezie right, then press
            <strong> Ready to record</strong> on the Script or Prezie screen and it appears here.
          </p>
        ) : null}

        {groups.map((g) => (
          <section key={g.format} className={d.group}>
            <div className={d.groupHead}>
              <h2 className={d.groupTitle}>{g.label}</h2>
              <span className={d.groupMeta}>
                {g.rows.length} · {g.needs_screen ? 'touchscreen rig' : 'camera only'}
              </span>
            </div>

            {g.rows.map((r) => (
              <article key={r.piece_id} className={d.row}>
                <div className={d.rowMain}>
                  <div className={d.rowHead}>
                    <span className={d.stream}>{streamLabel(r.stream)}</span>
                    <h3 className={d.rowTitle}>{r.title}</h3>
                    {r.seconds ? (
                      /* Over 90 seconds is over the house limit for short form, so it is coral: better
                         to see that here than after the take. */
                      <span className={r.seconds > 90 ? d.wordsLong : d.words}>
                        {r.seconds}s read · {r.words} words
                      </span>
                    ) : null}
                  </div>

                  <div className={d.actions}>
                    {r.prezie_url ? (
                      <a
                        className={d.bigBtn}
                        href={r.prezie_url}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Prezie on the screen ↗
                      </a>
                    ) : null}
                    {/* THE MISSING-PREZIE WARNING BEFORE THE SHOOT, not during it. A video format with no
                        prezie is either deliberate or forgotten, and the room is the worst place to find
                        out which. */}
                    {r.prezie_missing ? (
                      <span className={d.warn}>No prezie on this one</span>
                    ) : null}
                    <a
                      className={d.btn}
                      href={r.teleprompter_url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Teleprompter ↗
                    </a>
                    <Link className={d.quiet} href={`/console/marketing/piece/${r.piece_id}`}>
                      the piece
                    </Link>
                    <RecordedButton pieceId={r.piece_id} title={r.title} />
                  </div>
                </div>

                {/* THE IPAD'S WAY IN. Nothing can push a url to another device, so he points the iPad at
                    the screen rather than typing a uuid with two cameras waiting. */}
                <div className={d.qr}>
                  {qrByPiece.has(r.piece_id) ? (
                    <>
                      <div
                        className={d.qrCode}
                        // The SVG is generated server-side from a url this page built, so there is no
                        // untrusted input anywhere in it.
                        dangerouslySetInnerHTML={{ __html: qrByPiece.get(r.piece_id)! }}
                      />
                      <span className={d.qrLabel}>teleprompter</span>
                    </>
                  ) : (
                    /* Typed by hand as a last resort, so it is the full url and not a bare path. */
                    <code className={d.qrFallback}>{absolute(r.teleprompter_url)}</code>
                  )}
                </div>
              </article>
            ))}
          </section>
        ))}
      </div>
    </>
  );
}
