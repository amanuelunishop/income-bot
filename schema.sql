-- Run this in your Supabase project: Dashboard → SQL Editor → New query → paste → Run
--
-- If you already ran the OLD schema.sql before (a table called `entries` with a
-- unique user_id+entry_date index and a single `note` column), run the
-- MIGRATION block near the bottom instead of the CREATE TABLE block, or just
-- drop the old table if it has no data you care about: drop table if exists entries;

create table if not exists entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) default auth.uid(),
  entry_date date not null default current_date,
  income numeric not null default 0,
  income_note text,
  withdrawal numeric not null default 0,
  withdrawal_note text,
  created_at timestamptz not null default now()
);

-- NOTE: no unique index on (user_id, entry_date) anymore — you can log
-- several income/withdrawal entries on the same day, each with its own
-- comment. Saving always adds a new row; it never overwrites an old one.

alter table entries enable row level security;

create policy "Users can view their own entries"
  on entries for select
  using (auth.uid() = user_id);

create policy "Users can insert their own entries"
  on entries for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own entries"
  on entries for update
  using (auth.uid() = user_id);

create policy "Users can delete their own entries"
  on entries for delete
  using (auth.uid() = user_id);


-- ============================================================
-- MIGRATION (only run this if you already have the OLD table)
-- ============================================================
-- alter table entries add column if not exists income_note text;
-- alter table entries add column if not exists withdrawal_note text;
-- update entries set income_note = note where note is not null and income > 0;
-- update entries set withdrawal_note = note where note is not null and withdrawal > 0 and income_note is null;
-- alter table entries drop column if exists note;
-- drop index if exists entries_user_date_unique;


-- ============================================================
-- SCHEDULING THE 9PM REMINDER (pg_cron + pg_net)
-- ============================================================
-- Run this AFTER you've deployed the `daily-reminder` Edge Function
-- (see supabase/functions/daily-reminder) and set its secrets.
-- Replace YOUR_PROJECT_REF and YOUR_SERVICE_ROLE_KEY below.

-- 1. Enable the extensions (Database → Extensions, or run here):
create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

-- 2. Schedule it. 21:00 Addis Ababa time (UTC+3) = 18:00 UTC, every day.
-- select cron.schedule(
--   'nightly-income-reminder',
--   '0 18 * * *',
--   $$
--   select net.http_post(
--     url := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/daily-reminder',
--     headers := jsonb_build_object(
--       'Authorization', 'Bearer YOUR_SERVICE_ROLE_KEY',
--       'Content-Type', 'application/json'
--     ),
--     body := '{}'::jsonb
--   );
--   $$
-- );

-- To check it's scheduled: select * from cron.job;
-- To remove it later: select cron.unschedule('nightly-income-reminder');
