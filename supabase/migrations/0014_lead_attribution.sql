-- ---------------------------------------------------------------------------
-- 0014: the lead remembers which post sent it (D97, step 2 of the plan in
-- docs/pam-console/analytics-and-scale.md).
--
-- Marrs, 5 September 2026: "Someone went and used one of the lead magnets on
-- Polynize.ai, and they booked in a meeting with me straight away." Nothing
-- recorded which post started it. These three columns are where that answer
-- lands.
--
--   use_case             one of the six use-case ids (the Kit segment ids), or null
--   use_case_confidence  'utm' when it came off the link, 'inferred' when Leo
--                        guessed it later, null when nobody knows
--   utm                  the labels as they arrived: source, medium, campaign,
--                        content, referrer hostname, landing path. Plain tokens
--                        only; the site allowlists before writing.
--
-- THE CRM LABELS THE USE CASE ONLY. No partner column, on purpose: who a lead
-- goes to is decided by the team by hand for now, and partners do not use the
-- CRM (Marrs, 5 September). Adding a column later is one line here.
--
-- Everything nullable, so every existing row stays valid and the website
-- capture path keeps working whether or not this has been applied: lib/leads.ts
-- retries without these fields when the columns are missing.
--
-- Same column names the lead nurture design (docs/handoff/leo-lead-nurture-
-- design.md) proposed as `lane` and `lane_confidence`, renamed to the team's
-- word.
-- ---------------------------------------------------------------------------

alter table leads add column if not exists use_case            text;
alter table leads add column if not exists use_case_confidence text;
alter table leads add column if not exists utm                 jsonb;

-- The leaderboard groups leads by where they came from.
create index if not exists leads_use_case_idx on leads (use_case) where use_case is not null;

-- RLS unchanged: service-role only, as in 0011 and 0012.
