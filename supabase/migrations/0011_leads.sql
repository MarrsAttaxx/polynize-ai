-- ---------------------------------------------------------------------------
-- leads: inbound prospects from the polynize.ai capability blueprint funnel.
--
-- When a visitor completes /blueprint they give a name and email on the final
-- step. That becomes a lead here, linked to the blueprint they generated. This
-- is the system of record the leads agent (Leo) pulls from via GET /api/leads,
-- and the staging point for the eventual kit.com newsletter sync.
--
-- One row per email (upsert on conflict): a returning visitor updates their
-- existing lead rather than creating a duplicate.
--
-- Accessed only through the service-role client (lib/supabase.ts), which
-- bypasses RLS. RLS is enabled with no public policy, so the anon key cannot
-- read or write leads directly. The agent reaches them through the bearer-authed
-- API route, never the database.
-- ---------------------------------------------------------------------------
create table if not exists leads (
  id           uuid primary key default gen_random_uuid(),
  email        text not null unique,
  name         text,
  business     text,
  -- The blueprint this lead generated. Null-safe so deleting a blueprint keeps the lead.
  blueprint_id uuid references sales_blueprints(id) on delete set null,
  source       text not null default 'blueprint',
  -- When this lead was pushed to kit.com. Null = not yet synced. Lets the agent
  -- pull only new leads without reprocessing.
  synced_at    timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists leads_synced_at_idx on leads (synced_at);
create index if not exists leads_created_at_idx on leads (created_at desc);

alter table leads enable row level security;
