import { sendEmail } from '@/lib/resend-client';
import { streamEmails } from './streams';
import { resolveMediaUrls } from './media-store';
import { channelLabel } from './channels';
import type { CalendarEntry } from './calendar-store';

/**
 * THE HAND-POST BRIEF (D41): the console prepares a post and sends it to the operator,
 * who publishes it himself.
 *
 * Marrs: "for my personal LinkedIn posts, we have to have a way to alert me with the
 * content. I'll do that on my own via my phone, which just supercharges reach in my
 * experience."
 *
 * So this is not a notification, it is the deliverable. It has to be usable on a phone
 * with nothing but a thumb: the copy in one selectable block so a long-press selects the
 * whole post and nothing else, the first comment separately because the link goes there
 * rather than in the body, and the media as plain links he can open and save to the camera
 * roll. No preamble, no dashboard round trip, nothing to decode.
 *
 * BEST EFFORT BY CONTRACT, like lib/crm/notify.ts. It never throws: a post that was
 * prepared but not announced is recoverable from the calendar, while an exception here
 * would abort the rest of a wave that was otherwise fine.
 */

export type HandPost = {
  channel: string;
  copy: string;
  /** The link, which belongs in the first comment rather than the post body. */
  firstComment?: string;
  /**
   * THE POST'S TRACKED LINK (D96), printed when it is NOT already the first comment. On Instagram
   * and TikTok a caption link is not clickable, so this is the one he pastes into that post's
   * ManyChat flow or into his own reply; on YouTube it goes in the description.
   */
  link?: string;
  media: string[];
  /** Local wall-clock the wave planned it for, purely as a suggestion to him. */
  when?: string;
};

function escapeHtml(v: string): string {
  return v
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Send one brief covering every hand-post in a wave.
 *
 * ONE email for the whole wave, not one per post. A wave can carry several of these and a
 * burst of near-identical emails is the fastest way to make him stop reading them.
 */
export async function sendHandPostBrief(
  lane: string,
  narrativeTitle: string,
  posts: HandPost[]
): Promise<{ sent: number; skipped: string | null }> {
   
  try {
    if (posts.length === 0) return { sent: 0, skipped: 'nothing to hand over' };

    const to = streamEmails(lane);
    if (to.length === 0) {
      // Not an error, but it IS a hole worth logging: the posts are prepared and sitting
      // on the calendar with nobody told about them.
      console.error(`[hand-post] no address for lane ${lane}; ${posts.length} posts unannounced`);
      return { sent: 0, skipped: 'no address on file for this lane' };
    }

    /**
     * MEDIA IDS ARE NOT LINKS (D47). CalendarEntry.media holds media_ids, and this email was
     * rendering each one as an anchor, so every hand-post brief arrived on his phone as a list of
     * dead uuids with nothing to save to the camera roll. It hit every marrs-lane LinkedIn post,
     * which is every post on the one lane the hand-post path exists for.
     *
     * Resolved here rather than at the call site because this function already takes the lane, and
     * resolution has to happen somewhere that knows it. Best effort like the rest of this file: a
     * failed lookup costs the images, never the brief.
     */
    const resolved = await Promise.all(
      posts.map(async (p) => {
        if (p.media.length === 0) return p;
        try {
          return { ...p, media: await resolveMediaUrls(lane, p.media) };
        } catch (err) {
          console.error('[hand-post] media resolve failed:', err);
          return { ...p, media: [] as string[] };
        }
      })
    );
    posts = resolved;

    const n = posts.length;
    const subject = `Post these yourself: ${narrativeTitle} (${n} ${n === 1 ? 'post' : 'posts'})`;

    const textBlocks = posts.map((p, i) => {
      const lines = [
        `${i + 1}. ${channelLabel(p.channel)}${p.when ? `, suggested ${p.when}` : ''}`,
        '',
        p.copy,
      ];
      if (p.firstComment) lines.push('', `FIRST COMMENT: ${p.firstComment}`);
      if (p.link && p.link !== p.firstComment) {
        lines.push('', `LINK (for ManyChat or your reply, never the caption): ${p.link}`);
      }
      if (p.media.length) lines.push('', `MEDIA: ${p.media.join('  ')}`);
      return lines.join('\n');
    });

    const text = [
      `${n} ${n === 1 ? 'post' : 'posts'} from "${narrativeTitle}" are ready for you to publish by hand.`,
      '',
      ...textBlocks.map((b) => `${b}\n\n${'-'.repeat(40)}`),
      '',
      'These are NOT scheduled. Nothing goes out until you post them.',
    ].join('\n');

    const html = `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:15px;line-height:1.6;color:#1f2a26;max-width:620px">
<p style="font-size:17px;margin:0 0 6px"><strong>${escapeHtml(narrativeTitle)}</strong></p>
<p style="margin:0 0 22px;color:#6f7a72">${n} ${n === 1 ? 'post' : 'posts'} ready for you to publish by hand. Nothing here is scheduled.</p>
${posts
  .map(
    (p, i) => `<div style="margin:0 0 26px;padding:0 0 22px;border-bottom:1px solid #e6e2dd">
<p style="margin:0 0 10px;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#6f7a72">${i + 1} · ${escapeHtml(channelLabel(p.channel))}${p.when ? ` · suggested ${escapeHtml(p.when)}` : ''}</p>
<div style="white-space:pre-wrap;background:#f6f4f1;border-radius:10px;padding:14px 16px;font-size:15px">${escapeHtml(p.copy)}</div>
${
  p.firstComment
    ? `<p style="margin:12px 0 0"><span style="font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#6f7a72">First comment</span><br><span style="white-space:pre-wrap">${escapeHtml(p.firstComment)}</span></p>`
    : ''
}
${
  p.link && p.link !== p.firstComment
    ? `<p style="margin:12px 0 0"><span style="font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#6f7a72">Link, for ManyChat or your reply</span><br><a href="${escapeHtml(p.link)}" style="color:#0f7d61;word-break:break-all">${escapeHtml(p.link)}</a></p>`
    : ''
}
${
  p.media.length
    ? `<p style="margin:12px 0 0"><span style="font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#6f7a72">Media</span><br>${p.media
        .map(
          (m) =>
            `<a href="${escapeHtml(m)}" style="color:#0f7d61;word-break:break-all">${escapeHtml(m)}</a>`
        )
        .join('<br>')}</p>`
    : ''
}
</div>`
  )
  .join('')}
<p style="margin:0;color:#6f7a72;font-size:13px">Long-press the grey block to select a whole post. The link is kept out of the body on purpose: it goes in the first comment.</p>
</div>`;

    /**
     * One email per recipient rather than one shared To: line, same reasoning as the CRM
     * ping: a shared header leaks the list and lands replies on people who did not ask.
     */
    const results = await Promise.allSettled(
      to.map((addr) => sendEmail({ to: addr, subject, html, text }))
    );
    const sent = results.filter(
      (r) => r.status === 'fulfilled' && r.value.status !== 'skipped'
    ).length;
    for (const r of results) {
      if (r.status === 'rejected') console.error('[hand-post] one send failed:', r.reason);
    }
    return { sent, skipped: sent === 0 ? 'every send failed or email is disabled' : null };
  } catch (err) {
    console.error('[hand-post] brief failed entirely:', err);
    return { sent: 0, skipped: 'threw' };
  }
}

/** Build a HandPost from a calendar entry. Kept pure and exported for its tests. */
export function handPostFromEntry(entry: CalendarEntry): HandPost {
  return {
    channel: entry.channel,
    copy: entry.post_copy ?? '',
    // Kept separate from the body on purpose: the link goes in the first comment, which is the
    // whole reason this field is separate from the copy he long-presses to select.
    firstComment: entry.first_comment?.trim() || undefined,
    link: entry.link?.trim() || undefined,
    media: entry.media ?? [],
    // 'YYYY-MM-DDTHH:mm:ss' to something readable, without pulling in a date library.
    when: entry.scheduled_at
      ? entry.scheduled_at.slice(0, 16).replace('T', ' ')
      : undefined,
  };
}
