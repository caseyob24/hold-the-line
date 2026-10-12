-- Hold the Line: daily rhythm — evening review, workbook drills, affirmation favorites.

alter table public.profiles
  add column if not exists notify_review boolean not null default true,
  add column if not exists review_time time not null default '21:00';

-- Evening debrief, one per day.
create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  date date not null,
  outcome text not null check (outcome in ('held', 'struggled', 'slipped')),
  difficulties text[] not null default '{}',
  difficult_notes text,
  went_right text,
  shared_with_sponsor boolean not null default true,
  created_at timestamptz not null default now(),
  unique (user_id, date)
);

-- Completed workbook drills; answers keyed by the drill's field ids.
create table if not exists public.workbook_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  date date not null,
  drill_key text not null,
  answers jsonb not null default '{}',
  created_at timestamptz not null default now(),
  unique (user_id, date, drill_key)
);
create index if not exists workbook_entries_user_date on public.workbook_entries (user_id, date desc);

create table if not exists public.affirmation_favorites (
  user_id uuid not null references public.profiles (id) on delete cascade,
  affirmation_index int not null,
  created_at timestamptz not null default now(),
  primary key (user_id, affirmation_index)
);

alter table public.reviews enable row level security;
alter table public.workbook_entries enable row level security;
alter table public.affirmation_favorites enable row level security;

create policy "own" on public.reviews for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own" on public.workbook_entries for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own" on public.affirmation_favorites for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Sponsor dashboard gains shared evening reviews (notes only with the journal permission).
create or replace function public.sponsor_dashboard() returns json
language sql stable security definer set search_path = public as $$
  select coalesce(json_agg(row_to_json(d) order by d.name), '[]'::json) from (
    select
      l.id as link_id,
      l.user_id,
      p.display_name as name,
      p.phone,
      l.permissions,
      case when (l.permissions ->> 'streaks')::boolean then (
        select coalesce(json_agg(json_build_object('id', s.id, 'name', s.name, 'start_at', s.start_at, 'is_primary', s.is_primary) order by s.is_primary desc, s.start_at), '[]'::json)
        from public.sobrieties s where s.user_id = l.user_id and s.archived_at is null
      ) end as sobrieties,
      case when (l.permissions ->> 'checkins')::boolean then (
        select coalesce(json_agg(json_build_object(
                 'date', c.date, 'pledged', c.pledged, 'mood', c.mood, 'created_at', c.created_at,
                 'notes', case when (l.permissions ->> 'journal')::boolean then c.notes end) order by c.date desc), '[]'::json)
        from public.check_ins c
        where c.user_id = l.user_id and c.shared_with_sponsor and c.date > current_date - 21
      ) end as check_ins,
      case when (l.permissions ->> 'checkins')::boolean then (
        select coalesce(json_agg(json_build_object(
                 'date', r.date, 'outcome', r.outcome, 'difficulties', r.difficulties,
                 'difficult_notes', case when (l.permissions ->> 'journal')::boolean then r.difficult_notes end,
                 'went_right', case when (l.permissions ->> 'journal')::boolean then r.went_right end) order by r.date desc), '[]'::json)
        from (select * from public.reviews where user_id = l.user_id and shared_with_sponsor order by date desc limit 7) r
      ) end as reviews,
      case when (l.permissions ->> 'streaks')::boolean then (
        select coalesce(json_agg(json_build_object('id', m.id, 'rank', m.rank, 'days', m.days, 'reached_at', m.reached_at,
                 'witnessed', m.witnessed_at is not null, 'sobriety_id', m.sobriety_id) order by m.reached_at desc), '[]'::json)
        from (select * from public.milestones where user_id = l.user_id order by reached_at desc limit 12) m
      ) end as milestones,
      case when (l.permissions ->> 'risk_events')::boolean then (
        select coalesce(json_agg(json_build_object('title', r.title, 'start_at', r.start_at) order by r.start_at), '[]'::json)
        from public.risk_events r where r.user_id = l.user_id and r.start_at between now() - interval '6 hours' and now() + interval '7 days'
      ) end as risk_events
    from public.sponsor_links l join public.profiles p on p.id = l.user_id
    where l.sponsor_id = auth.uid() and l.status = 'active'
  ) d;
$$;
