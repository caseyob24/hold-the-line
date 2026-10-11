import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp, useLoad } from '../lib/store';
import { supabase } from '../lib/supabase';
import { addDays, dateKey, daysSince, fmtTime } from '../lib/time';
import { getEvents, isHighRisk, outlookStatus, syncRiskEvents } from '../lib/outlook';
import { Header, ErrorNote } from '../components/Chrome';
import { Icon } from '../components/Icon';
import type { CheckIn as CheckInRow } from '../lib/types';

const MOODS = ['Rough', 'Low', 'Steady', 'Good', 'Strong'];

export default function CheckIn() {
  const { profile, sobrieties, session, links, toast } = useApp();
  const nav = useNavigate();
  const today = dateKey(new Date(), profile?.timezone);
  const primary = sobrieties.find((s) => s.is_primary) ?? sobrieties[0];
  const hasSponsor = links.some((l) => l.status === 'active');

  const [pledged, setPledged] = useState(false);
  const [mood, setMood] = useState<number | null>(null);
  const [notes, setNotes] = useState('');
  const [share, setShare] = useState(profile?.share_checkins_default ?? true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const existing = useLoad(async () => {
    const { data } = await supabase.from('check_ins').select('*').eq('date', today).maybeSingle();
    return data as CheckInRow | null;
  }, [today]);

  useEffect(() => {
    const c = existing.data;
    if (c) {
      setPledged(c.pledged);
      setMood(c.mood);
      setNotes(c.notes ?? '');
      setShare(c.shared_with_sponsor);
    }
  }, [existing.data]);

  const events = useLoad(async () => {
    const st = await outlookStatus();
    if (!st.connected) return null;
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const evs = await getEvents(start, addDays(start, 1));
    const risky = profile ? evs.filter((e) => isHighRisk(e, profile)) : [];
    if (session) syncRiskEvents(session.user.id, risky).catch(() => undefined);
    return { evs, risky };
  }, [profile?.id]);

  async function submit() {
    if (!session) return;
    setBusy(true);
    setErr(null);
    const { error } = await supabase.from('check_ins').upsert(
      { user_id: session.user.id, date: today, pledged, mood, notes: notes.trim() || null, shared_with_sponsor: share },
      { onConflict: 'user_id,date' },
    );
    setBusy(false);
    if (error) return setErr(error.message);
    toast(existing.data ? 'Check-in updated' : 'Reported for duty. Hold the line today.');
    nav('/');
  }

  const day = primary ? daysSince(primary.start_at) : 0;
  const firstRisk = events.data?.risky[0];

  return (
    <div className="screen">
      <Header kicker={`Morning roll call${primary ? ` · Day ${day}` : ''}`} title="Report for duty" />

      <div className="card hero stack" style={{ gap: 12 }}>
        <span className="lbl brass">Today's pledge</span>
        <p className="display" style={{ fontWeight: 500, fontSize: 22, lineHeight: 1.2 }}>
          I will stay sober today. Tomorrow is not my fight yet.
        </p>
        <button className={`btn ${pledged ? 'outline' : 'primary'} full`} aria-pressed={pledged} onClick={() => setPledged((v) => !v)}>
          {pledged ? <><Icon name="check" width={2.2} />Pledged</> : 'I pledge'}
        </button>
      </div>

      <div className="stack">
        <span className="lbl">How's morale?</span>
        <div className="mood-row" role="radiogroup" aria-label="Mood">
          {MOODS.map((m, i) => (
            <button key={m} role="radio" aria-checked={mood === i + 1} className={`mood${mood === i + 1 ? ' on' : ''}`} onClick={() => setMood(i + 1)}>
              <b>{i + 1}</b>{m}
            </button>
          ))}
        </div>
      </div>

      <label className="field">
        <span className="lbl">Field notes (optional)</span>
        <textarea className="textarea" rows={4} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="How'd you sleep? What's on deck today?" />
      </label>

      {events.data && (
        <button className="card tight row" style={{ textAlign: 'left' }} onClick={() => nav('/calendar')}>
          <Icon name="calendar" stroke="var(--steel)" size={22} />
          <div className="stack" style={{ gap: 2, flex: 1 }}>
            <span style={{ fontSize: 14 }}>Today on Outlook: {events.data.evs.length} {events.data.evs.length === 1 ? 'event' : 'events'}</span>
            <span className="xs muted">
              {firstRisk ? `${firstRisk.subject} at ${fmtTime(firstRisk.start)} flagged as a higher-risk evening` : 'No high-risk events flagged'}
            </span>
          </div>
        </button>
      )}

      <ErrorNote msg={err} />
      <div className="spacer" />
      {hasSponsor && (
        <label className="check"><input type="checkbox" checked={share} onChange={(e) => setShare(e.target.checked)} />Share today's check-in with my sponsor</label>
      )}
      <button className="btn outline full" disabled={busy || (!pledged && mood === null)} onClick={submit}>
        {busy ? 'Saving…' : existing.data ? 'Update check-in' : 'Submit check-in'}
      </button>
    </div>
  );
}
