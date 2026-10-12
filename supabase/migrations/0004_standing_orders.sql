-- Hold the Line · standing orders: weekly goals and daily habits, tracked on the Today tab.
-- Private to the user (no sponsor policies).

create table if not exists public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 80),
  -- daily: every day · weekdays: Mon–Fri · weekly: `target` times per week · once: one-off for the week it was made
  cadence text not null default 'daily' check (cadence in ('daily', 'weekdays', 'weekly', 'once')),
  target smallint not null default 7 check (target between 1 and 7),
  remind boolean not null default false,          -- mention in the morning pledge push
  position int not null default 0,
  created_week date not null default (date_trunc('week', current_date))::date, -- Monday of the week it was created
  carried_over boolean not null default false,   -- a one-off that rolled into the next week once
  paused_at timestamptz,
  archived_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists goals_user_idx on public.goals (user_id) where archived_at is null;

create table if not exists public.goal_checks (
  id uuid primary key default gen_random_uuid(),
  goal_id uuid not null references public.goals (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  date date not null,
  created_at timestamptz not null default now(),
  unique (goal_id, date)
);
create index if not exists goal_checks_user_date_idx on public.goal_checks (user_id, date desc);

alter table public.goals enable row level security;
alter table public.goal_checks enable row level security;
drop policy if exists "own" on public.goals;
drop policy if exists "own" on public.goal_checks;
create policy "own" on public.goals for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own" on public.goal_checks for all using (user_id = auth.uid()) with check (user_id = auth.uid());
