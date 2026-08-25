-- Run this in Supabase: Project > SQL Editor > New query

create table ledger_data (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz default now()
);

alter table ledger_data enable row level security;

-- Each signed-in user can only ever see or touch their own row.
-- auth.uid() is the logged-in user's id, supplied automatically by Supabase Auth.

create policy "Users can read own data"
on ledger_data for select
using (auth.uid() = user_id);

create policy "Users can insert own data"
on ledger_data for insert
with check (auth.uid() = user_id);

create policy "Users can update own data"
on ledger_data for update
using (auth.uid() = user_id);

create policy "Users can delete own data"
on ledger_data for delete
using (auth.uid() = user_id);
