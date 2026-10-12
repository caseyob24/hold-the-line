-- Hold the Line · growth basics: owner dashboard, usage events, error log,
-- account deletion safety, and a SQL-side "who is due" query for the push job.

-- ---------------------------------------------------------------- admins
-- Kept out of profiles so nobody can promote themselves by editing their own row.
create table if not exists public.admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.admins enable row level security; -- no policies: only security definer functions read it

insert into public.admins (user_id)
select id from auth.users where lower(email) = 'caseyob24@gmail.com'
on conflict do nothing;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;

-- ---------------------------------------------------------------- activity
alter table public.profiles add column if not exists last_seen_at timestamptz;

create or replace function public.touch_last_seen() returns void
language sql security definer set search_path = public as $$
  update public.profiles set last_seen_at = now()
  where id = auth.uid() and (last_seen_at is null or last_seen_at < now() - interval '5 minutes');
$$;

create table if not exists public.app_events (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  props jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index if not exists app_events_created_idx on public.app_events (created_at desc);
create index if not exists app_events_name_idx on public.app_events (name, created_at desc);
alter table public.app_events enable row level security;
drop policy if exists "insert own" on public.app_events;
create policy "insert own" on public.app_events for insert to authenticated with check (user_id = auth.uid());

create table if not exists public.client_errors (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users (id) on delete cascade,
  message text not null,
  stack text,
  url text,
  user_agent text,
  created_at timestamptz not null default now()
);
create index if not exists client_errors_created_idx on public.client_errors (created_at desc);
alter table public.client_errors enable row level security;
drop policy if exists "insert own" on public.client_errors;
create policy "insert own" on public.client_errors for insert to authenticated with check (user_id = auth.uid());

-- ---------------------------------------------------------------- owner dashboard
create or replace function public.admin_stats() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  result jsonb;
begin
  if not public.is_admin() then
    raise exception 'Not allowed';
  end if;

  select jsonb_build_object(
    'users', (select count(*) from public.profiles),
    'onboarded', (select count(*) from public.profiles where onboarded),
    'sponsors', (select count(*) from public.profiles where role = 'sponsor'),
    'active_links', (select count(*) from public.sponsor_links where status = 'active'),
    'sponsors_with_many', (select count(*) from (
        select sponsor_id from public.sponsor_links where status = 'active' group by sponsor_id having count(*) > 1) s),
    'active_1d', (select count(*) from public.profiles where last_seen_at > now() - interval '1 day'),
    'active_7d', (select count(*) from public.profiles where last_seen_at > now() - interval '7 days'),
    'active_30d', (select count(*) from public.profiles where last_seen_at > now() - interval '30 days'),
    'new_7d', (select count(*) from public.profiles where created_at > now() - interval '7 days'),
    'push_devices', (select count(*) from public.push_subscriptions),
    'check_ins_7d', (select count(*) from public.check_ins where date > current_date - 7),
    'reviews_7d', (select count(*) from public.reviews where date > current_date - 7),
    'urges_7d', (select count(*) from public.urges where at > now() - interval '7 days'),
    'events_7d', coalesce((select jsonb_agg(e order by e.n desc) from (
        select name, count(*) as n from public.app_events
        where created_at > now() - interval '7 days' group by name order by count(*) desc limit 20) e), '[]'),
    'signups_by_week', coalesce((select jsonb_agg(w order by w.week) from (
        select date_trunc('week', created_at)::date as week, count(*) as n from public.profiles
        where created_at > now() - interval '12 weeks' group by 1) w), '[]'),
    'errors', coalesce((select jsonb_agg(x) from (
        select message, url, created_at from public.client_errors order by created_at desc limit 15) x), '[]'),
    'errors_7d', (select count(*) from public.client_errors where created_at > now() - interval '7 days')
  ) into result;
  return result;
end;
$$;

-- ---------------------------------------------------------------- account deletion safety
-- Deleting a sponsor's account must not fail because they witnessed someone's milestone.
alter table public.milestones drop constraint if exists milestones_witnessed_by_fkey;
alter table public.milestones add constraint milestones_witnessed_by_fkey
  foreign key (witnessed_by) references public.profiles (id) on delete set null;

-- ---------------------------------------------------------------- push job
-- Returns only profiles with something due in the current 15-minute window of their own
-- local time, so the job doesn't loop over every user as the app grows.
create or replace function public.due_profiles(window_minutes int default 15)
returns setof public.profiles
language sql stable security definer set search_path = public as $$
  select p.*
  from public.profiles p
  cross join lateral (select (now() at time zone p.timezone)::time as t) l
  where p.onboarded
    and exists (
      select 1
      from unnest(array[p.quote_time, p.checkin_reminder_time, p.review_time, time '09:00', time '11:00']) as target(at)
      where l.t - target.at >= interval '0'
        and l.t - target.at < make_interval(mins => window_minutes)
    );
$$;

revoke execute on function public.due_profiles from public, anon, authenticated;
grant execute on function public.due_profiles to service_role;
revoke execute on function public.admin_stats, public.touch_last_seen, public.is_admin from anon;
