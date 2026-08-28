/**
 * WHICH PLATFORMS A BRAND ACTUALLY HAS CONNECTED (D78).
 *
 * Marrs: "In Gate 3 how do we only show platforms that the user is subscribed to in Metricool? We
 * can do this manually if needed."
 *
 * It does not need to be manual. `/admin/simpleProfiles`, which the Connect page already calls,
 * returns a per-platform field on every brand and a non-null value means connected. His own
 * Polynize brand came back with `instagram: "polynize.ai"`, `tiktok: "polynize.ai"`,
 * `linkedinCompany: "urn:li:organization:18565952"` and `youtube: null`, which is the whole answer
 * sitting in a response we were already making.
 *
 * Confirmed against their OpenAPI spec rather than inferred from one screenshot: the `PublicBlog`
 * schema carries twelve platform fields, all typed string.
 *
 * LINKEDIN NEEDS THREE FIELDS, not one. There is no plain `linkedin`: a company page arrives as
 * `linkedinCompany`, and a personal profile as `inUserId` or `linkedInUserProfileURL`. Checking only
 * the company field would have hidden LinkedIn on every personal lane, which is four of five people
 * here and the one platform Marrs cares most about.
 *
 * IT FAILS OPEN, ALWAYS. If Metricool is not configured, the brand is not mapped, the call fails, or
 * the brand is simply absent, every network is treated as available. Hiding a platform because a
 * config call timed out would silently remove work from the kit, and the operator would have no way
 * to tell that from "we decided not to post there".
 */

import { listBrands } from './metricool-client';
import type { Network } from './channel-schedule';

/**
 * The fields that mean "this network is wired up", per network we post to.
 *
 * Any one of them being a non-empty string is enough. Metricool has fields for platforms we do not
 * touch (twitch, gmb, pinterest, bluesky, threads); they are left out because a network we never
 * post to cannot be filtered out of a kit that never offers it.
 */
const NETWORK_FIELDS: Record<Network, string[]> = {
  linkedin: ['linkedinCompany', 'inUserId', 'linkedInUserProfileURL'],
  instagram: ['instagram'],
  tiktok: ['tiktok'],
  youtube: ['youtube'],
};

const NETWORKS = Object.keys(NETWORK_FIELDS) as Network[];

/**
 * Cached, because Gate 3 renders often and a brand's connections change roughly never.
 *
 * Ten minutes: long enough that clicking through the gates costs one call, short enough that
 * connecting a platform in Metricool shows up in the console while he is still thinking about it.
 */
const TTL_MS = 10 * 60 * 1000;
let cache: { at: number; byBlogId: Map<string, Set<Network>> } | null = null;

/** True when the value is a real connection rather than a null or an empty string. */
function present(v: unknown): boolean {
  return typeof v === 'string' ? v.trim().length > 0 : typeof v === 'number';
}

/** Read one brand's raw profile into the set of networks it can post to. */
export function networksFromProfile(raw: unknown): Set<Network> {
  const out = new Set<Network>();
  if (!raw || typeof raw !== 'object') return out;
  const o = raw as Record<string, unknown>;
  for (const n of NETWORKS) {
    if (NETWORK_FIELDS[n].some((f) => present(o[f]))) out.add(n);
  }
  return out;
}

/**
 * The networks a stream's brand has connected, or `null` when we genuinely do not know.
 *
 * `null` and an empty set mean different things and the caller must be able to tell them apart:
 * null is "no answer, show everything", empty is "answered, and this brand has nothing connected".
 */
export async function connectedNetworks(blogId?: string): Promise<Set<Network> | null> {
  if (!blogId) return null;

  const fresh = cache && Date.now() - cache.at < TTL_MS ? cache : null;
  if (fresh) return fresh.byBlogId.get(blogId) ?? null;

  let brands: Awaited<ReturnType<typeof listBrands>>;
  try {
    brands = await listBrands();
  } catch (e) {
    /**
     * FAILS OPEN. A brand list we cannot read must not remove rows from the kit: the operator would
     * see fewer platforms with nothing to say why, which is worse than showing one he cannot post to
     * and finding out at Gate 5.
     */
    console.error(
      `[connected-networks] brand list failed, treating every network as available: ${
        e instanceof Error ? e.message : String(e)
      }`
    );
    return null;
  }

  const byBlogId = new Map<string, Set<Network>>();
  for (const b of brands) {
    if (b.blogId) byBlogId.set(String(b.blogId), networksFromProfile(b.raw));
  }
  cache = { at: Date.now(), byBlogId };
  return byBlogId.get(blogId) ?? null;
}

/**
 * Whether to show a kit row for this network.
 *
 * The rule is one line and it lives here so the gate and its tests read the same one: unknown shows
 * everything, known shows only what is connected.
 *
 * Takes an ARRAY rather than the Set above, because the gate is a client component and a Set cannot
 * cross that boundary as a prop: React would hand it over as an empty object and every network would
 * silently disappear. `connectedList` is what converts, on the server side of the line.
 */
export function networkAvailable(connected: readonly string[] | null, network: string): boolean {
  if (!connected) return true;
  return connected.includes(network);
}

/** The server-side shape for a prop: an array, or null when we do not know. */
export async function connectedList(blogId?: string): Promise<string[] | null> {
  const set = await connectedNetworks(blogId);
  return set ? [...set] : null;
}
