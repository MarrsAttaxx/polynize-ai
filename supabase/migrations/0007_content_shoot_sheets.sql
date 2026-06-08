-- content_shoot_sheets: persistence for the /content/<show>/<episode> shoot sheets.
--
-- Temporary semi-build ahead of the real content-system integration. One row
-- per content slug. `episode_id` is the URL-aligned slug "<show>/<episode>"
-- (e.g. "pam/ep00") so it is unique across shows and maps 1:1 to the route.
--
-- `state` jsonb mirrors the migratable shape the front end reads/writes:
--   {
--     "episode_id": "ep00",            -- episode within the show
--     "show": "pam",
--     "prep":    { "date": "", "wardrobe": "", "location": "", "hours": "" },
--     "scripts": { "say.hook1": { "text": "", "edited": false }, ... },
--     "shots":   { "shot01": { "done": false, "filename": "", "description": "" }, ... },
--     "checks":  { "chk.upload": false, ... }
--   }
-- This maps cleanly onto the future content schema: scripts -> episode package,
-- shots.{filename,description} -> B-Roll Bank entries, prep -> continuity tags.
--
-- All access is server-side via the service-role key (see lib/supabase.ts).
-- RLS is enabled with no policy, so anon/auth roles get nothing; the service
-- role bypasses RLS.

create table if not exists content_shoot_sheets (
  episode_id  text primary key,
  state       jsonb not null default '{}'::jsonb,
  updated_at  timestamptz not null default now()
);

alter table content_shoot_sheets enable row level security;
