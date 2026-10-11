-- Hold the Line: initial schema, row level security, triggers and RPCs.
-- Run in the Supabase SQL editor (or `supabase db push`).

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------- profiles
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default '',
  phone text, -- shown to active sponsors so they can call back
  role text not null default 'user' check (role in ('user', 'sponsor')),
  timezone text not null default 'America/Los_Angeles',
  onboarded boolean not null default false,
  quote_time time not null default '06:30',
  quote_authors text[] not null default '{}',
  quote_last_sent date,
  checkin_reminder_time time not null default '07:30',
  notify_checkin boolean not null default true,
  notify_milestones boolean not null default true,
  notify_evening boolean not null default false,
  share_checkins_default boolean not null default true,
  risk_flagging boolean not null default true,
  risk_keywords text[] not null default array['dinner', 'bar', 'happy hour', 'party', 'casino', 'game', 'drinks', 'tailgate'],
  risk_after time not null default '18:00',
  leagues text[] not null default array['nfl', 'ncaaf', 'nhl', 'mlb'],
  follow_teams text[] not null default array['Las Vegas Raiders', 'Vegas Golden Knights', 'UNLV Rebels'],
  channel_overrides jsonb not null default '{}',
  war_chest_label text,
  war_chest_goal_usd numeric(10, 2),
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)));
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------- core tracking
create table public.sobrieties (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  name text not null,
  start_at timestamptz not null,
  daily_cost_usd numeric(10, 2) not null default 0,
  daily_hours numeric(5, 2) not null default 0,
  is_primary boolean not null default false,
  archived_at timestamptz,
  created_at timestamptz not null default now()
);
create index on public.sobrieties (user_id);

create table public.streak_history (
  id uuid primary key default gen_random_uuid(),
  sobriety_id uuid not null references public.sobrieties (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  started_at timestamptz not null,
  ended_at timestamptz not null,
  reason text
);

create table public.check_ins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  date date not null,
  pledged boolean not null default false,
  mood smallint check (mood between 1 and 5),
  notes text,
  shared_with_sponsor boolean not null default true,
  created_at timestamptz not null default now(),
  unique (user_id, date)
);

create table public.urges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  sobriety_id uuid references public.sobrieties (id) on delete set null,
  at timestamptz not null default now(),
  intensity smallint not null check (intensity between 1 and 10),
  triggers text[] not null default '{}',
  coping text[] not null default '{}',
  notes text
);
create index on public.urges (user_id, at desc);

create table public.workouts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  at timestamptz not null default now(),
  title text not null,
  duration_min int,
  notes text,
  outlook_event_id text
);

create table public.workout_sets (
  id uuid primary key default gen_random_uuid(),
  workout_id uuid not null references public.workouts (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  position int not null default 0,
  exercise text not null,
  sets int,
  reps int,
  weight text
);

create table public.milestones (
  id uuid primary key default gen_random_uuid(),
  sobriety_id uuid not null references public.sobrieties (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  rank text not null,
  days int not null,
  streak_started_at timestamptz not null,
  reached_at timestamptz not null,
  witnessed_by uuid references public.profiles (id),
  witness_note text,
  witnessed_at timestamptz,
  unique (sobriety_id, rank, streak_started_at)
);

create table public.backup_contacts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  name text not null,
  phone text not null,
  relation text
);

-- High-risk Outlook events, summarized by the user's own device so a sponsor can see them
-- (title + time only) when that permission is on.
create table public.risk_events (
  user_id uuid not null references public.profiles (id) on delete cascade,
  event_id text not null,
  title text not null,
  start_at timestamptz not null,
  primary key (user_id, event_id)
);

-- ---------------------------------------------------------------- sponsor model
create table public.sponsor_links (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  sponsor_id uuid references public.profiles (id) on delete cascade,
  sponsor_name text not null,
  sponsor_phone text,
  status text not null default 'pending' check (status in ('pending', 'active', 'revoked')),
  is_primary boolean not null default true,
  invite_code text not null unique default encode(extensions.gen_random_bytes(9), 'hex'),
  permissions jsonb not null default '{"streaks": true, "checkins": true, "urge_alerts": true, "missed_checkin_alerts": true, "witness": true, "journal": false, "risk_events": false}',
  invited_at timestamptz not null default now(),
  accepted_at timestamptz
);
create index on public.sponsor_links (sponsor_id);
create index on public.sponsor_links (user_id);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  link_id uuid not null references public.sponsor_links (id) on delete cascade,
  from_id uuid not null references public.profiles (id) on delete cascade,
  body text not null check (length(body) between 1 and 2000),
  created_at timestamptz not null default now(),
  read_at timestamptz
);
create index on public.messages (link_id, created_at desc);

create table public.alerts (
  id uuid primary key default gen_random_uuid(),
  link_id uuid not null references public.sponsor_links (id) on delete cascade,
  kind text not null check (kind in ('urge', 'missed_checkin', 'milestone_upcoming', 'milestone_reached', 'reach_out')),
  payload jsonb not null default '{}',
  dedupe_key text unique,
  created_at timestamptz not null default now(),
  seen_at timestamptz,
  pushed_at timestamptz
);
create index on public.alerts (link_id, created_at desc);
create index on public.alerts (pushed_at) where pushed_at is null;

-- ---------------------------------------------------------------- server-only
create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

create table public.oauth_tokens (
  user_id uuid not null references public.profiles (id) on delete cascade,
  provider text not null,
  refresh_token_enc text not null,
  access_token_enc text,
  expires_at timestamptz,
  account_email text,
  updated_at timestamptz not null default now(),
  primary key (user_id, provider)
);

-- ---------------------------------------------------------------- helpers
-- True when the caller is an active sponsor of `owner` and (optionally) has permission `perm`.
create or replace function public.is_sponsor_of(owner uuid, perm text default null) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.sponsor_links l
    where l.user_id = owner and l.sponsor_id = auth.uid() and l.status = 'active'
      and (perm is null or coalesce((l.permissions ->> perm)::boolean, false))
  );
$$;

create or replace function public.is_link_party(link uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.sponsor_links l
    where l.id = link and l.status = 'active' and (l.user_id = auth.uid() or l.sponsor_id = auth.uid())
  );
$$;

-- ---------------------------------------------------------------- RLS
alter table public.profiles enable row level security;
alter table public.sobrieties enable row level security;
alter table public.streak_history enable row level security;
alter table public.check_ins enable row level security;
alter table public.urges enable row level security;
alter table public.workouts enable row level security;
alter table public.workout_sets enable row level security;
alter table public.milestones enable row level security;
alter table public.backup_contacts enable row level security;
alter table public.risk_events enable row level security;
alter table public.sponsor_links enable row level security;
alter table public.messages enable row level security;
alter table public.alerts enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.oauth_tokens enable row level security; -- no policies: service role only

create policy "profile self" on public.profiles for all using (id = auth.uid()) with check (id = auth.uid());
create policy "profile linked read" on public.profiles for select using (
  exists (select 1 from public.sponsor_links l where l.status = 'active'
          and ((l.user_id = auth.uid() and l.sponsor_id = profiles.id) or (l.sponsor_id = auth.uid() and l.user_id = profiles.id)))
);

-- Owner-only tables
create policy "own" on public.check_ins for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own" on public.urges for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own" on public.workouts for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own" on public.workout_sets for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own" on public.backup_contacts for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own" on public.push_subscriptions for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Owner + sponsor read when permitted
create policy "own" on public.sobrieties for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "sponsor read" on public.sobrieties for select using (public.is_sponsor_of(user_id, 'streaks'));
create policy "own" on public.streak_history for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "sponsor read" on public.streak_history for select using (public.is_sponsor_of(user_id, 'streaks'));
create policy "own" on public.milestones for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "sponsor read" on public.milestones for select using (public.is_sponsor_of(user_id, 'streaks'));
create policy "own" on public.risk_events for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "sponsor read" on public.risk_events for select using (public.is_sponsor_of(user_id, 'risk_events'));

-- Sponsor links: the user manages them; the sponsor can read their own
create policy "own" on public.sponsor_links for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "sponsor read" on public.sponsor_links for select using (sponsor_id = auth.uid());

-- Messages: both parties of an active link
create policy "party read" on public.messages for select using (public.is_link_party(link_id));
create policy "party write" on public.messages for insert with check (public.is_link_party(link_id) and from_id = auth.uid());
create policy "party mark read" on public.messages for update using (public.is_link_party(link_id) and from_id <> auth.uid());

-- Alerts: both parties read; the sponsor marks seen. Inserts happen in triggers/RPCs/server.
create policy "party read" on public.alerts for select using (public.is_link_party(link_id));
create policy "sponsor mark seen" on public.alerts for update using (
  exists (select 1 from public.sponsor_links l where l.id = link_id and l.sponsor_id = auth.uid() and l.status = 'active')
);

-- ---------------------------------------------------------------- triggers
-- Urge logged -> alert every active sponsor who has urge alerts on. Notes are never copied.
create or replace function public.alert_on_urge() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.alerts (link_id, kind, payload)
  select l.id, 'urge', jsonb_build_object('intensity', new.intensity, 'triggers', new.triggers, 'coping', new.coping, 'at', new.at)
  from public.sponsor_links l
  where l.user_id = new.user_id and l.status = 'active' and coalesce((l.permissions ->> 'urge_alerts')::boolean, false);
  return new;
end $$;

create trigger urge_alert after insert on public.urges for each row execute function public.alert_on_urge();

-- Milestone reached -> alert sponsors who can see streaks.
create or replace function public.alert_on_milestone() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.alerts (link_id, kind, payload, dedupe_key)
  select l.id, 'milestone_reached',
         jsonb_build_object('milestone_id', new.id, 'rank', new.rank, 'days', new.days,
                            'sobriety', (select s.name from public.sobrieties s where s.id = new.sobriety_id)),
         'reached:' || new.id || ':' || l.id
  from public.sponsor_links l
  where l.user_id = new.user_id and l.status = 'active' and coalesce((l.permissions ->> 'streaks')::boolean, false)
  on conflict (dedupe_key) do nothing;
  return new;
end $$;

create trigger milestone_alert after insert on public.milestones for each row execute function public.alert_on_milestone();

-- ---------------------------------------------------------------- RPCs
-- Shown on the join screen before accepting.
create or replace function public.invite_info(code text) returns json
language sql stable security definer set search_path = public as $$
  select json_build_object('sponsee', p.display_name, 'sponsor_name', l.sponsor_name, 'status', l.status)
  from public.sponsor_links l join public.profiles p on p.id = l.user_id
  where l.invite_code = code;
$$;

create or replace function public.accept_sponsor_invite(code text) returns uuid
language plpgsql security definer set search_path = public as $$
declare link_id uuid; owner uuid;
begin
  update public.sponsor_links
     set sponsor_id = auth.uid(), status = 'active', accepted_at = now()
   where invite_code = code and status = 'pending' and user_id <> auth.uid()
  returning id, user_id into link_id, owner;
  if link_id is null then
    raise exception 'Invite not found or already used';
  end if;
  -- A brand-new account that joins through an invite starts in sponsor mode.
  update public.profiles set role = 'sponsor', onboarded = true
   where id = auth.uid() and not exists (select 1 from public.sobrieties s where s.user_id = auth.uid());
  return link_id;
end $$;

create or replace function public.leave_sponsorship(link uuid) returns void
language sql security definer set search_path = public as $$
  update public.sponsor_links set status = 'revoked' where id = link and sponsor_id = auth.uid();
$$;

create or replace function public.fire_reach_out() returns int
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  insert into public.alerts (link_id, kind, payload)
  select l.id, 'reach_out', jsonb_build_object('at', now())
  from public.sponsor_links l where l.user_id = auth.uid() and l.status = 'active';
  get diagnostics n = row_count;
  return n;
end $$;

create or replace function public.witness_milestone(milestone uuid, note text) returns void
language plpgsql security definer set search_path = public as $$
declare owner uuid;
begin
  select user_id into owner from public.milestones where id = milestone;
  if owner is null or not public.is_sponsor_of(owner, 'witness') then
    raise exception 'Not allowed';
  end if;
  update public.milestones set witnessed_by = auth.uid(), witness_note = left(note, 280), witnessed_at = now()
   where id = milestone;
end $$;

-- Everything the sponsor home screen needs, filtered by each link's permissions.
-- Check-in notes are included only with the journal permission; urge notes never are.
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

create or replace function public.outlook_status() returns json
language sql stable security definer set search_path = public as $$
  select json_build_object('connected', count(*) > 0, 'email', max(account_email))
  from public.oauth_tokens where user_id = auth.uid() and provider = 'microsoft';
$$;

create or replace function public.disconnect_outlook() returns void
language sql security definer set search_path = public as $$
  delete from public.oauth_tokens where user_id = auth.uid() and provider = 'microsoft';
$$;

-- invite_info stays callable before sign-in so the join screen can name the sponsee.
revoke execute on function public.sponsor_dashboard, public.accept_sponsor_invite,
  public.leave_sponsorship, public.fire_reach_out, public.witness_milestone, public.outlook_status,
  public.disconnect_outlook from anon;

-- ---------------------------------------------------------------- realtime
alter publication supabase_realtime add table public.messages, public.alerts;
