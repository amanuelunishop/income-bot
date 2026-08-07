-- Run this once in your Supabase project: Dashboard → SQL Editor → New query → paste → Run

create table if not exists entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) default auth.uid(),
  entry_date date not null default current_date,
  income numeric not null default 0,
  withdrawal numeric not null default 0,
  note text,
  created_at timestamptz not null default now()
);

create unique index if not exists entries_user_date_unique on entries (user_id, entry_date);

-- Row Level Security: this is what keeps the app safe even though the
-- public "anon" key lives in the browser and anyone can see it via
-- Inspect Element. RLS enforces access at the database level, not by
-- hiding the key.
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
