-- /job-mapping: one job description in, one capability map of that role out.
--
-- THERE IS DELIBERATELY NO COLUMN FOR THE JOB DESCRIPTION (Marrs, 12 Aug 2026). The pasted
-- text is somebody's employer's document and routinely carries identifying detail, so it is
-- held in memory for the length of the generation and then dropped. The blueprint is
-- derived; the source is not kept. If a future change needs the original, that is a privacy
-- decision and a retention policy, not a schema tweak.
--
-- `status` exists because generation is asynchronous. The row is inserted pending, the
-- client polls it, and the email goes out when it flips to ready. A row that fails keeps its
-- error so a failure is visible rather than silent.

create table if not exists job_blueprints (
  id           uuid primary key default gen_random_uuid(),
  status       text not null default 'pending' check (status in ('pending', 'ready', 'failed')),
  role_title   text,
  content      jsonb,
  error        text,
  -- Lead fields, kept alongside so a blueprint can be re-sent without a join.
  name         text,
  email        text,
  -- Set once the delivery email has actually been accepted by Resend, so a retry cannot
  -- double-send and an unsent blueprint is queryable.
  emailed_at   timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- The polling read is by id (primary key, already indexed). This one is for the operator
-- question "what came in today and did it work", which is the only other query.
create index if not exists job_blueprints_created_idx on job_blueprints (created_at desc);
create index if not exists job_blueprints_status_idx on job_blueprints (status);
