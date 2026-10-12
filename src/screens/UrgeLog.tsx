import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp, useLoad } from '../lib/store';
import { supabase } from '../lib/supabase';
import { api } from '../lib/api';
import { Header, ErrorNote } from '../components/Chrome';
import type { Urge } from '../lib/types';
import { track } from '../lib/track';

const TRIGGERS = ['Stress', 'Boredom', 'Social event', 'Lonely', 'Tired', 'Celebrating', 'Game on TV', 'Anger', 'Payday', 'Other'];
const COPING = ['Called sponsor', 'Workout', 'Left the room', 'Breathing', 'Ate something', 'Went to a meeting', 'Played it forward', 'Still in it'];

function hourLabel(h: number) {
  const s = h % 12 === 0 ? 12 : h % 12;
  return `${s} ${h < 12 ? 'am' : 'pm'}`;
}

/** Plain-language pattern from the last 30 urges: busiest 3-hour window + most common trigger. */
function findPattern(urges: Urge[]): string | null {
  if (urges.length < 5) return null;
  const hours = urges.map((u) => new Date(u.at).getHours());
  let best = { start: 0, n: 0 };
  for (let s = 0; s < 24; s++) {
    const n = hours.filter((h) => (h - s + 24) % 24 < 3).length;
    if (n > best.n) best = { start: s, n };
  }
  const counts = new Map<string, number>();
  urges.flatMap((u) => u.triggers).forEach((t) => counts.set(t, (counts.get(t) ?? 0) + 1));
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
  const window = `${hourLabel(best.start)}–${hourLabel((best.start + 3) % 24)}`;
  const trig = top && top[1] >= 2 ? ` “${top[0]}” is your most common trigger (${top[1]} times).` : '';
  return `${best.n} of your last ${urges.length} urges hit between ${window}.${trig}`;
}

export default function UrgeLog() {
  const { session, sobrieties, focus, toast } = useApp();
  const nav = useNavigate();
  const [intensity, setIntensity] = useState(5);
  const [triggers, setTriggers] = useState<string[]>([]);
  const [coping, setCoping] = useState<string[]>([]);
  const [notes, setNotes] = useState('');
  const [sobrietyId, setSobrietyId] = useState<string>(focus?.id ?? sobrieties[0]?.id ?? '');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const history = useLoad(async () => {
    const { data } = await supabase.from('urges').select('*').order('at', { ascending: false }).limit(30);
    return (data ?? []) as Urge[];
  }, []);
  const pattern = history.data ? findPattern(history.data) : null;

  const flip = (list: string[], set: (v: string[]) => void, v: string) => set(list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  async function save(thenReachOut = false) {
    if (!session) return;
    setBusy(true);
    setErr(null);
    const { error } = await supabase.from('urges').insert({
      user_id: session.user.id, sobriety_id: sobrietyId || null, intensity, triggers, coping, notes: notes.trim() || null,
    });
    setBusy(false);
    if (error) return setErr(error.message);
    track('urge_logged');
    api('push-flush', { method: 'POST' }).catch(() => undefined); // tell the sponsor now, not at the next cron tick
    if (thenReachOut) return nav('/reach-out');
    toast(coping.includes('Still in it') ? 'Logged. Reach out — you don\'t fight alone.' : 'Logged. You held the line.');
    nav('/');
  }

  return (
    <div className="screen">
      <Header kicker="Incoming fire" kickerClass="urge" title="Log an urge" />
      <p className="small muted" style={{ marginTop: -8 }}>Naming it takes its power. Takes 20 seconds.</p>

      <div className="stack">
        <div className="between"><span className="lbl">Intensity</span><span className="mono small" style={{ color: 'var(--urge-text)' }}>{intensity} / 10</span></div>
        <div className="intensity" role="radiogroup" aria-label="Intensity from 1 to 10">
          {Array.from({ length: 10 }, (_, i) => (
            <button key={i} role="radio" aria-checked={intensity === i + 1} aria-label={`${i + 1}`} className={i < intensity ? 'on' : ''} onClick={() => setIntensity(i + 1)} />
          ))}
        </div>
      </div>

      {sobrieties.length > 1 && (
        <label className="field"><span className="lbl">Which front?</span>
          <select className="select" value={sobrietyId} onChange={(e) => setSobrietyId(e.target.value)}>
            {sobrieties.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </label>
      )}

      <div className="stack">
        <span className="lbl">What set it off?</span>
        <div className="chips">
          {TRIGGERS.map((t) => (
            <button key={t} aria-pressed={triggers.includes(t)} className={`chip${triggers.includes(t) ? ' on-urge' : ''}`} onClick={() => flip(triggers, setTriggers, t)}>{t}</button>
          ))}
        </div>
      </div>

      <div className="stack">
        <span className="lbl">How you held</span>
        <div className="chips">
          {COPING.map((t) => (
            <button key={t} aria-pressed={coping.includes(t)} className={`chip${coping.includes(t) ? ' on-ok' : ''}`} onClick={() => flip(coping, setCoping, t)}>{t}</button>
          ))}
        </div>
      </div>

      <label className="field"><span className="lbl">Notes (private)</span>
        <textarea className="textarea" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </label>

      {pattern && (
        <div className="card tight stack">
          <span className="lbl">Pattern spotted</span>
          <p style={{ fontSize: 14 }}>{pattern}</p>
        </div>
      )}

      <ErrorNote msg={err} />
      <div className="btn-row">
        <button className="btn alarm-soft" disabled={busy} onClick={() => save(true)}>Save &amp; reach out</button>
        <button className="btn primary" disabled={busy} onClick={() => save(false)}>Save log</button>
      </div>
    </div>
  );
}
