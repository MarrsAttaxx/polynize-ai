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

## Network mapping (our channel id -> Metricool network)
Metricool networks: linkedin, facebook, instagram, gbp, twitter, tiktok, youtube, pinterest, threads, bluesky.
- linkedin -> `linkedin`, instagram -> `instagram`, tiktok -> `tiktok`, youtube -> `youtube`
- **x -> `twitter`** (Metricool still uses `twitter`)
- **substack, newsletter -> not Metricool networks** (published elsewhere; skip in the Metricool call).

## No queue endpoint + timezone gotcha (confirmed 2026-07-09)
- **No queue / time-slot / autoschedule endpoint.** The API creates a post at a specific `publicationDate`, and `/planner/best-time-to-publish` returns analytics. There is no "add to the brand's queue / next slot" call. So the **queue is computed console-side** (per-stream ideal-time slots in `posting-schedule.json`; append to the next open slot; then create the post at that concrete time).
- **Timezone:** Metricool defaults a brand to **Europe/Madrid**. A post sent as 9am `Australia/Sydney` displayed as ~1am. Send each stream's configured tz AND set the brand's timezone in Metricool to match (Sydney). Their docs example: `"timezone": "Europe/Madrid"`.

## Build notes
- Client: `lib/marketing/metricool-client.ts` (mirrors `resend-client.ts`: lazy config, skip-when-unconfigured). Built inert until the env vars land.
- Brand mapping: a `/console/marketing/settings` (or per-stream) surface lists brands via `/admin/simpleProfiles` and maps each stream to a `blogId`, stored as console config (not env). One-time setup.
- **D18 schedule test (gate):** before relying on publishing, schedule one real post to a test channel and confirm it lands. Timezone default should be Marrs's (Australia/Sydney), not the CLI's `America/New_York`.
