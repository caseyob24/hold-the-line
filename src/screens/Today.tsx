import { Link, useNavigate } from 'react-router-dom';
import { useApp, useLoad } from '../lib/store';
import { supabase } from '../lib/supabase';
import { addDays, dateKey, daysSince } from '../lib/time';
import { DAILY_GOAL, DRILLS, drillByKey, suggestedFor } from '../lib/workbook';
import { Icon } from '../components/Icon';
import type { Review } from '../lib/types';

const OUTCOME_LABEL = { held: 'Held the line', struggled: 'Struggled', slipped: 'Slipped' } as const;

export default function Today() {
  const { profile, session, sobrieties, toast, celebrate } = useApp();
  const nav = useNavigate();
  const tz = profile?.timezone;
  const now = new Date();
  const today = dateKey(now, tz);
  const primary = sobrieties.find((s) => s.is_primary) ?? sobrieties[0];

  // Last 60 days of pledges: enough for the 7-day strip and the running streak.
  const pledges = useLoad(async () => {
    const since = dateKey(addDays(now, -60), tz);
    const { data } = await supabase.from('check_ins').select('date, pledged').gte('date', since).eq('pledged', true);
    return new Set((data ?? []).map((r) => r.date as string));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [today]);

  const work = useLoad(async () => {
    const { data } = await supabase.from('workbook_entries').select('drill_key').eq('date', today);
    return new Set((data ?? []).map((r) => r.drill_key as string));
  }, [today]);

  const review = useLoad(async () => {
    const { data } = await supabase.from('reviews').select('*').eq('date', today).maybeSingle();
    return data as Review | null;
  }, [today]);

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = addDays(now, i - 6);
    const k = dateKey(d, tz);
    return { k, label: i === 6 ? 'Today' : d.toLocaleDateString('en-US', { weekday: 'short', timeZone: tz }), done: pledges.data?.has(k) ?? false };
  });
  const weekCount = days.filter((d) => d.done).length;
  const pledgedToday = pledges.data?.has(today) ?? false;
  let streak = 0;
  for (let i = pledgedToday ? 0 : 1; i < 60; i++) {
    if (pledges.data?.has(dateKey(addDays(now, -i), tz))) streak++;
    else break;
  }

  const done = work.data ?? new Set<string>();
  const suggested = suggestedFor(today);
  const extraDone = [...done].filter((k) => !suggested.some((s) => s.key === k)).map(drillByKey).filter(Boolean);
  const list = [...suggested, ...(extraDone as typeof suggested)];

  async function pledge() {
    if (!session) return;
    const { error } = await supabase.from('check_ins').upsert(
      { user_id: session.user.id, date: today, pledged: true, shared_with_sponsor: profile?.share_checkins_default ?? true },
      { onConflict: 'user_id,date' },
    );
    if (error) return toast(error.message);
    await pledges.reload();
    if (weekCount + 1 === 7) { celebrate(); toast('7 for 7. The week is yours.'); }
    else toast("Pledged. Tomorrow isn't your fight yet.");
  }

  return (
    <div className="screen">
      <div className="head">
        <span className="lbl">{now.toLocaleDateString('en-US', { weekday: 'long', timeZone: tz })}{primary ? ` · Day ${daysSince(primary.start_at)}` : ''}</span>
        <h1 className="title">Today's orders</h1>
      </div>

      <div className="card hero stack" style={{ gap: 12 }}>
        <div className="between">
          <span className="lbl brass">Weekly pledge challenge</span>
          <span className="mono small">{weekCount} / 7</span>
        </div>
        <div style={{ display: 'flex', gap: 4 }} aria-label={`${weekCount} of the last 7 days pledged`}>
          {days.map((d) => (
            <div key={d.k} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, fontSize: 11, color: d.label === 'Today' ? 'var(--brass-text)' : 'var(--muted)', fontWeight: d.label === 'Today' ? 600 : 400 }}>
              <div style={{
                width: 34, height: 34, borderRadius: 17, display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: d.done ? 'var(--brass)' : 'none',
                border: d.done ? 0 : d.label === 'Today' ? '2px solid var(--brass)' : '2px dashed #555A4A',
              }}>
                {d.done && <Icon name="check" size={16} width={2.6} stroke="var(--bg)" />}
              </div>
              {d.label}
            </div>
          ))}
        </div>
        {pledgedToday ? (
          <div className="btn outline full" style={{ cursor: 'default' }}><Icon name="check" width={2.2} />Pledged today</div>
        ) : (
          <button className="btn primary full" onClick={pledge}>Make today's pledge</button>
        )}
        <span className="xs muted">
          {streak > 1 ? `${streak}-day pledge streak. ` : ''}Pledge all 7 days to take the week.
        </span>
      </div>

      <div className="between">
        <span className="lbl">Workbook · pick {DAILY_GOAL}</span>
        <span className="mono small" style={{ color: 'var(--olive)' }}>{Math.min(done.size, DAILY_GOAL)} of {DAILY_GOAL} done</span>
      </div>
      <div className="bar"><div style={{ width: `${Math.min(1, done.size / DAILY_GOAL) * 100}%`, background: 'var(--olive)' }} /></div>

      <div className="stack" style={{ gap: 8 }}>
        {list.map((d) => {
          const isDone = done.has(d.key);
          return (
            <Link key={d.key} to={`/workbook/${d.key}`} className="card tight row" style={{ textDecoration: 'none', color: 'inherit' }}>
              <span style={{
                width: 26, height: 26, borderRadius: 13, flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center',
                border: `2px solid ${isDone ? 'var(--olive)' : 'var(--line)'}`, background: isDone ? 'var(--olive)' : 'none',
              }}>
                {isDone && <Icon name="check" size={14} width={3} stroke="var(--bg)" />}
              </span>
              <span className="stack" style={{ flex: 1, gap: 2 }}>
                <span style={{ fontWeight: 600, fontSize: 15 }}>{d.title}</span>
                <span className="xs muted">{d.subtitle}</span>
              </span>
              {!isDone && <span style={{ transform: 'scaleX(-1)', display: 'inline-flex', color: 'var(--muted)' }}><Icon name="back" size={16} /></span>}
            </Link>
          );
        })}
        <Link to="/workbook" className="btn dashed full">Browse all {DRILLS.length} drills</Link>
      </div>

      <button className="card steel row" style={{ textAlign: 'left' }} onClick={() => nav('/review')}>
        <Icon name="moon" stroke="var(--steel)" size={22} />
        <span className="stack" style={{ flex: 1, gap: 2 }}>
          <span style={{ fontWeight: 600, fontSize: 15 }}>Evening debrief</span>
          <span className="xs muted">{review.data ? `Done · ${OUTCOME_LABEL[review.data.outcome]}` : 'Two minutes: what was hard, what held'}</span>
        </span>
        <span style={{ transform: 'scaleX(-1)', display: 'inline-flex', color: 'var(--muted)' }}><Icon name="back" size={16} /></span>
      </button>
    </div>
  );
}
