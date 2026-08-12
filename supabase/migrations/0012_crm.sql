-- ---------------------------------------------------------------------------
-- 0012 — the leads table becomes the CRM.
--
-- Marrs: "It's time to finally build out the leads section of the Pam Control
-- Centre... The other section is basically just a personal CRM for each of the
-- individuals."
--
-- WHY EXTEND `leads` RATHER THAN ADD A `crm_contacts` TABLE.
-- A website lead has to appear in Polynize's CRM the moment it arrives. With two
-- tables that means a copy, and a copy means the two can disagree: a contact
-- worked in the CRM whose lead row still says nothing has happened. One table
-- means one truth. The cost is that this table now serves two readers (the CRM
-- UI and the kit.com sync via /api/leads), which is why `synced_at` keeps its
-- exact old meaning below.
--
-- OWNER = WHOSE CRM IT IS, and it deliberately reuses the marketing stream ids
-- (polynize, marrs, shourov, kristin, julian) so the Leads dashboard and the
-- Marketing dashboard show the same five names and never drift apart.
--
-- Everything added here is nullable or defaulted, so every existing row stays
-- valid and the website capture path keeps working untouched.
-- ---------------------------------------------------------------------------

alter table leads add column if not exists owner text not null default 'polynize';

-- Pipeline position. Text and not an enum, so adding a stage later is a code
-- change rather than a migration with a lock on a live table.
--   new -> contacted -> meeting -> proposal -> won | lost
alter table leads add column if not exists stage text not null default 'new';

-- Freeform notes. For a Fireflies-sourced contact this is where the meeting
-- summary lands.
alter table leads add column if not exists notes text;

alter table leads add column if not exists phone text;
-- `role_title` and not `title`: `title` reads like a record title rather than a
-- job title, and this table is already read by other code.
alter table leads add column if not exists role_title text;

-- The follow-up. Two columns because "what" and "when" are asked separately: the
-- CRM list sorts on the date, the row shows the text.
alter table leads add column if not exists next_action text;
alter table leads add column if not exists next_action_at timestamptz;
alter table leads add column if not exists last_contacted_at timestamptz;

-- Fireflies provenance, unused until that integration is switched on (D25 is
-- still in force). Added now so turning it on is not another migration.
alter table leads add column if not exists fireflies_transcript_id text;
alter table leads add column if not exists fireflies_url text;

-- ---------------------------------------------------------------------------
-- ONE ROW PER (OWNER, EMAIL), NOT PER EMAIL.
--
-- The old constraint was globally unique on email, which would have meant that
-- once Marrs added a contact, Shourov could not add the same person to his own
-- CRM. Two people legitimately know the same person. Uniqueness therefore moves
-- to the pair.
--
-- This is safe on existing data: email was globally unique, so after
-- backfilling every row to owner='polynize' the pair is unique by construction.
-- ---------------------------------------------------------------------------
-- A PLAIN (owner, email) constraint, not (owner, lower(email)). An expression
-- index cannot be named as an upsert target through PostgREST's on_conflict, so a
-- functional index here would quietly break every upsert the CRM and the website
-- capture path do. Callers lowercase the address instead: captureLead already
-- did, and the store does it in one place for everything else.
-- Guarded in a DO block because `add constraint` has no `if not exists`, and every
-- other statement in this file is re-runnable. A migration that fails the second
-- time it runs is a migration nobody dares run.
alter table leads drop constraint if exists leads_email_key;
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'leads_owner_email_key'
  ) then
    alter table leads add constraint leads_owner_email_key unique (owner, email);
  end if;
end $$;

create index if not exists leads_owner_idx on leads (owner);
create index if not exists leads_owner_stage_idx on leads (owner, stage);
-- Sorting the CRM by what is due next.
create index if not exists leads_next_action_at_idx on leads (next_action_at)
  where next_action_at is not null;

-- RLS was already enabled with no public policy in 0011 and stays that way: the
-- console reaches this table only through the service-role client.
