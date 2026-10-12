import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp, useLoad } from '../lib/store';
import { supabase } from '../lib/supabase';
import { dateKey, daysSince } from '../lib/time';
import { DAILY_GOAL } from '../lib/workbook';
import { Header, ErrorNote } from '../components/Chrome';
import type { Review as ReviewRow } from '../lib/types';
import { track } from '../lib/track';

const OUTCOMES = [
  { k: 'held', label: 'Held the line', on: { borderColor: 'var(--olive)', background: '#22261A', color: '#DCE3A8' } },
  { k: 'struggled', label: 'Struggled', on: { borderColor: 'var(--brass)', background: 'var(--brass-soft)', color: 'var(--brass-text)' } },
  { k: 'slipped', label: 'Slipped', on: { borderColor: 'var(--urge)', background: 'var(--urge-soft)', color: 'var(--urge-text)' } },
] as const;
const DIFFICULTIES = ['Cravings', 'Work stress', 'Social pressure', 'Sleep', 'Loneliness', 'Boredom', 'Anger', 'Family', 'Money', 'Nothing today'];

export default function Review() {
  const { session, profile, sobrieties, links, toast } = useApp();
  const nav = useNavigate();
  const today = dateKey(new Date(), profile?.timezone);
  const primary = sobrieties.find((s) => s.is_primary) ?? sobrieties[0];
  const sponsor = links.find((l) => l.status === 'active');

  const [outcome, setOutcome] = useState<ReviewRow['outcome'] | null>(null);
  const [diffs, setDiffs] = useState<string[]>([]);
  const [notes, setNotes] = useState('');
  const [right, setRight] = useState('');
  const [share, setShare] = useState(profile?.share_checkins_default ?? true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const existing = useLoad(async () => {
    const { data } = await supabase.from('reviews').select('*').eq('date', today).maybeSingle();
    return data as ReviewRow | null;
  }, [today]);
  useEffect(() => {
    const r = existing.data;
    if (!r) return;
    setOutcome(r.outcome);
    setDiffs(r.difficulties);
    setNotes(r.difficult_notes ?? '');
    setRight(r.went_right ?? '');
    setShare(r.shared_with_sponsor);
  }, [existing.data]);

  const tally = useLoad(async () => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const [c, w, u] = await Promise.all([
      supabase.from('check_ins').select('pledged').eq('date', today).maybeSingle(),
      supabase.from('workbook_entries').select('id', { count: 'exact', head: true }).eq('date', today),
      supabase.from('urges').select('id', { count: 'exact', head: true }).gte('at', start.toISOString()),
    ]);
    return { pledged: Boolean(c.data?.pledged), drills: w.count ?? 0, urges: u.count ?? 0 };
  }, [today]);

  const flip = (v: string) => setDiffs((d) => (d.includes(v) ? d.filter((x) => x !== v) : v === 'Nothing today' ? ['Nothing today'] : [...d.filter((x) => x !== 'Nothing today'), v]));

  async function submit() {
    if (!session || !outcome) return;
    setBusy(true);
    setErr(null);
    const { error } = await supabase.from('reviews').upsert({
      user_id: session.user.id, date: today, outcome, difficulties: diffs,
      difficult_notes: notes.trim() || null, went_right: right.trim() || null, shared_with_sponsor: share,
    }, { onConflict: 'user_id,date' });
    setBusy(false);
    if (error) return setErr(error.message);
    track('review_saved', { outcome });
    toast(outcome === 'held' ? 'Day closed out. Another one held.' : outcome === 'slipped' ? 'Logged. Tomorrow is a fresh pledge — reach out tonight.' : 'Logged. You made it through a hard one.');
    nav(outcome === 'slipped' ? '/reach-out' : '/');
  }

  return (
    <div className="screen sponsor">
      <Header kicker={`Evening debrief${primary ? ` · Day ${daysSince(primary.start_at)}` : ''}`} kickerClass="steel" title="How did today go?" back />

      <div className="btn-row" role="radiogroup" aria-label="How did today go">
        {OUTCOMES.map((o) => (
          <button key={o.k} role="radio" aria-checked={outcome === o.k} className="btn ghost" style={{ minHeight: 52, fontSize: 15, ...(outcome === o.k ? o.on : {}) }}
            onClick={() => setOutcome(o.k)}>{o.label}</button>
        ))}
      </div>

      <div className="stack">
        <span className="lbl">What was difficult?</span>
        <div className="chips">
          {DIFFICULTIES.map((d) => (
            <button key={d} aria-pressed={diffs.includes(d)} className={`chip${diffs.includes(d) ? ' on-urge' : ''}`} onClick={() => flip(d)}>{d}</button>
          ))}
        </div>
        <textarea className="textarea" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="What happened? (optional)" aria-label="What was difficult, in your words" />
      </div>

      <label className="field">
        <span className="lbl">One thing that went right</span>
        <textarea className="textarea" rows={2} value={right} onChange={(e) => setRight(e.target.value)} />
      </label>

      {tally.data && (
        <div className="card tight between" style={{ fontSize: 14 }}>
          <span>Today's tally</span>
          <span className="mono xs muted">
            {tally.data.pledged ? 'Pledged ✓' : 'Not pledged'} · Drills {Math.min(tally.data.drills, DAILY_GOAL)}/{DAILY_GOAL} · {tally.data.urges} {tally.data.urges === 1 ? 'urge' : 'urges'}
          </span>
        </div>
      )}

      <ErrorNote msg={err} />
      <div className="spacer" />
      {sponsor && (
        <label className="check"><input type="checkbox" checked={share} onChange={(e) => setShare(e.target.checked)} style={{ accentColor: 'var(--steel)' }} />Share with {sponsor.sponsor_name}</label>
      )}
      <button className="btn steel full" disabled={busy || !outcome} onClick={submit}>{busy ? 'Saving…' : existing.data ? 'Update debrief' : 'Close out the day'}</button>
    </div>
  );
}
