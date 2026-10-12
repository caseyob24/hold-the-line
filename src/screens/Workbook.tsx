import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useApp, useLoad } from '../lib/store';
import { supabase } from '../lib/supabase';
import { dateKey, fmtDate } from '../lib/time';
import { DAILY_GOAL, DRILLS, drillByKey } from '../lib/workbook';
import { Header, ErrorNote } from '../components/Chrome';
import { Icon } from '../components/Icon';
import type { WorkbookEntry } from '../lib/types';
import { track } from '../lib/track';

/** All drills, grouped by category, with today's completions and recent history. */
export function WorkbookList() {
  const { profile } = useApp();
  const today = dateKey(new Date(), profile?.timezone);
  const entries = useLoad(async () => {
    const { data } = await supabase.from('workbook_entries').select('*').order('created_at', { ascending: false }).limit(60);
    return (data ?? []) as WorkbookEntry[];
  }, []);
  const doneToday = new Set((entries.data ?? []).filter((e) => e.date === today).map((e) => e.drill_key));
  const categories = [...new Set(DRILLS.map((d) => d.category))];
  const recent = (entries.data ?? []).filter((e) => e.date !== today).slice(0, 8);

  return (
    <div className="screen">
      <Header kicker={`${doneToday.size} of ${DAILY_GOAL} today`} title="Workbook" back />
      {categories.map((c) => (
        <div key={c} className="stack" style={{ gap: 8 }}>
          <span className="lbl">{c}</span>
          {DRILLS.filter((d) => d.category === c).map((d) => (
            <Link key={d.key} to={`/workbook/${d.key}`} className="card tight row" style={{ textDecoration: 'none', color: 'inherit' }}>
              <span className="stack" style={{ flex: 1, gap: 2 }}>
                <span style={{ fontWeight: 600, fontSize: 15 }}>{d.title}</span>
                <span className="xs muted">{d.subtitle}</span>
              </span>
              {doneToday.has(d.key) && <Icon name="check" stroke="var(--olive)" width={2.4} />}
            </Link>
          ))}
        </div>
      ))}
      {recent.length > 0 && (
        <div className="stack" style={{ gap: 8 }}>
          <span className="lbl">Your recent entries</span>
          {recent.map((e) => (
            <Link key={e.id} to={`/workbook/${e.drill_key}?date=${e.date}`} className="card tight between" style={{ textDecoration: 'none', color: 'inherit', fontSize: 14 }}>
              <span>{drillByKey(e.drill_key)?.title ?? e.drill_key}</span>
              <span className="mono xs muted">{fmtDate(`${e.date}T12:00:00`, { month: 'short', day: 'numeric' })}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

/** One drill. Opens today's entry (or a past one via ?date=) and saves answers. */
export function DrillScreen() {
  const { key = '' } = useParams();
  const { session, profile, toast, celebrate } = useApp();
  const nav = useNavigate();
  const drill = drillByKey(key);
  const today = dateKey(new Date(), profile?.timezone);
  const date = new URLSearchParams(window.location.search).get('date') ?? today;
  const readOnly = date !== today;
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const existing = useLoad(async () => {
    const { data } = await supabase.from('workbook_entries').select('*').eq('date', date).eq('drill_key', key).maybeSingle();
    return data as WorkbookEntry | null;
  }, [key, date]);
  const doneToday = useLoad(async () => {
    const { count } = await supabase.from('workbook_entries').select('id', { count: 'exact', head: true }).eq('date', today);
    return count ?? 0;
  }, [today]);

  useEffect(() => { if (existing.data) setAnswers(existing.data.answers ?? {}); }, [existing.data]);

  if (!drill) return <div className="screen"><Header title="Drill not found" back /></div>;
  const filled = drill.fields.some((f) => (answers[f.id] ?? '').trim());
  const position = existing.data ? doneToday.data ?? 0 : (doneToday.data ?? 0) + 1;

  async function save() {
    if (!session) return;
    setBusy(true);
    setErr(null);
    const { error } = await supabase.from('workbook_entries').upsert(
      { user_id: session.user.id, date: today, drill_key: drill!.key, answers },
      { onConflict: 'user_id,date,drill_key' },
    );
    setBusy(false);
    if (error) return setErr(error.message);
    track('drill_done', { drill: drill?.key });
    const n = existing.data ? doneToday.data ?? 0 : (doneToday.data ?? 0) + 1;
    if (!existing.data && n === DAILY_GOAL) { celebrate(); toast(`${DAILY_GOAL} of ${DAILY_GOAL}. Workbook done for today.`); }
    else toast(existing.data ? 'Updated' : `Drill complete · ${Math.min(n, DAILY_GOAL)} of ${DAILY_GOAL}`);
    nav('/today');
  }

  return (
    <div className="screen">
      <Header kicker={readOnly ? `${fmtDate(`${date}T12:00:00`, { month: 'short', day: 'numeric' })} · ${drill.category}` : `Drill ${Math.min(position, DAILY_GOAL)} of ${DAILY_GOAL} · ${drill.category}`} kickerClass="" title={drill.title} back />
      <p className="muted" style={{ fontSize: 15, marginTop: -6 }}>{drill.intro}</p>
      {drill.fields.map((f) => (
        <label key={f.id} className="field">
          <span className="lbl">{f.label}</span>
          <textarea className="textarea" rows={f.rows} value={answers[f.id] ?? ''} readOnly={readOnly}
            onChange={(e) => setAnswers((a) => ({ ...a, [f.id]: e.target.value }))} />
        </label>
      ))}
      <ErrorNote msg={err} />
      <div className="spacer" />
      <span className="xs muted" style={{ textAlign: 'center' }}>Saved to your private journal. Your sponsor never sees workbook answers.</span>
      {!readOnly && (
        <button className="btn primary full" disabled={busy || !filled} onClick={save}>
          {busy ? 'Saving…' : existing.data ? 'Update drill' : 'Complete drill'}
        </button>
      )}
    </div>
  );
}
