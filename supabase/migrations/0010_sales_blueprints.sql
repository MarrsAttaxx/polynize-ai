-- ---------------------------------------------------------------------------
-- sales_blueprints: persisted client working-session capability maps generated
-- at /blueprint. Standalone from the /agents `blueprints` table (which is tied
-- to a session row). A row here is addressable at /blueprint/<id> so a map can
-- be shared with a client.
--
-- Accessed only through the service-role client (lib/supabase.ts), which
-- bypasses RLS. RLS is enabled with no public policy, so the anon key cannot
-- read or write these rows directly.
-- ---------------------------------------------------------------------------
create table if not exists sales_blueprints (
  id          uuid primary key default gen_random_uuid(),
  client      text,
  content     jsonb not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table sales_blueprints enable row level security;
