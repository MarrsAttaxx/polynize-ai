-- ---------------------------------------------------------------------------
-- sales_blueprints lead capture.
--
-- /blueprint became the public marketing funnel's call to action, so the intake
-- now asks for an email before generating. These columns hold the lead so it can
-- be read without digging through the content JSONB.
--
-- Deliberately NOT stored inside `content`: the chat editor round-trips that
-- object through the LLM on every refinement, which would drop the address.
--
-- The save route tolerates these columns being absent (it retries without them),
-- so applying this out of order degrades lead capture rather than breaking saves.
-- ---------------------------------------------------------------------------
alter table sales_blueprints
  add column if not exists email    text,
  add column if not exists business text;
