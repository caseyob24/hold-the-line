import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useApp, useLoad } from '../lib/store';
import { must, supabase } from '../lib/supabase';
import { dateKey, daysSince } from '../lib/time';
import { DAILY_GOAL } from '../lib/workbook';
import { Header, ErrorNote } from '../components/Chrome';
import { Icon } from '../components/Icon';
import type { Review as ReviewRow } from '../lib/types';
import { track } from '../lib/track';

/**
 * Evening confirmation. One question first — did you hold the line today? — then the debrief.
 * "Held" + a hard day is stored as `struggled` (still sober); "No" is `slipped` and offers to
 * reset the counter for the front that gave way.
 */
const EFFORT = ['Easy', 'Manageable', 'Hard', 'Brutal'] as const;
type Effort = (typeof EFFORT)[number];
const EFFORT_TAG = 'Effort: ';
const DIFFICULTIES = ['Cravings', 'Work stress', 'Social pressure', 'Sleep', 'Loneliness', 'Boredom', 'Anger', 'Family', 'Money', 'Game day', 'Nothing today'];

export default function Review() {
  const { session, profile, sobrieties, links, toast, refresh } = useApp();
  const nav = useNavigate();
  const [params] = useSearchParams();
  const today = dateKey(new Date(), profile?.timezone);
  const primary = sobrieties.find((s) => s.is_primary) ?? sobrieties[0];
  const sponsor = links.find((l) => l.status === 'active');

  const [held, setHeld] = useState<boolean | null>(() => (params.get('outcome') === 'held' ? true : params.get('outcome') === 'slipped' ? false : null));
  const [effort, setEffort] = useState<Effort | null>(null);
  const [diffs, setDiffs] = useState<string[]>([]);
  const [notes, setNotes] = useState('');
  const [right, setRight] = useState('');
  const [share, setShare] = useState(profile?.share_checkins_default ?? true);
  const [slipFront, setSlipFront] = useState<string | null>(primary?.id ?? null);
  const [resetCounter, setResetCounter] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const existing = useLoad(async () => {
    const { data } = await supabase.from('reviews').select('*').eq('date', today).maybeSingle();
    return data as ReviewRow | null;
  }, [today]);
  useEffect(() => {
    const r = existing.data;
    if (!r) return;
    setHeld(r.outcome !== 'slipped');
    const tag = r.difficulties.find((d) => d.startsWith(EFFORT_TAG));
    setEffort((tag?.slice(EFFORT_TAG.length) as Effort) ?? (r.outcome === 'struggled' ? 'Hard' : null));
    setDiffs(r.difficulties.filter((d) => !d.startsWith(EFFORT_TAG)));
    setNotes(r.difficult_notes ?? '');
    setRight(r.went_right ?? '');
    setShare(r.shared_with_sponsor);
    setResetCounter(false); // already logged once; don't reset twice by accident
  }, [existing.data]);

  const tally = useLoad(async () => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const [c, w, u] = await Promise.all([
      supabase.from('check_ins').select('pledged, created_at').eq('date', today).maybeSingle(),
      supabase.from('workbook_entries').select('id', { count: 'exact', head: true }).eq('date', today),
      supabase.from('urges').select('id', { count: 'exact', head: true }).gte('at', start.toISOString()),
    ]);
    return { pledged: Boolean(c.data?.pledged), pledgedAt: c.data?.created_at as string | undefined, drills: w.count ?? 0, urges: u.count ?? 0 };
  }, [today]);

  const flip = (v: string) => setDiffs((d) => (d.includes(v) ? d.filter((x) => x !== v) : v === 'Nothing today' ? ['Nothing today'] : [...d.filter((x) => x !== 'Nothing today'), v]));
  const canSubmit = held !== null && (held ? effort !== null : true) && !busy;

  async function submit() {
    if (!session || held === null) return;
    setBusy(true);
    setErr(null);
    const outcome: ReviewRow['outcome'] = !held ? 'slipped' : effort === 'Hard' || effort === 'Brutal' ? 'struggled' : 'held';
    const difficulties = [...(effort ? [`${EFFORT_TAG}${effort}`] : []), ...diffs];
    try {
      must(await supabase.from('reviews').upsert({
        user_id: session.user.id, date: today, outcome, difficulties,
        difficult_notes: notes.trim() || null, went_right: right.trim() || null, shared_with_sponsor: share,
      }, { onConflict: 'user_id,date' }));
      if (!held && resetCounter && slipFront) {
        const sob = sobrieties.find((s) => s.id === slipFront);
        if (sob) {
          const now = new Date().toISOString();
          must(await supabase.from('streak_history').insert({ sobriety_id: sob.id, user_id: session.user.id, started_at: sob.start_at, ended_at: now, reason: notes.trim() || 'Logged at evening debrief' }));
          must(await supabase.from('sobrieties').update({ start_at: now }).eq('id', sob.id));
          await refresh();
        }
      }
    } catch (e) {
      setBusy(false);
      return setErr((e as Error).message);
    }
    setBusy(false);
    track('review_saved', { outcome });
    if (!held) {
      toast('Logged. A slip is a setback, not a discharge. Pledge again in the morning.');
      nav('/reach-out');
    } else {
      toast(outcome === 'held' ? `Day ${primary ? daysSince(primary.start_at) : ''} closed. Held.` : 'Closed out. You made it through a hard one.');
      nav('/');
    }
  }

  const dayNo = primary ? daysSince(primary.start_at) : null;

  return (
    <div className="screen sponsor">
      <Header kicker={`Evening confirmation${dayNo != null ? ` · Day ${dayNo}` : ''}`} kickerClass="steel" title="Did you hold the line today?" back />

      <div className="grid2" role="radiogroup" aria-label="Did you hold the line today">
        <button role="radio" aria-checked={held === true} className="btn full arc-yes" style={{ minHeight: 64, opacity: held === false ? 0.45 : 1 }} onClick={() => setHeld(true)}>
          <Icon name="check" width={2.4} />Yes, I held
        </button>
        <button role="radio" aria-checked={held === false} className="btn full arc-no" style={{ minHeight: 64, opacity: held === true ? 0.45 : 1 }} onClick={() => setHeld(false)}>
          No, I slipped
        </button>
      </div>

      {held === true && (
        <div className="stack">
          <span className="lbl">How hard was it?</span>
          <div className="btn-row" role="radiogroup" aria-label="How hard was today">
            {EFFORT.map((e) => (
              <button key={e} role="radio" aria-checked={effort === e} className="btn ghost" style={{ minHeight: 46, fontSize: 14, ...(effort === e ? { borderColor: 'var(--steel)', background: 'var(--steel-soft)', color: 'var(--steel-text)' } : {}) }} onClick={() => setEffort(e)}>{e}</button>
            ))}
          </div>
        </div>
      )}

      {held === false && (
        <div className="card urge stack" style={{ gap: 10 }}>
          <span className="lbl" style={{ color: 'var(--urge-text)' }}>Logging a slip</span>
          <p style={{ margin: 0, fontSize: 15, lineHeight: 1.45 }}>Honest beats perfect. Your past streak stays on your record either way.</p>
          {sobrieties.length > 1 && (
            <div className="stack" style={{ gap: 6 }}>
              <span className="xs muted">Which front?</span>
              <div className="chips">
                {sobrieties.map((s) => (
                  <button key={s.id} className={`chip${slipFront === s.id ? ' on-urge' : ''}`} aria-pressed={slipFront === s.id} onClick={() => setSlipFront(s.id)}>{s.name}</button>
                ))}
              </div>
            </div>
          )}
          <label className="check"><input type="checkbox" checked={resetCounter} onChange={(e) => setResetCounter(e.target.checked)} style={{ accentColor: 'var(--urge)' }} />
            Reset the {sobrieties.find((s) => s.id === slipFront)?.name ?? 'counter'} counter to day zero now
          </label>
        </div>
      )}

      {held !== null && (
        <>
          <div className="stack">
            <span className="lbl">What was difficult?</span>
            <div className="chips">
              {DIFFICULTIES.map((d) => (
                <button key={d} aria-pressed={diffs.includes(d)} className={`chip${diffs.includes(d) ? ' on-urge' : ''}`} onClick={() => flip(d)}>{d}</button>
              ))}
            </div>
            <textarea className="textarea" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={held ? 'What happened? (optional)' : 'What led up to it? Where, who, what time?'} aria-label="What was difficult, in your words" />
          </div>

          <label className="field">
            <span className="lbl">One thing that went right</span>
            <textarea className="textarea" rows={2} value={right} onChange={(e) => setRight(e.target.value)} placeholder={held ? '' : 'Even today. There was one.'} />
          </label>
        </>
      )}

      {tally.data && (
        <div className="card tight stack" style={{ fontSize: 14, gap: 4 }}>
          <span className="lbl" style={{ fontSize: 12 }}>Today's tally</span>
          <span className="mono xs muted">
            {tally.data.pledged ? `Pledged${tally.data.pledgedAt ? ` ${new Date(tally.data.pledgedAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}` : ''} ✓` : 'Not pledged'} · Drills {Math.min(tally.data.drills, DAILY_GOAL)}/{DAILY_GOAL} · {tally.data.urges} {tally.data.urges === 1 ? 'urge' : 'urges'}
          </span>
        </div>
      )}

      <ErrorNote msg={err} />
      <div className="spacer" />
      {sponsor && held !== null && (
        <label className="check"><input type="checkbox" checked={share} onChange={(e) => setShare(e.target.checked)} style={{ accentColor: 'var(--steel)' }} />Share with {sponsor.sponsor_name}</label>
      )}
      <button className={`btn full ${held === false ? 'alarm' : 'steel'}`} disabled={!canSubmit} onClick={submit}>
        {busy ? 'Saving…' : held === false ? 'Log the slip' : existing.data ? 'Update tonight’s debrief' : held === true ? 'Confirm: I held the line' : 'Answer first'}
      </button>
    </div>
  );
}
