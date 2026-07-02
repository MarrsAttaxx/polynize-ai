-- Marketing console (PAM pivot) — the console's app-data tables.
--
-- See docs/pam-console/storage-and-agent-socket.md (D2/D2.1/D4). Division:
--   Supabase (here) = console app data, queryable by the Dashboard.
--   Lightsail 'polynize-agents' bucket = agent-shared state (concept bank,
--     brand-voice docs, pattern library) + heavy media, prefix-partitioned
--     by owner. Supabase keeps only lightweight INDEX rows (e.g. concepts).
--
-- owner_id is non-null on every content row from day one (multi-tenant by
-- design; build Marrs-first). No permissions layer / RLS policy yet.
--
-- All access is server-side via the service-role key (lib/supabase.ts). RLS is
-- enabled with no policy so anon/auth get nothing; the service role bypasses it.
--
-- NOTE: Phase 1 (the Script screen) runs on the existing content_shoot_sheets
-- table via an owner-scoped key, so it works BEFORE this migration is applied.
-- Applying this migration lets the piece store swap to content_pieces with no
-- screen rework.

-- The production unit: one row per (owner, concept, framing, format, pillar).
create table if not exists content_pieces (
  id                  uuid primary key default gen_random_uuid(),
  owner_id            text not null,
  stream              text,
  title               text,
  concept_ref         text,                 -- -> concepts.id / bucket key
  framing             text,
  format              text not null,        -- short_form_video | medium_video | carousel | ...
  pillar              text,
  current_stage       text,
  status              text not null default 'draft',
  descript_project_id text,                 -- links a piece to its Descript project across stages
  stage_state         jsonb not null default '{}'::jsonb,  -- the swappable middle payload
  scheduled_at        timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index if not exists content_pieces_owner_idx on content_pieces (owner_id);
create index if not exists content_pieces_stage_idx on content_pieces (current_stage);

-- Concept INDEX. The doc BODY lives in the bucket (pam/concept-bank/{owner}/);
-- body_md is a Phase-1 interim home until the bucket is wired.
create table if not exists concepts (
  id          uuid primary key default gen_random_uuid(),
  owner_id    text not null,
  concept     text,
  framing     text,
  bucket_key  text,
  body_md     text,                         -- interim only
  status      text not null default 'draft',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists concepts_owner_idx on concepts (owner_id);

-- Pillar index (blueprint = format module + treatment sub-modules + specifics).
create table if not exists pillars (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  format      text,
  state       text not null default 'developing',  -- active | developing
  blueprint   jsonb not null default '{}'::jsonb,
  owner_id    text,                                -- null = brand-level
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Parked ideas (front of the content funnel).
create table if not exists ideas (
  id          uuid primary key default gen_random_uuid(),
  owner_id    text not null,
  stream      text,
  title       text,
  notes       text,
  status      text not null default 'parked',
  created_at  timestamptz not null default now()
);

-- Treatment Map rows (Phase 2). Keyed to a stable transcript-text anchor, not
-- a timecode, so re-anchoring after an edit is a match, not a re-index.
create table if not exists treatment_rows (
  id             uuid primary key default gen_random_uuid(),
  piece_id       uuid not null references content_pieces (id) on delete cascade,
  ord            int not null,
  segment_anchor text,
  line_text      text,
  treatment      jsonb not null default '{}'::jsonb,
  broll_concept  text,
  updated_at     timestamptz not null default now()
);
create index if not exists treatment_rows_piece_idx on treatment_rows (piece_id, ord);

-- Publish units: one row per (piece x channel). Per-channel mechanical variant
-- (crop/caption/register) rides in `variant`.
create table if not exists calendar_entries (
  id           uuid primary key default gen_random_uuid(),
  piece_id     uuid not null references content_pieces (id) on delete cascade,
  owner_id     text not null,
  channel      text not null,
  scheduled_at timestamptz,
  status       text not null default 'draft',  -- draft | scheduled | published
  variant      jsonb,
  external_ref text,                            -- Blotato post id
  created_at   timestamptz not null default now()
);
create index if not exists calendar_entries_owner_idx on calendar_entries (owner_id);
create index if not exists calendar_entries_sched_idx on calendar_entries (scheduled_at);

-- The agent socket's async backbone: submit -> job_id -> status.
create table if not exists jobs (
  id          uuid primary key default gen_random_uuid(),
  piece_id    uuid references content_pieces (id) on delete cascade,
  owner_id    text not null,
  stage       text,
  agent       text,
  status      text not null default 'queued',  -- queued | running | done | failed
  input_ref   text,
  output_ref  text,
  error       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists jobs_status_idx on jobs (status);

alter table content_pieces   enable row level security;
alter table concepts         enable row level security;
alter table pillars          enable row level security;
alter table ideas            enable row level security;
alter table treatment_rows   enable row level security;
alter table calendar_entries enable row level security;
alter table jobs             enable row level security;
