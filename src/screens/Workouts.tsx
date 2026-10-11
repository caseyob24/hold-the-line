import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useApp, useLoad } from '../lib/store';
import { must, supabase } from '../lib/supabase';
import { createEvent } from '../lib/outlook';
import { fmtDayTime, startOfWeek } from '../lib/time';
import { Header, Sheet, ErrorNote, Empty } from '../components/Chrome';
import { Icon } from '../components/Icon';
import type { Workout, WorkoutSet } from '../lib/types';

function localInput(d: Date) {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

export default function Workouts() {
  const { session, toast } = useApp();
  const [params, setParams] = useSearchParams();
  const [editing, setEditing] = useState<Workout | 'new' | null>(params.get('new') ? 'new' : null);
  const [scheduling, setScheduling] = useState(false);

  const list = useLoad(async () => {
    const { data } = await supabase.from('workouts').select('*, workout_sets(*)').order('at', { ascending: false }).limit(40);
    return (data ?? []) as Workout[];
  }, []);

  const weekStart = startOfWeek().getTime();
  const thisWeek = (list.data ?? []).filter((w) => Date.parse(w.at) >= weekStart).length;
  const [latest, ...rest] = list.data ?? [];
  const close = () => { setEditing(null); if (params.get('new')) setParams({}, { replace: true }); };

  return (
    <div className="screen">
      <Header kicker="Drill log" title="Workouts" right={<span className="mono small" style={{ color: 'var(--olive)' }}>{thisWeek} this week</span>} />

      {latest ? (
        <button className="card hero stack" style={{ textAlign: 'left', gap: 10 }} onClick={() => setEditing(latest)}>
          <div className="between">
            <span style={{ fontSize: 17, fontWeight: 600 }}>{latest.title}</span>
            <span className="mono xs muted">{fmtDayTime(latest.at)}{latest.duration_min ? ` · ${latest.duration_min} min` : ''}</span>
          </div>
          {(latest.workout_sets ?? []).length > 0 && (
            <div className="stack" style={{ gap: 0 }}>
              <div className="xs muted" style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr 1fr', gap: 8, paddingBottom: 6 }}><span>Exercise</span><span>Sets×Reps</span><span>Weight</span></div>
              {[...(latest.workout_sets ?? [])].sort((a, b) => a.position - b.position).map((s, i) => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr 1fr', gap: 8, fontSize: 14, minHeight: 34, alignItems: 'center', borderTop: '1px solid var(--line)' }}>
                  <span>{s.exercise}</span>
                  <span className="mono small">{s.sets ?? '–'}×{s.reps ?? '–'}</span>
                  <span className="mono small">{s.weight ?? ''}</span>
                </div>
              ))}
            </div>
          )}
          {latest.notes && <p className="small muted">{latest.notes}</p>}
        </button>
      ) : !list.loading && <Empty>No workouts logged yet. Moving your body is one of the best ways through an urge.</Empty>}

      {rest.length > 0 && (
        <div className="stack">
          <span className="lbl">Recent</span>
          {rest.slice(0, 12).map((w) => (
            <button key={w.id} className="card tight between" style={{ fontSize: 14 }} onClick={() => setEditing(w)}>
              <span>{w.title}</span>
              <span className="mono xs muted">{fmtDayTime(w.at)}{w.duration_min ? ` · ${w.duration_min} min` : ''}</span>
            </button>
          ))}
        </div>
      )}

      <div className="spacer" />
      <div className="btn-row">
        <button className="btn steel-outline" onClick={() => setScheduling(true)}><Icon name="calendar" size={18} />Schedule on Outlook</button>
        <button className="btn primary" onClick={() => setEditing('new')}>New workout</button>
      </div>

      {editing && session && (
        <WorkoutSheet w={editing === 'new' ? null : editing} userId={session.user.id} onClose={close}
          onSaved={() => { close(); list.reload(); toast('Workout logged'); }} />
      )}
      {scheduling && <ScheduleSheet onClose={() => setScheduling(false)} onDone={(m) => { setScheduling(false); toast(m); }} />}
    </div>
  );
}

function WorkoutSheet({ w, userId, onClose, onSaved }: { w: Workout | null; userId: string; onClose: () => void; onSaved: () => void }) {
  const [title, setTitle] = useState(w?.title ?? '');
  const [at, setAt] = useState(localInput(w ? new Date(w.at) : new Date()));
  const [duration, setDuration] = useState(String(w?.duration_min ?? ''));
  const [notes, setNotes] = useState(w?.notes ?? '');
  const [sets, setSets] = useState<WorkoutSet[]>(
    w?.workout_sets?.length ? [...w.workout_sets].sort((a, b) => a.position - b.position) : [{ position: 0, exercise: '', sets: null, reps: null, weight: '' }],
  );
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const setRow = (i: number, patch: Partial<WorkoutSet>) => setSets((s) => s.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const num = (v: string) => (v === '' ? null : Number(v));

  async function save() {
    if (!title.trim()) return setErr('Name the workout.');
    setBusy(true);
    setErr(null);
    try {
      const row = { user_id: userId, title: title.trim(), at: new Date(at).toISOString(), duration_min: num(duration), notes: notes.trim() || null };
      const saved = w
        ? (must(await supabase.from('workouts').update(row).eq('id', w.id).select().single()) as Workout)
        : (must(await supabase.from('workouts').insert(row).select().single()) as Workout);
      if (w) must(await supabase.from('workout_sets').delete().eq('workout_id', w.id));
      const clean = sets.filter((s) => s.exercise.trim()).map((s, i) => ({
        workout_id: saved.id, user_id: userId, position: i, exercise: s.exercise.trim(), sets: s.sets, reps: s.reps, weight: s.weight?.trim() || null,
      }));
      if (clean.length) must(await supabase.from('workout_sets').insert(clean));
      onSaved();
    } catch (e) {
      setErr((e as Error).message);
      setBusy(false);
    }
  }

  async function remove() {
    if (!w) return;
    setBusy(true);
    await supabase.from('workouts').delete().eq('id', w.id);
    onSaved();
  }

  return (
    <Sheet onClose={onClose} label={w ? 'Edit workout' : 'New workout'}>
      <span className="lbl">{w ? 'Edit workout' : 'New workout'}</span>
      <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Push day" aria-label="Workout name" />
      <div className="grid2">
        <input className="input" type="datetime-local" value={at} onChange={(e) => setAt(e.target.value)} aria-label="When" />
        <input className="input" type="number" inputMode="numeric" min="0" value={duration} onChange={(e) => setDuration(e.target.value)} placeholder="Minutes" aria-label="Duration in minutes" />
      </div>
      <div className="stack" style={{ maxHeight: '32vh', overflowY: 'auto', gap: 8 }}>
        {sets.map((s, i) => (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '1.6fr .6fr .6fr .9fr 36px', gap: 6 }}>
            <input className="input sm" value={s.exercise} onChange={(e) => setRow(i, { exercise: e.target.value })} placeholder="Exercise" aria-label={`Exercise ${i + 1}`} />
            <input className="input sm" type="number" inputMode="numeric" value={s.sets ?? ''} onChange={(e) => setRow(i, { sets: num(e.target.value) })} placeholder="Sets" aria-label="Sets" />
            <input className="input sm" type="number" inputMode="numeric" value={s.reps ?? ''} onChange={(e) => setRow(i, { reps: num(e.target.value) })} placeholder="Reps" aria-label="Reps" />
            <input className="input sm" value={s.weight ?? ''} onChange={(e) => setRow(i, { weight: e.target.value })} placeholder="185 lb" aria-label="Weight" />
            <button className="icon-btn" style={{ width: 36, height: 40, borderRadius: 8 }} aria-label="Remove row" onClick={() => setSets((x) => x.filter((_, j) => j !== i))}><Icon name="x" size={16} /></button>
          </div>
        ))}
      </div>
      <button className="btn dashed" onClick={() => setSets((s) => [...s, { position: s.length, exercise: '', sets: null, reps: null, weight: '' }])}>
        <Icon name="plus" size={16} />Add exercise
      </button>
      <textarea className="textarea" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes" aria-label="Notes" />
      <ErrorNote msg={err} />
      <button className="btn primary full" disabled={busy} onClick={save}>{busy ? 'Saving…' : 'Save workout'}</button>
      {w && <button className="btn ghost full" disabled={busy} onClick={remove}>Delete</button>}
    </Sheet>
  );
}

function ScheduleSheet({ onClose, onDone }: { onClose: () => void; onDone: (msg: string) => void }) {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(6, 0, 0, 0);
  const [title, setTitle] = useState('Workout');
  const [at, setAt] = useState(localInput(tomorrow));
  const [mins, setMins] = useState('60');
  const [repeat, setRepeat] = useState<'' | 'daily' | 'weekly'>('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function go() {
    setBusy(true);
    setErr(null);
    try {
      const start = new Date(at);
      await createEvent({ subject: title, start, end: new Date(start.getTime() + (Number(mins) || 60) * 60_000), kind: 'workout', recurrence: repeat || undefined });
      onDone('Added to Outlook');
    } catch (e) {
      setErr((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <Sheet onClose={onClose} label="Schedule a workout">
      <span className="lbl">Schedule on Outlook</span>
      <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} aria-label="Title" />
      <div className="grid2">
        <input className="input" type="datetime-local" value={at} onChange={(e) => setAt(e.target.value)} aria-label="Start" />
        <input className="input" type="number" min="5" value={mins} onChange={(e) => setMins(e.target.value)} aria-label="Minutes" />
      </div>
      <select className="select" value={repeat} onChange={(e) => setRepeat(e.target.value as '' | 'daily' | 'weekly')} aria-label="Repeat">
        <option value="">Doesn't repeat</option>
        <option value="daily">Every day</option>
        <option value="weekly">Every week</option>
      </select>
      <ErrorNote msg={err} />
      <button className="btn primary full" disabled={busy} onClick={go}>{busy ? 'Adding…' : 'Add to Outlook'}</button>
    </Sheet>
  );
}
