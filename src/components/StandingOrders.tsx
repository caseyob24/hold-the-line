import { useEffect, useMemo, useState } from 'react';
import { useApp, useLoad } from '../lib/store';
import { must, supabase } from '../lib/supabase';
import { addDays, dateKey } from '../lib/time';
import { cadenceLabel, dueOn, mondayOf, runLength, visibleThisWeek, weekKeys, weeklyTarget, type Cadence, type Goal } from '../lib/goals';
import { Icon } from './Icon';
import { Sheet, ErrorNote } from './Chrome';
import { track } from '../lib/track';

const CADENCES: { k: Cadence; label: string }[] = [
  { k: 'daily', label: 'Every day' }, { k: 'weekdays', label: 'Weekdays' }, { k: 'weekly', label: '× per week' }, { k: 'once', label: 'Once this week' },
];

/** Weekly goals and daily habits ("standing orders"): tap to check today, dots for the week. */
export function StandingOrders() {
  const { session, profile, toast, celebrate } = useApp();
  const tz = profile?.timezone;
  const now = new Date();
  const today = dateKey(now, tz);
  const monday = mondayOf(new Date(`${today}T12:00:00`));
  const mondayKey = dateKey(monday, tz);
  const keys = weekKeys(monday, tz);
  const todayIdx = keys.indexOf(today);
  const [editing, setEditing] = useState<Goal | 'new' | null>(null);

  const goals = useLoad(async () => {
    const { data } = await supabase.from('goals').select('*').is('archived_at', null).order('position').order('created_at');
    return (data ?? []) as Goal[];
  }, []);
  const checks = useLoad(async () => {
    const since = dateKey(addDays(monday, -400), tz);
    const { data } = await supabase.from('goal_checks').select('goal_id, date').gte('date', since);
    const map = new Map<string, Set<string>>();
    for (const r of (data ?? []) as { goal_id: string; date: string }[]) {
      if (!map.has(r.goal_id)) map.set(r.goal_id, new Set());
      map.get(r.goal_id)!.add(r.date);
    }
    return map;
  }, [mondayKey]);

  // Roll unfinished one-offs from last week forward exactly once; retire the ones that already rolled.
  useEffect(() => {
    if (!goals.data || !checks.data || !session) return;
    const stale = goals.data.filter((g) => g.cadence === 'once' && !g.paused_at && g.created_week < mondayKey && !(checks.data!.get(g.id)?.size));
    const toCarry = stale.filter((g) => !g.carried_over);
    const toRetire = stale.filter((g) => g.carried_over && g.created_week < dateKey(addDays(monday, -7), tz));
    if (!toCarry.length && !toRetire.length) return;
    (async () => {
      if (toCarry.length) await supabase.from('goals').update({ carried_over: true }).in('id', toCarry.map((g) => g.id));
      if (toRetire.length) await supabase.from('goals').update({ archived_at: new Date().toISOString() }).in('id', toRetire.map((g) => g.id));
      goals.reload();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [goals.data, checks.data]);

  const list = useMemo(() => (goals.data ?? []).filter((g) => visibleThisWeek(g, mondayKey)), [goals.data, mondayKey]);
  const doneFor = (g: Goal) => checks.data?.get(g.id) ?? new Set<string>();
  const weekCount = (g: Goal) => keys.filter((k) => doneFor(g).has(k)).length;
  const totalTarget = list.reduce((n, g) => n + weeklyTarget(g), 0);
  const totalDone = list.reduce((n, g) => n + Math.min(weekCount(g), weeklyTarget(g)), 0);
  const isSunday = todayIdx === 6;

  async function toggle(g: Goal) {
    if (!session || !checks.data) return;
    const done = doneFor(g).has(today);
    const next = new Map(checks.data);
    const set = new Set(next.get(g.id) ?? []);
    if (done) set.delete(today); else set.add(today);
    next.set(g.id, set);
    checks.setData(next); // optimistic
    const res = done
      ? await supabase.from('goal_checks').delete().eq('goal_id', g.id).eq('date', today)
      : await supabase.from('goal_checks').upsert({ goal_id: g.id, user_id: session.user.id, date: today }, { onConflict: 'goal_id,date' });
    if (res.error) { toast(res.error.message); checks.reload(); return; }
    if (!done) {
      track('order_checked', { cadence: g.cadence });
      const count = weekCount(g) + 1;
      if (count === weeklyTarget(g) && g.cadence !== 'daily') toast(`${g.title}: ${count}/${weeklyTarget(g)} this week. Done.`);
      if (totalDone + 1 === totalTarget && totalTarget > 0) { celebrate(); toast('Every standing order met this week.'); }
    }
  }

  const rangeLabel = `${monday.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${addDays(monday, 6).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;

  return (
    <>
      <div className="between">
        <span className="lbl">Standing orders</span>
        <span className="mono xs muted" style={{ whiteSpace: 'nowrap' }}>Week of {rangeLabel}</span>
      </div>

      {list.length > 0 && (
        <div className="card" style={{ padding: '2px 14px 12px' }}>
          {list.map((g) => {
            const done = doneFor(g);
            const count = weekCount(g);
            const target = weeklyTarget(g);
            const todayDone = done.has(today);
            const dueToday = dueOn(g, todayIdx);
            const run = g.cadence === 'daily' || g.cadence === 'weekdays' ? runLength(done, today, tz) : 0;
            return (
              <div key={g.id} className="order-row">
                <button className={`order-chk${todayDone ? ' on' : ''}`} aria-pressed={todayDone} aria-label={`${todayDone ? 'Undo' : 'Check off'} ${g.title} for today`} onClick={() => toggle(g)} disabled={!dueToday && !todayDone}>
                  {todayDone && <Icon name="check" size={16} width={3} />}
                </button>
                <button className="order-title" onClick={() => setEditing(g)} aria-label={`Edit ${g.title}`}>
                  <b>{g.title}</b>
                  <span>{cadenceLabel(g)}{run > 1 ? ` · ${run}-day run` : ''}{!dueToday ? ' · not today' : ''}</span>
                </button>
                {g.cadence === 'daily' || g.cadence === 'weekdays' ? (
                  <span className="order-dots" aria-label={`${count} of ${target} this week`}>
                    {keys.map((k, i) => <i key={k} className={`${done.has(k) ? 'on' : ''}${k === today ? ' today' : ''}${!dueOn(g, i) ? ' off' : ''}`} />)}
                  </span>
                ) : (
                  <span className={`mono xs ${count >= target ? 'order-done' : 'muted'}`}>{count} / {target}{count >= target ? ' ✓' : ''}</span>
                )}
              </div>
            );
          })}
          <div style={{ paddingTop: 10 }}>
            <div className="between" style={{ marginBottom: 6 }}>
              <span className="xs muted">Week so far</span>
              <span className="mono xs muted">{totalDone} / {totalTarget}</span>
            </div>
            <div className="bar"><div style={{ width: `${totalTarget ? (totalDone / totalTarget) * 100 : 0}%`, background: 'var(--olive)' }} /></div>
          </div>
        </div>
      )}

      {isSunday && list.length > 0 && (
        <div className="card hero row" style={{ gap: 14, alignItems: 'center' }}>
          <div className="stack" style={{ gap: 2, alignItems: 'center', flex: 'none' }}>
            <span className="display" style={{ fontWeight: 700, fontSize: 36, lineHeight: 1 }}>{totalDone}<span style={{ fontSize: 18, color: 'var(--muted)' }}>/{totalTarget}</span></span>
            <span className="lbl">this week</span>
          </div>
          <span className="small" style={{ lineHeight: 1.45 }}>
            {list.map((g) => `${g.title} ${Math.min(weekCount(g), weeklyTarget(g))}/${weeklyTarget(g)}`).join(' · ')}.
            <span className="muted"> Week closes tonight; orders reset Monday. One-offs you didn't finish roll over once.</span>
          </span>
        </div>
      )}

      <button className="btn dashed full" onClick={() => setEditing('new')}>+ Add a standing order</button>

      {editing && session && (
        <GoalSheet goal={editing === 'new' ? null : editing} userId={session.user.id} nextPosition={(goals.data?.length ?? 0)} mondayKey={mondayKey}
          onClose={() => setEditing(null)} onSaved={(msg) => { setEditing(null); goals.reload(); toast(msg); }} />
      )}
    </>
  );
}

function GoalSheet({ goal, userId, nextPosition, mondayKey, onClose, onSaved }: {
  goal: Goal | null; userId: string; nextPosition: number; mondayKey: string; onClose: () => void; onSaved: (msg: string) => void;
}) {
  const [title, setTitle] = useState(goal?.title ?? '');
  const [cadence, setCadence] = useState<Cadence>(goal?.cadence ?? 'daily');
  const [target, setTarget] = useState(goal?.cadence === 'weekly' ? goal.target : 3);
  const [remind, setRemind] = useState(goal?.remind ?? false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<null | 'retire'>(null);

  async function run(fn: () => Promise<void>, msg: string) {
    setBusy(true); setErr(null);
    try { await fn(); onSaved(msg); } catch (e) { setErr((e as Error).message); setBusy(false); }
  }
  const save = () => run(async () => {
    if (!title.trim()) throw new Error('Give it a name.');
    const row = { title: title.trim(), cadence, target: cadence === 'weekly' ? target : cadence === 'once' ? 1 : cadence === 'weekdays' ? 5 : 7, remind };
    if (goal) must(await supabase.from('goals').update(row).eq('id', goal.id));
    else must(await supabase.from('goals').insert({ ...row, user_id: userId, position: nextPosition, created_week: mondayKey }));
  }, goal ? 'Order updated.' : 'Standing order posted.');
  const pause = () => run(async () => { must(await supabase.from('goals').update({ paused_at: goal!.paused_at ? null : new Date().toISOString() }).eq('id', goal!.id)); }, goal?.paused_at ? 'Back on duty.' : 'Paused. It keeps its history.');
  const retire = () => run(async () => { must(await supabase.from('goals').update({ archived_at: new Date().toISOString() }).eq('id', goal!.id)); }, 'Retired.');

  return (
    <Sheet onClose={onClose} label={goal ? 'Edit standing order' : 'New standing order'}>
      <span className="lbl brass">{goal ? 'Edit standing order' : 'New standing order'}</span>
      {confirm === 'retire' ? (
        <>
          <p>Retire <b>{goal?.title}</b>? It disappears from Today; what you've checked off stays on record.</p>
          <button className="btn alarm full" disabled={busy} onClick={retire}>Yes, retire it</button>
          <button className="btn ghost full" onClick={() => setConfirm(null)}>Cancel</button>
        </>
      ) : (
        <>
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Whiten teeth, Gym, Call Mom" aria-label="Standing order" autoFocus={!goal} />
          <span className="lbl">How often</span>
          <div className="chips">
            {CADENCES.map((c) => (
              <button key={c.k} className={`chip${cadence === c.k ? ' on' : ''}`} aria-pressed={cadence === c.k} onClick={() => setCadence(c.k)}>{c.label}</button>
            ))}
          </div>
          {cadence === 'weekly' && (
            <div className="stack" style={{ gap: 8 }}>
              <span className="lbl">Times per week</span>
              <div className="chips">
                {[1, 2, 3, 4, 5, 6].map((n) => <button key={n} className={`chip${target === n ? ' on' : ''}`} style={{ minWidth: 44, padding: 0, justifyContent: 'center' }} aria-pressed={target === n} onClick={() => setTarget(n)}>{n}</button>)}
              </div>
            </div>
          )}
          <label className="toggle" style={{ borderTop: 0 }}>Mention it in the morning pledge push<input type="checkbox" checked={remind} onChange={(e) => setRemind(e.target.checked)} /></label>
          <ErrorNote msg={err} />
          <button className="btn primary full" disabled={busy} onClick={save}>{busy ? 'Saving…' : goal ? 'Save' : 'Post the order'}</button>
          {goal && (
            <div className="grid2">
              <button className="btn ghost" disabled={busy} onClick={pause}>{goal.paused_at ? 'Resume' : 'Pause'}</button>
              <button className="btn alarm-soft" disabled={busy} onClick={() => setConfirm('retire')}>Retire</button>
            </div>
          )}
          <span className="xs muted" style={{ textAlign: 'center' }}>Pause or retire any time. Done history stays.</span>
        </>
      )}
    </Sheet>
  );
}
