# Content Format Matrix — owner × channel × format × funnel tier

**What content we make, on which channels, for which owner, at which funnel stage.**
**Version 1.0 · July 2026 · Internal · For: the PAM Console build agent · Owner: Marrs Coiro**

> Canonical copy synced into the build docs from Marrs's source. This is the *production surface* the console must support (what/where/for-whom); the UX Flow spec defines the *process*, the pillar library defines the *styles*. See `storage-and-agent-socket.md` D2.1 for how a piece (production unit) fans out to channels (publish units).

---

## Why this exists

The console must support the full surface of content we actually produce. This matrix defines that surface: every **owner**, the **channels** they publish on, the **formats** that run on each channel, and the **funnel tier** each format serves.

**Vocabulary (locked):**
- **Owner** = whose content it is (Marrs, Polynize brand, Shourov, Team). Console is multi-tenant per owner; all owners publish to one shared output calendar.
- **Channel** = the platform (Instagram, TikTok, YouTube, LinkedIn, X, Substack, newsletter).
- **Format** = the *type* of content (short-form video, carousel, long-form text). The level at which the production pipeline generalises (the swappable middle).
- **Content pillar** = a recurring *style within* a format (e.g. "Marrs Attacks", "Show and Tell"). Lives in the pillar library; noted where confirmed.
- **Funnel tier** = TOP (awareness) · MID (nurture) · BOTTOM (trust / book a call). Personal-brand content is often awareness/education, not strictly funnelled.

---

## Owner → channel map

| Owner | Channels | Register / purpose |
|---|---|---|
| **Marrs** | Personal: Instagram, TikTok · Professional: YouTube, LinkedIn | Personal = education / visibility (post-AI-humanity, general audience). Professional = business / thesis (founders, operators, execs). |
| **Polynize (brand)** | LinkedIn, YouTube (first) | Lead-gen + awareness for the brand. |
| **Shourov** | LinkedIn (+ X later) | Founder thought-leadership, his own concepts/pillars. |
| **Team** | LinkedIn (amplification) | Re-voiced brand content, per person's brand-voice doc. |

---

## The matrix

`[dev]` = a developing/not-yet-active combination. Formats are only *selectable in the console* once their production module exists (currently only short-form video is proven).

### Owner: Marrs
| Channel | Format | Funnel tier | Notes |
|---|---|---|---|
| Instagram | Short-form video (Reel) | TOP | Personal / education register |
| Instagram | Image carousel | MID | Personal |
| Instagram | Single image | MID | Reuse where it fits |
| TikTok | Short-form video (Reel) | TOP | Personal + **Marrs Attacks** pillar |
| TikTok | Short-form video | TOP | Marrs Attacks (reaction/commentary) |
| YouTube | Short-form video (Shorts) | TOP | Professional / thesis |
| YouTube | Medium video (3-5 min) | MID | Professional; current hard-focus format |
| YouTube | Long-form video | BOTTOM | `[dev]` — podcast pillar, series two |
| LinkedIn | Short-form video | TOP | Professional + **Marrs Attacks** pillar |
| LinkedIn | Long-form text + image | MID | Thesis / build-in-public |
| LinkedIn | PDF / document carousel | MID | Professional |

### Owner: Polynize (brand)
| Channel | Format | Funnel tier | Notes |
|---|---|---|---|
| LinkedIn | Short-form video | TOP | From the short-form master |
| LinkedIn | PDF / document carousel | MID | Built in alpha |
| LinkedIn | Long-form text + image | MID | To confirm |
| LinkedIn | Single image | MID | Reuse where it fits |
| YouTube | Short-form video (Shorts) | TOP | ~locked in alpha (90%) |
| YouTube | Medium video (3-5 min) | MID | In active production (alpha) |
| YouTube | Long-form video | BOTTOM | `[dev]` — podcast pillar, series two |
| (owned) | Newsletter | MID | Kit.com; nurture spine `[dev]` |
| Substack | Long-form written | BOTTOM | A written derivation of the concept |

### Owner: Shourov
| Channel | Format | Funnel tier | Notes |
|---|---|---|---|
| LinkedIn | Short-form video | TOP | `[dev]` — his pillars TBD |
| LinkedIn | Long-form text + image | MID | `[dev]` |
| LinkedIn | PDF / document carousel | MID | `[dev]` |
| X | (formats TBD) | TOP | `[dev]` — later |

*Shourov defines his own concepts + pillars (via April's interview). Rows are the likely surface; his to confirm.*

### Owner: Team
| Channel | Format | Funnel tier | Notes |
|---|---|---|---|
| LinkedIn | Share + personal-perspective repost | AMPLIFICATION | Re-voiced brand content via brand-voice docs + Slack alert |

#### Team amplification flow (design task — later phase, agent-triggered)

The intended flow, to design when we reach it:
1. **Calendar as a shareable URL** posted in team Slack, so everyone sees when content is going out.
2. On a piece going live, an **automatic trigger**: an agent (April's re-voicing skill) takes the published piece and drops an alert into a Slack channel (e.g. `#content-posting`) **per person** — each with (a) a link to the post and (b) copy-ready text that reframes the concept in *that person's* brand voice (from their brand-voice doc).
3. The person: copy the text → click the link → LinkedIn → Share → light edit → post.

So the human action is one-click-copy + a quick edit; the re-voicing and the Slack fan-out are the agent's job. Depends on: per-person brand-voice docs, the publish trigger (Raph), and a Slack integration. Not Phase 1.

---

## The format catalogue (channel-agnostic) — the swappable-middle registry

| Format | Production module status | Runs on |
|---|---|---|
| **Short-form video** (vertical) | ✅ Proven (alpha) | IG, TikTok, YouTube Shorts, LinkedIn |
| **Medium video** (3-5 min) | 🔨 In production (alpha) | YouTube |
| **Long-form video** | `[dev]` — series two (podcast pillar) | YouTube |
| **Image carousel** | ✅ Built (alpha, pre-refinement) | Instagram |
| **PDF / document carousel** | ✅ Built (alpha, pre-refinement) | LinkedIn |
| **Long-form text + image** | `[dev]` | LinkedIn |
| **Single image** | ✅ (simple) | IG, LinkedIn |
| **Newsletter** | `[dev]` — Kit.com | Owned list |
| **Long-form written** | `[dev]` | Substack |
| **Share/repost copy** | 🔨 (April skill) | LinkedIn (team) |

---

## How the console uses this

1. **Format-variations selection** (UX Flow §5.2): the selectable list = formats whose production module exists, filtered by the owner's channels.
2. **Shared output calendar** (UX Flow §4.4): every produced piece lands here tagged owner + channel + format.
3. **Pillar library** (UX Flow §4.7): pillars (Marrs Attacks, Show and Tell) are styles *within* formats; this matrix is the format layer, the library is the style layer on top.
4. **Multi-tenant**: per-owner; build Marrs-first, same structure tenanted per login.

---

## Honest gaps

- Only **short-form video** has a proven production module; **medium video** is in progress. Everything `[dev]` needs its module engineered before it's selectable.
- **Shourov's** rows are indicative; he confirms his own concepts/pillars/channels.
- **Newsletter (Kit.com)** and **Substack** integrations are not built (note: Kit.com already has a partial integration in the repo for lead sequences).
- Publishing (Blotato) not yet wired; confirm Blotato posts to each channel (TikTok flagged).
- **Marrs Attacks** placement (LinkedIn + TikTok) is **provisional** — it reads personal/satirical, but LinkedIn is Marrs's professional channel, so the fit is slightly awkward. It lives in the pillar library and is easily adjusted; don't block on it. Other pillars TBD.

---

*Polynize Pty Ltd · Content Format Matrix v1.0 · July 2026 · Internal.*
