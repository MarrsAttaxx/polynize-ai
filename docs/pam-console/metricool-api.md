# Metricool REST API — reference for the publishing tail (D18/D24)

**The console reaches Metricool via its REST API (not the MCP), server-side, with a token. Extracted 2026-07-09 from Metricool's official docs + the open-source `Purple-Horizons/metricool-cli` source (the authoritative working payloads; D18's named fallback). Use this to build publishing Step 2.**

## Base + auth
- **Base URL:** `https://app.metricool.com/api`
- **Auth header:** `X-Mc-Auth: <token>` (the API access token; Advanced/Custom plans only).
- **Every request also needs, as query params:** `userId` (the account's user id) and, for brand-scoped calls, `blogId` (the brand id).
- **Env (in Vercel):** `METRICOOL_USER_TOKEN`, `METRICOOL_USER_ID`. The per-brand `blogId`s are **discovered via the API** (see list-brands), then mapped to our streams in-console, so they are NOT env vars.

## Endpoints we use
| Purpose | Method + path | Notes |
|---|---|---|
| List brands | `GET /admin/simpleProfiles` | Returns the account's brands; each carries its `blogId`. Field names to confirm on first real call (defensive parse: blogId/id, label/title/name). |
| Best time to publish | `GET /planner/best-time-to-publish` (needs `blogId`) | Feeds Raph's scheduling suggestions (Step 3). |
| Schedule / create post | `POST /v2/scheduler/posts` (needs `blogId`, `userId`) | Body below. |
| Update post | `PUT /v2/scheduler/posts/{id}` | Same body shape (partial). |
| Delete post | `DELETE /v2/scheduler/posts/{id}` | |
| Calendar events | `GET /v2/scheduler/calendar/events` | (read) |
| List scheduled posts | `GET /v2/scheduler/posts` (needs `blogId`, `start`, `end` as full datetimes, `timezone`) | **The url join (D98):** each post carries `id` (Metricool's integer, our `external_ref`) and `providers[]` with `network` and `publicUrl` once published. `lib/marketing/url-join.ts` reads it nightly. |

## Create-post body (the exact shape — note `providers` are OBJECTS)
```json
{
  "text": "the post copy",
  "providers": [{ "network": "linkedin" }, { "network": "instagram" }],
  "publicationDate": { "dateTime": "2026-07-14T09:00:00", "timezone": "America/New_York" },
  "draft": false,
  "autoPublish": true,
  "media": ["https://.../image.jpg"],
  "firstCommentText": "optional first comment",
  "linkedinData": { "type": "..." },
  "instagramData": { "type": "...", "collaborators": [{ "username": "handle" }] }
}
```
- **`providers` = array of `{ network }` objects**, NOT strings. This is the exact bug D18 flagged in Metricool's MCP (`["linkedin"]`); sending REST directly, we control this and send objects. Load-bearing.
- **`publicationDate.dateTime`** = `YYYY-MM-DDTHH:mm:ss` **local wall-clock, no `Z`/milliseconds**, paired with **`timezone`** (IANA, e.g. `Australia/Sydney`). Pass the intended local time as-is; do not convert to UTC.
- **`autoPublish`** = `!draft`. `draft: true` parks it unpublished.
- **`media`** = array of image/video URLs.

## Per-network options, read off the spec 1 September 2026 (D80)

`POST /v2/scheduler/posts` takes the full `ScheduledPost` schema, 43 properties. We send eight. The ones that matter and are still unused:

| Field | What it carries | Why it matters here |
|---|---|---|
| `youtubeData.title` | The video title, plus `privacy`, `tags`, `category`, `playlistId`, `madeForKids` | **Sent, with `madeForKids: false` (D81).** Their validator requires both: a title "shorter than 100 characters" with no `<` or `>`, and an audience declaration. **The title is the post's own first line** (D82), trimmed at a word boundary, shown on the caption screen so it is never a silent guess. `type` is NOT sent: a vertical file must publish as a Short and the token for that is undocumented (see below). |
| `tiktokData.title` | Plus `photoCoverIndex`, `disableComment/Duet/Stitch`, `privacyOption`, `music`, `autoAddMusic` | Not sent. TikTok's caption is `text`, so the absence is not a wrong post. |
| `linkedinData` | `type`, `documentTitle`, **`publishImagesAsPDF`**, `previewIncluded`, `poll` | **This is evidence the blocked document carousel is possible.** `publishImagesAsPDF` means Metricool will turn images into a document post, which was the unverified half of why that row is off. The other half, that this console has no PDF generation, still stands. |
| `instagramData` | `type`, `showReelOnFeed`, `collaborators`, `tags`, `audioName`, `isAiGenerated` | **`type: 'REEL'` is sent whenever the post carries a video (D81)**, because Instagram refuses a single-video post otherwise: "Instagram does not allow single-video posts. Change the Instagram post type to REEL." `showReelOnFeed` and collaborator tags are still unsent. |
| `videoThumbnailUrl`, `videoCoverMilliseconds` | The cover for a video post | Not sent. This is the API-level way to honour the house rule that the first frame is the cover. |
| `mediaAltText` | Alt text per media item | Not sent. |
| `saveExternalMediaFiles` | Whether Metricool copies the file rather than hot-linking it | Unknown default. Worth knowing, since every file we send is a Box link. |

**The `type` tokens, read off real posts through the probe (D84). No enum for any of them is documented, and THE CASE IS NOT CONSISTENT, so copy these rather than assume:**

| Field | Value | Note |
|---|---|---|
| `youtubeData.type` | `short` | **lowercase.** Required for a vertical file; without it: "Invalid video orientation, only horizontal is allowed". The landscape token is unknown, and unnecessary: the default accepts horizontal. |
| `youtubeData.privacy` | `public` | lowercase. Sent explicitly rather than trusting an unseen default. |
| `youtubeData.category` | `SCIENCE_TECHNOLOGY` | UPPER. Their composer sends it; we do not, and it defaults. |
| `instagramData.type` | `REEL` | UPPER. Required for a single-video post. |
| `instagramData.showReelOnFeed` | `true` | Puts the Reel on the profile grid too. |
| `linkedinData.type` | `POST` | UPPER. Metricool defaults it. |
| `tiktokData.privacyOption` | `PUBLIC_TO_EVERYONE` | UPPER. **REQUIRED, and their form validator does not say so.** Without it the publisher fails with "does not specified privacy options" and their composer shows the field as `planner.planner.presets.tiktok.privacyStatus.null`. |
| `instagramData.autoPublish` | `true` | Sent as `!draft`. If their default is false an Instagram post becomes a phone reminder rather than a publish, which looks identical to a post that never went out. |

`/console/marketing/metricool/probe` section 5 reads these back off real scheduled posts, which is how they were obtained. Use it again rather than guessing a new one.

**EVERY DATE PARAMETER IS A FULL ISO DATETIME, whatever it is called.** Learned twice, the hard way, so it is a rule now rather than a per-endpoint discovery:

| Endpoint family | Parameter names | Format |
|---|---|---|
| `/v2/analytics/*` | `from`, `to` | `yyyy-MM-dd'T'HH:mm:ss` |
| `/v2/scheduler/posts` (list) | `start`, `end` | `yyyy-MM-dd'T'HH:mm:ss` |
| `/v2/scheduler/besttimes/{provider}` | `start`, `end` | dates accepted |

The NAMES differ per family and the format does not. A bare date returns a 400 that names the field and the expected pattern, which is a good failure, but it costs a round trip: send `T00:00:00` and `T23:59:59` and it never happens. (D78 was the analytics half of this; D83's follow-up was the scheduler half.)

**THEIR COMPOSER IS A BETTER SOURCE THAN THEIR SPEC.** Assemble the post by hand in Metricool's own UI and it lists every validation our payload is failing, in words. That is how all of D81 was found, and it beats reading schema.

**BUT ITS SILENCE IS NOT A GUARANTEE.** TikTok raised no error in that composer and then failed at publish time for a missing privacy option (D84). Their form validates less than their publisher does. Treat a clean composer as "no known problem", not as "this will post".

## Network mapping (our channel id -> Metricool network)
Metricool networks: linkedin, facebook, instagram, gbp, twitter, tiktok, youtube, pinterest, threads, bluesky.
- linkedin -> `linkedin`, instagram -> `instagram`, tiktok -> `tiktok`, youtube -> `youtube`
- **x -> `twitter`** (Metricool still uses `twitter`)
- **substack, newsletter -> not Metricool networks** (published elsewhere; skip in the Metricool call).

## No queue endpoint + timezone gotcha (confirmed 2026-07-09)
- **No queue / time-slot / autoschedule endpoint.** The API creates a post at a specific `publicationDate`, and `/planner/best-time-to-publish` returns analytics. There is no "add to the brand's queue / next slot" call. Re-confirmed 28 August 2026 against their full spec: 528 paths, none of them a queue. So the **queue is computed console-side**, and since D79 it lives in ONE place: per-network times per lane in `pam/channel-schedule/{lane}.json`, edited on Connect Metricool, read by both "Add to queue" and the wave. Take the next open slot on that channel, then create the post at that concrete time. (Before D79 this said `posting-schedule.json`, which held a second per-stream slot list that nothing read.)
- **Timezone:** Metricool defaults a brand to **Europe/Madrid**. A post sent as 9am `Australia/Sydney` displayed as ~1am. Send each stream's configured tz AND set the brand's timezone in Metricool to match (Sydney). Their docs example: `"timezone": "Europe/Madrid"`.

## Build notes
- Client: `lib/marketing/metricool-client.ts` (mirrors `resend-client.ts`: lazy config, skip-when-unconfigured). Built inert until the env vars land.
- Brand mapping: a `/console/marketing/settings` (or per-stream) surface lists brands via `/admin/simpleProfiles` and maps each stream to a `blogId`, stored as console config (not env). One-time setup.
- **D18 schedule test (gate):** before relying on publishing, schedule one real post to a test channel and confirm it lands. Timezone default should be Marrs's (Australia/Sydney), not the CLI's `America/New_York`.

---

## The OpenAPI spec exists, and it is the source of truth (25 August 2026)

**`https://app.metricool.com/api/swagger.json`** is Metricool's complete OpenAPI 3.0.1 spec, 527 paths, linked from their own public docs page at `https://app.metricool.com/resources/apidocs/index.html`. Read it before inferring anything about their API.

**It caught a live wrong path in our own client.** `bestTimes()` called `/planner/best-time-to-publish`; grepping the spec for "planner" returns nothing. The documented path is `GET /v2/scheduler/besttimes/{provider}` (provider in facebook, instagram, tiktok, linkedin, youtube; params start, end, timezone), which also means there is no single call for a whole brand: the slot table has to be assembled network by network. Nothing called it yet, which is the only reason it had never 404'd. Fixed.

**Per-post analytics are real and typed.** See `docs/pam-console/todo.md` item 8 for the endpoint list, the four things a single authenticated call must confirm, and the constraints (Europe/Madrid default on every call, no published rate limits, no per-post lookup, half-documented pagination, and the fact that we must store our own snapshots because Metricool holds no notion of our narratives).

