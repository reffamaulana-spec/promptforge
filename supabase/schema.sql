create table if not exists public.prompts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 120),
  content text not null check (char_length(content) between 1 and 20000),
  tags text[] not null default '{}' check (coalesce(array_length(tags, 1), 0) <= 8),
  favorite boolean not null default false,
  source text not null default 'manual' check (source ~ '^[a-z-]{1,20}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  type text not null check (type ~ '^[a-z-]{1,20}$'),
  title text not null check (char_length(title) between 1 and 120),
  content text not null check (char_length(content) between 1 and 20000),
  prompt_id uuid,
  created_at timestamptz not null default now()
);

create table if not exists public.usage_stats (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  feature text not null check (feature ~ '^[a-z-]{1,20}$'),
  count integer not null default 0 check (count >= 0),
  primary key (user_id, feature)
);

create index if not exists prompts_user_updated_idx on public.prompts (user_id, updated_at desc);
create index if not exists history_user_created_idx on public.history (user_id, created_at desc);

alter table public.prompts enable row level security;
alter table public.history enable row level security;
alter table public.usage_stats enable row level security;

drop policy if exists "prompts_select_own" on public.prompts;
drop policy if exists "prompts_insert_own" on public.prompts;
drop policy if exists "prompts_update_own" on public.prompts;
drop policy if exists "prompts_delete_own" on public.prompts;
create policy "prompts_select_own" on public.prompts for select to authenticated using (auth.uid() = user_id);
create policy "prompts_insert_own" on public.prompts for insert to authenticated with check (auth.uid() = user_id);
create policy "prompts_update_own" on public.prompts for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "prompts_delete_own" on public.prompts for delete to authenticated using (auth.uid() = user_id);

drop policy if exists "history_select_own" on public.history;
drop policy if exists "history_insert_own" on public.history;
drop policy if exists "history_delete_own" on public.history;
create policy "history_select_own" on public.history for select to authenticated using (auth.uid() = user_id);
create policy "history_insert_own" on public.history for insert to authenticated with check (auth.uid() = user_id);
create policy "history_delete_own" on public.history for delete to authenticated using (auth.uid() = user_id);

drop policy if exists "usage_select_own" on public.usage_stats;
drop policy if exists "usage_insert_own" on public.usage_stats;
drop policy if exists "usage_update_own" on public.usage_stats;
drop policy if exists "usage_delete_own" on public.usage_stats;
create policy "usage_select_own" on public.usage_stats for select to authenticated using (auth.uid() = user_id);
create policy "usage_insert_own" on public.usage_stats for insert to authenticated with check (auth.uid() = user_id);
create policy "usage_update_own" on public.usage_stats for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "usage_delete_own" on public.usage_stats for delete to authenticated using (auth.uid() = user_id);

revoke all on public.prompts, public.history, public.usage_stats from anon;
grant select, insert, update, delete on public.prompts, public.history, public.usage_stats to authenticated;
