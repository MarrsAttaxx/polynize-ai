import { notFound, redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/console-auth';
import { getNarrative } from '@/lib/marketing/narrative-store';
import { getPiece } from '@/lib/marketing/piece-store';
import { listEntries } from '@/lib/marketing/calendar-store';
import { isMetricoolConfigured } from '@/lib/marketing/metricool-client';
import {
  NETWORKS,
  getChannelSchedule,
  slotPrefersAt,
} from '@/lib/marketing/channel-schedule';
import {
  outputForMasterOnNetwork,
  slotKindFor,
  cardState,
  cardStateLabel,
  plansForTicks,
  masterCardLabel,
  masterDetail,
} from '@/lib/marketing/kit';
import { NarrativeGates, type WaveData } from './NarrativeGates';
import { connectedList } from '@/lib/marketing/connected-networks';
import { getBrandMap, type BrandMap } from '@/lib/marketing/metricool-config-store';

export const dynamic = 'force-dynamic';

/**
 * The narrative screen (D40): loads the narrative and whatever its CURRENT gate needs,
 * then hands over to the client component. Gate 4 needs the master pieces;
 * gate 5 and shipped need the wave as it actually sits on the calendar. Earlier
 * gates need nothing beyond the narrative, and this page deliberately does not load
 * what the gate on screen cannot show.
 */
export default async function NarrativePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return null;
  if (user.scope.type === 'client') {
    redirect(`/console/${user.scope.slug}/blueprint`);
  }
  const owner = user.email;

  let narrative;
  try {
    narrative = await getNarrative(id);
  } catch (err) {
    console.error('[narrative] read failed:', err);
    narrative = null;
  }
  if (!narrative) notFound();

  // Gate 4: the master pieces, video first because it is the long pole.
  // The kit's own plan, so each card can say where its posts land. Read from the persisted
  // ticks, the same source Gate 5 expands from, so the two can never disagree.
  const plans =
    narrative.gate === 4 || narrative.gate === 5 || narrative.gate === 'shipped'
      ? plansForTicks(narrative.kit ?? [], narrative.lane)
      : [];

  const pieces: {
    id: string;
    label: string;
    master: string;
    kind: string;
    href: string;
    /** Whether this card could ship, so Gate 4 stops showing seven identical rows (D47). */
    state: 'empty' | 'drafted' | 'ready';
    stateLabel: string;
    /**
     * WHERE THIS ONE GOES (D49). Marrs, looking at Gate 4: "I've got a list of the things I
     * need to do and work on, but I can't see what platform they refer to. Does that matter,
     * or is that saying that's agnostic at this point?"
     *
     * It is agnostic for exactly one card. The video script is one shoot that becomes ten
     * posts across all four networks, which is the whole shoot-once-cut-many economy. Every
     * other card lands on one place: the article and the three text frames are LinkedIn, the
     * carousel and the quote card are Instagram. So the answer is that it DOES matter, and the
     * card should say it rather than leave him counting.
     */
    /** Which networks its posts land on, for the platform marks on the card (D54). */
    networks: string[];
    /** How many posts it becomes. Only worth printing when it is more than one. */
    posts: number;
    /** How the thing is made, as a second line: the name says WHAT it is. */
    detail: string;
  }[] = [];
  if (narrative.gate === 4 || narrative.gate === 5 || narrative.gate === 'shipped') {
    for (const pid of narrative.piece_ids ?? []) {
      try {
        const p = await getPiece(owner, pid);
        if (!p) continue;
        const st = cardState(p.master ?? '', p);
        const plan = plans.find((x) => x.master === p.master);
        const posts = plan ? plan.outputs.length : 0;
        pieces.push({
          id: p.piece_id,
          /**
           * THE CANONICAL NAME, not the stored title (D54).
           *
           * `piece.title` is "<headline>: <whatever the card was called when it was created>", so
           * a piece made before the vocabulary was unified would keep showing "Quote card" until
           * its kit was re-confirmed. Reading the name off the master means every card is right
           * immediately and no migration is needed. The narrative's headline is already at the
           * top of the screen, so repeating it on every card was noise anyway.
           */
          label: masterCardLabel(p.master ?? ''),
          master: p.master ?? '',
          kind: p.kind ?? 'text',
          href: `/console/marketing/piece/${p.piece_id}`,
          state: st,
          stateLabel: cardStateLabel(p.master ?? '', st),
          networks: plan ? plan.placements.map((pl) => pl.network) : [],
          posts,
          detail: masterDetail(p.master ?? ''),
        });
      } catch (err) {
        console.error('[narrative] piece read failed:', err);
      }
    }
    pieces.sort((a, b) => {
      const rank = (k: string) => (k === 'video' ? 0 : k === 'image' ? 1 : 2);
      return rank(a.kind) - rank(b.kind);
    });
  }

  // Gates 5 and shipped: the wave as the calendar actually holds it.
  const wave: WaveData = {
    planned: false,
    cells: [],
    days: [],
    networks: [],
    count: 0,
    live: 0,
    auto: 0,
    manual: 0,
    handed: 0,
    fallback: 0,
    metricoolReady: isMetricoolConfigured(),
  };
  if (narrative.gate === 5 || narrative.gate === 'shipped') {
    try {
      const ids = new Set(narrative.piece_ids ?? []);
      const entries = (await listEntries(owner)).filter(
        (e) => e.piece_id && ids.has(e.piece_id) && e.scheduled_at
      );
      wave.planned = entries.length > 0;
      wave.count = entries.length;
      wave.live = entries.filter(
        (e) => e.status === 'scheduled' || e.status === 'published'
      ).length;
      // The wave now has two halves (D41): what Metricool schedules, and what he posts by
      // hand. The button cannot claim to ship the whole thing, so the gate counts both.
      wave.manual = entries.filter((e) => e.publish_mode === 'manual').length;
      wave.auto = entries.length - wave.manual;
      wave.handed = entries.filter((e) => e.publish_mode === 'manual' && e.handed_at).length;

      /**
       * The lane's slot table, so the grid can say WHICH slot each post landed in (D46).
       *
       * Without this the typed slots are invisible: the grid has days as columns and networks as
       * rows and no time-of-day dimension at all, so a video-preferring morning slot carrying a
       * text post looks exactly like a working one. Read live rather than stamped, because the
       * useful reading of a label is whether the table you are looking at now agrees with the
       * calendar you are looking at now.
       */
      const schedule = await getChannelSchedule(narrative.lane).catch((err) => {
        console.error('[narrative] slot table read failed:', err);
        return null;
      });

      const dayKeys = [...new Set(entries.map((e) => (e.scheduled_at ?? '').slice(0, 10)))].sort();
      const dayLabel = (d: string) => {
        const dt = new Date(`${d}T00:00:00`);
        return dt.toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric' });
      };
      wave.days = dayKeys.map(dayLabel);
      wave.networks = NETWORKS.filter((n) => entries.some((e) => e.channel === n));

      /**
       * A readable chip per entry, named from the CATALOGUE rather than from a second copy of
       * its vocabulary. The old map here spelled the six v1 masters out again and defaulted
       * everything else to "Post", so the moment the kit named a frame this screen would still
       * have shown three chips reading "Post 1 Post 2 Post 3" against a Gate 3 that promised
       * Contrarian, Hard moment and Rules. One vocabulary, one place.
       */
      const masterOf = new Map<string, { master: string; kind: string }>();
      for (const p of pieces) masterOf.set(p.id, { master: p.master, kind: p.kind });
      const seq = new Map<string, number>();
      for (const e of [...entries].sort((a, b) =>
        (a.scheduled_at ?? '').localeCompare(b.scheduled_at ?? '')
      )) {
        const m = masterOf.get(e.piece_id ?? '');
        const key = `${e.channel}:${m?.master ?? 'x'}`;
        const n = (seq.get(key) ?? 0) + 1;
        seq.set(key, n);
        /**
         * Named from the output ON THIS CHANNEL, not from the master.
         *
         * outputForMaster returns the FIRST catalogue entry on a master, so once the shorts master
         * served LinkedIn as well, the LinkedIn video would have been labelled "Reel 1" on the
         * LinkedIn row. Position in the catalogue array cannot fix that, because the label is keyed
         * by master.
         */
        const output = m ? outputForMasterOnNetwork(m.master, e.channel) : undefined;
        const name = output ? output.postLabel : 'Post';
        // Number only where there is genuinely more than one of the same thing on a channel: a
        // series of three cuts. A single typed post is named, so a "1" after it says nothing.
        const numbered = n > 1 || (output?.series ? true : false);
        const at = (e.scheduled_at ?? '').slice(11, 16);
        const prefers =
          schedule && e.scheduled_at ? slotPrefersAt(schedule, e.channel, e.scheduled_at) : 'any';
        const kind = output ? slotKindFor(output.master) : undefined;
        wave.cells.push({
          day: dayLabel((e.scheduled_at ?? '').slice(0, 10)),
          network: e.channel,
          label: numbered ? `${name} ${n}` : name,
          video: m?.kind === 'video',
          manual: e.publish_mode === 'manual',
          at,
          prefers,
          // A still post in the video slot, or the reverse. Shown rather than hidden, because a
          // Rules post at 08:30 with no explanation reads as a feature that did not work.
          fallback: prefers !== 'any' && kind !== undefined && prefers !== kind,
        });
      }
      wave.fallback = wave.cells.filter((c) => c.fallback).length;
    } catch (err) {
      console.error('[narrative] wave read failed:', err);
    }
  }

  /**
   * WHICH PLATFORMS THIS LANE CAN ACTUALLY POST TO (D78), read from the brand's own Metricool
   * profile. Degrades to null on every failure path, which shows every network: hiding work over a
   * failed config read would be worse than offering a platform he cannot post to.
   */
  const brandMap = await getBrandMap().catch(() => ({}) as BrandMap);
  const connected = await connectedList(brandMap[narrative.lane]).catch(() => null);

  return (
    <NarrativeGates
      initial={narrative}
      pieces={pieces}
      wave={wave}
      connectedNetworks={connected}
    />
  );
}
