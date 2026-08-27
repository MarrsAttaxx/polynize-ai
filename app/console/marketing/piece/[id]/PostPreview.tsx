'use client';

/**
 * WHAT IT LOOKS LIKE ON THE PLATFORM.
 *
 * Marrs: "What I would like here is a preview of what it would look like on the actual platform.
 * I know that Metricool offers this in the platform. Down the right-hand side, when you change
 * stuff, you can actually see what it's going to look like at the end... as an individual, I'd
 * want to see how that's going to look on the actual platform. It probably should be in the place
 * where I'm editing the piece, so if I'm editing on the left, I can see on the right what it's
 * going to look like."
 *
 * NOT PULLED FROM METRICOOL, and it cannot be. Their preview is a feature of their own web app,
 * not something their API renders: the OpenAPI spec at app.metricool.com/api/swagger.json has 527
 * paths for scheduling, analytics, timelines and best-times, and nothing that returns a rendered
 * post. So this is ours, which is the better answer anyway: it can show the fold against the
 * numbers this console already holds sources for, and it works before anything is connected.
 *
 * THE ONE THING IT KNOWS THAT THE EDITOR DOES NOT is where the post folds. A preview that only
 * restates the words is a second textarea. Everything after the "see more" is read by people who
 * already decided to read on, so whether the hook clears that line is the single editorial fact
 * worth putting on screen, and it is the reason this panel is not decoration.
 *
 * DELIBERATELY NOT A PIXEL COPY. It is the platform's SHAPE: who posted, the copy with its fold,
 * the image at its real aspect, the furniture underneath. Chasing LinkedIn's exact type stack
 * would go stale the next time they reskin, and would tell him nothing more than this does. The
 * numbers are the part that has to be right.
 */

import { useMemo } from 'react';
import { streamLabel, STREAM_AVATARS } from '@/lib/marketing/streams';
import { channelLabel } from '@/lib/marketing/channels';
import { PlatformIcon } from '@/app/console/marketing/_components/PlatformIcon';
import { foldRule, foldCopy, isPreviewNetwork } from '@/lib/marketing/post-preview';
import s from './post-preview.module.css';

export function PostPreview({
  network,
  copy,
  imageUrls,
  stream,
  /** Every network this piece serves, so the panel can offer the others. */
  networks,
  onPickNetwork,
}: {
  network: string;
  copy: string;
  imageUrls: string[];
  stream: string;
  networks: string[];
  onPickNetwork: (n: string) => void;
}) {
  const rule = foldRule(network);
  const { head, tail, reason } = useMemo(() => foldCopy(copy, rule), [copy, rule]);

  const who = streamLabel(stream);
  const avatar = STREAM_AVATARS[stream];
  const chars = copy.length;

  return (
    <aside className={s.wrap} aria-label="Preview">
      <div className={s.head}>
        <span className={s.eyebrow}>preview</span>
        {/* Only when there is a choice to make: one network needs no picker. */}
        {networks.length > 1 ? (
          <div className={s.tabs} role="tablist" aria-label="Preview network">
            {networks.map((n) => (
              <button
                key={n}
                type="button"
                role="tab"
                aria-selected={n === network}
                className={`${s.tab} ${n === network ? s.tabOn : ''}`}
                onClick={() => onPickNetwork(n)}
                title={channelLabel(n)}
              >
                <PlatformIcon channel={n} size={14} />
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {!isPreviewNetwork(network) ? (
        /* Said rather than faked. Inventing chrome for a platform whose fold this codebase has no
           source for would be worse than showing nothing, because he would write to it. */
        <p className={s.none}>
          No {channelLabel(network)} preview yet. The fold on {channelLabel(network)} is not
          published and this console has no measured figure for it, so there is nothing honest to
          draw.
        </p>
      ) : (
        <div className={`${s.card} ${network === 'instagram' ? s.ig : ''}`}>
          {/* WHO POSTED. Instagram puts it over the image, LinkedIn above the copy, which is the
              actual difference in how the two feeds read. */}
          <div className={s.author}>
            <span className={s.avatar} aria-hidden>
              {avatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={avatar} alt="" className={s.avatarImg} />
              ) : (
                <span className={s.avatarMark} />
              )}
            </span>
            <span className={s.authorText}>
              <span className={s.name}>{who}</span>
              <span className={s.meta}>{network === 'instagram' ? '' : 'now'}</span>
            </span>
          </div>

          {/* Instagram is image led: the picture comes first and the caption sits under it. */}
          {network === 'instagram' && imageUrls.length > 0 ? (
            <PreviewImages urls={imageUrls} shape="ig" />
          ) : null}

          {copy.trim() ? (
            /**
             * COLLAPSED, NOT DIMMED (D77). This used to render the whole post with the tail faded
             * out, which was wrong twice over. Marrs: "The way it was showing the text was a bit
             * weird. It wasn't the same as it would have on LinkedIn. It would have just shown the
             * first two lines, then it says More and then condenses all of that up and then has an
             * image."
             *
             * And the second fault was the consequence of the first: an 1,884 character post
             * rendered in full pushed the IMAGE below the bottom of the screen, so the picture he
             * had attached looked like it was missing. One bug, two symptoms.
             */
            <p className={s.copy}>
              {head}
              {tail ? <span className={s.more}>{rule?.moreLabel}</span> : null}
            </p>
          ) : (
            <p className={s.empty}>Nothing written yet.</p>
          )}

          {network !== 'instagram' && imageUrls.length > 0 ? (
            <PreviewImages urls={imageUrls} shape="li" />
          ) : null}

          {/* The furniture, so the copy is not the only thing on the card and the fold sits in a
              believable amount of space. */}
          <div className={s.bar} aria-hidden>
            {network === 'instagram' ? (
              <>
                <span>♡</span>
                <span>◻</span>
                <span>↗</span>
              </>
            ) : (
              <>
                <span>Like</span>
                <span>Comment</span>
                <span>Repost</span>
                <span>Send</span>
              </>
            )}
          </div>
        </div>
      )}

      {/* THE NUMBERS. Under the card, because they are about the copy rather than part of it. */}
      {rule ? (
        <div className={s.facts}>
          <p className={s.fact}>
            {tail ? (
              <>
                <strong className={s.factNum}>{head.length}</strong> characters before the fold
                {reason === 'paragraph'
                  ? ', cut at the paragraph break rather than by length'
                  : ''}
                . <span className={s.factHidden}>{tail.trim().length} characters are behind it.</span>
              </>
            ) : (
              <>
                <strong className={s.factNum}>{chars}</strong> characters, all of it visible.
              </>
            )}
          </p>
          <p className={s.note}>{rule.note}</p>
        </div>
      ) : null}
    </aside>
  );
}

/**
 * The images at a believable aspect. Instagram crops the feed to one shape, so the first image
 * decides it; LinkedIn shows what it is given.
 */
function PreviewImages({ urls, shape }: { urls: string[]; shape: 'ig' | 'li' }) {
  return (
    <div className={`${s.shots} ${urls.length > 1 ? s.shotsMany : ''}`}>
      {urls.slice(0, 4).map((u, i) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={`${u}-${i}`}
          src={u}
          alt=""
          className={`${s.shot} ${shape === 'ig' ? s.shotIg : ''}`}
          loading="lazy"
        />
      ))}
      {urls.length > 4 ? <span className={s.shotMore}>+{urls.length - 4}</span> : null}
    </div>
  );
}
