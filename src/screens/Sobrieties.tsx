import { useState } from 'react';
import { useApp } from '../lib/store';
import { must, supabase } from '../lib/supabase';
import { nextRank, progressToNext } from '../lib/ranks';
import { daysSince, fmtDate, inputDateToIso, isoToInputDate, money } from '../lib/time';
import { Header, Sheet, ErrorNote } from '../components/Chrome';
import { Icon } from '../components/Icon';
import type { Sobriety } from '../lib/types';
import { PRESET_FRONTS } from './Onboarding';

const BAR_COLORS = ['var(--brass)', 'var(--olive)', 'var(--steel)', 'var(--urge)'];

export default function Sobrieties() {
  const { sobrieties, session, refresh, toast } = useApp();
  const [editing, setEditing] = useState<Sobriety | 'new' | null>(null);
  const total = sobrieties.reduce((n, s) => n + daysSince(s.start_at), 0);

  return (
    <div className="screen">
      <Header title="My sobrieties" right={
        <button className="icon-btn brass" aria-label="Add a sobriety" onClick={() => setEditing('new')}><Icon name="plus" width={2.2} /></button>
      } />
      <span className="lbl">{sobrieties.length} {sobrieties.length === 1 ? 'front' : 'fronts'} · {total} combined days</span>

      {sobrieties.map((s, i) => {
        const days = daysSince(s.start_at);
        const next = nextRank(days);
        return (
          <button key={s.id} className={`card stack${s.is_primary ? ' hero' : ''}`} style={{ textAlign: 'left', gap: 12 }} onClick={() => setEditing(s)}>
            <div className="between" style={{ alignItems: 'flex-end' }}>
              <div className="stack" style={{ gap: 4 }}>
                <span style={{ fontSize: 17, fontWeight: 600 }}>{s.name}</span>
                <span className="small muted">Since {fmtDate(s.start_at)}{s.is_primary ? ' · primary' : ''}</span>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div className="big-num" style={{ fontSize: 52 }}>{days}</div>
                <span className="lbl">days</span>
              </div>
            </div>
            <div className="bar"><div style={{ width: `${progressToNext(days) * 100}%`, background: BAR_COLORS[i % BAR_COLORS.length] }} /></div>
            <div className="between xs muted">
              <span>{s.daily_cost_usd > 0 ? `Saved ${money(days * s.daily_cost_usd)}` : 'Set a daily cost to track savings'}</span>
              <span>{next ? `${next.name} in ${next.days - days} ${next.days - days === 1 ? 'day' : 'days'}` : 'General — top rank'}</span>
            </div>
          </button>
        );
      })}

      <div className="spacer" />
      <div className="card dashed small muted">
        Tap a card to edit it or reset the counter. Resetting keeps your past streaks on record — a relapse is a setback, not a discharge.
      </div>

      {editing && session && (
        <EditSobriety
          sob={editing === 'new' ? null : editing}
          userId={session.user.id}
          isFirst={sobrieties.length === 0}
          onClose={() => setEditing(null)}
          onSaved={async (msg) => { setEditing(null); await refresh(); toast(msg); }}
        />
      )}
    </div>
  );
}

function EditSobriety({ sob, userId, isFirst, onClose, onSaved }: {
  sob: Sobriety | null; userId: string; isFirst: boolean; onClose: () => void; onSaved: (msg: string) => void;
}) {
  const [name, setName] = useState(sob?.name ?? '');
  const [date, setDate] = useState(isoToInputDate(sob?.start_at ?? new Date().toISOString()));
  const [cost, setCost] = useState(String(sob?.daily_cost_usd ?? ''));
  const [hours, setHours] = useState(String(sob?.daily_hours ?? ''));
  const [primary, setPrimary] = useState(sob?.is_primary ?? isFirst);
  const [confirmReset, setConfirmReset] = useState(false);
  const [reason, setReason] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function run(fn: () => Promise<void>, msg: string) {
    setBusy(true);
    setErr(null);
    try { await fn(); onSaved(msg); } catch (e) { setErr((e as Error).message); setBusy(false); }
  }

  const save = () => run(async () => {
    if (!name.trim()) throw new Error('Give it a name.');
    const row = { name: name.trim(), start_at: inputDateToIso(date), daily_cost_usd: Number(cost) || 0, daily_hours: Number(hours) || 0, is_primary: primary };
    if (primary) await supabase.from('sobrieties').update({ is_primary: false }).eq('user_id', userId);
    if (sob) must(await supabase.from('sobrieties').update(row).eq('id', sob.id));
    else must(await supabase.from('sobrieties').insert({ ...row, user_id: userId }));
  }, sob ? 'Saved' : 'New front added');

  const reset = () => run(async () => {
    if (!sob) return;
    const now = new Date().toISOString();
    must(await supabase.from('streak_history').insert({ sobriety_id: sob.id, user_id: userId, started_at: sob.start_at, ended_at: now, reason: reason.trim() || null }));
    must(await supabase.from('sobrieties').update({ start_at: now }).eq('id', sob.id));
  }, 'Counter reset. Day one starts now — you are still in this.');

  const archive = () => run(async () => {
    if (!sob) return;
    must(await supabase.from('sobrieties').update({ archived_at: new Date().toISOString(), is_primary: false }).eq('id', sob.id));
  }, 'Archived');

  return (
    <Sheet onClose={onClose} label={sob ? `Edit ${sob.name}` : 'Add a front'}>
      <span className="lbl">{sob ? 'Edit front' : 'New front'}</span>
      {!confirmReset ? (
        <>
          <label className="field"><span className="lbl">Name</span>
            <input className="input" list="preset-fronts" value={name} onChange={(e) => setName(e.target.value)} />
            <datalist id="preset-fronts">{PRESET_FRONTS.map((p) => <option key={p} value={p} />)}</datalist>
          </label>
          <div className="grid2">
            <label className="field"><span className="lbl">Start date</span>
              <input className="input" type="date" value={date} max={isoToInputDate(new Date().toISOString())} onChange={(e) => setDate(e.target.value)} />
            </label>
            <label className="field"><span className="lbl">$ per day</span>
              <input className="input" type="number" inputMode="decimal" min="0" value={cost} onChange={(e) => setCost(e.target.value)} />
            </label>
          </div>
          <label className="field"><span className="lbl">Hours per day it took</span>
            <input className="input" type="number" inputMode="decimal" min="0" step="0.5" value={hours} onChange={(e) => setHours(e.target.value)} />
          </label>
          <label className="check"><input type="checkbox" checked={primary} onChange={(e) => setPrimary(e.target.checked)} />Show on the home screen (primary)</label>
          <ErrorNote msg={err} />
          <button className="btn primary full" disabled={busy} onClick={save}>Save</button>
          {sob && (
            <div className="btn-row">
              <button className="btn alarm-soft" disabled={busy} onClick={() => setConfirmReset(true)}>Reset counter</button>
              <button className="btn ghost" disabled={busy} onClick={archive}>Archive</button>
            </div>
          )}
        </>
      ) : (
        <>
          <p>Reset <b>{sob?.name}</b> to day zero? Your {daysSince(sob!.start_at)}-day streak is saved to your record.</p>
          <label className="field"><span className="lbl">What happened? (optional, private)</span>
            <textarea className="textarea" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} />
          </label>
          <ErrorNote msg={err} />
          <button className="btn alarm full" disabled={busy} onClick={reset}>Yes, reset to day zero</button>
          <button className="btn ghost full" onClick={() => setConfirmReset(false)}>Cancel</button>
        </>
      )}
    </Sheet>
  );
}
