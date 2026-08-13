-- Run this once in your Supabase project's SQL editor (Database -> SQL Editor -> New query).

create table if not exists public.app_state (
  id text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.app_state enable row level security;

-- This app has no login screen: anyone who has the deployed link can read AND write
-- the shared schedule, which is what makes "open the link and everyone sees the same
-- data" work with zero backend code. That's fine for a small trusted team using a
-- private URL, but it means the link itself is the only access control.
-- If you need real per-user accounts/permissions later, replace these two policies
-- with ones scoped to auth.uid() once you add Supabase Auth.
create policy "public read" on public.app_state
  for select using (true);

create policy "public write" on public.app_state
  for insert with check (true);

create policy "public update" on public.app_state
  for update using (true);

-- Required for the live "other tabs/users see changes immediately" behavior.
alter publication supabase_realtime add table public.app_state;
