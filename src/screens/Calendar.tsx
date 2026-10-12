import { useMemo, useState } from 'react';
import { useApp, useLoad } from '../lib/store';
import { addDays, dateKey, fmtTime, startOfWeek } from '../lib/time';
import { connectOutlook, createEvent, getEvents, isHighRisk, outlookStatus, syncRiskEvents, type NewEvent } from '../lib/outlook';
import { Header, Sheet, ErrorNote } from '../components/Chrome';
import { Icon } from '../components/Icon';

const KIND_LABEL: Record<string, string> = {
  checkin: 'Hold the Line · check-in',
  workout: 'Hold the Line · workout',
  sponsor_call: 'Hold the Line · sponsor',
  game: 'Game Day',
  custom: 'Hold the Line',
};

export default function Calendar() {
  const { profile, session, links, toast } = useApp();
  const [weekStart, setWeekStart] = useState(startOfWeek());
  const [sel, setSel] = useState(dateKey(new Date()));
  const [adding, setAdding] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const status = useLoad(() => outlookStatus(), []);
  const week = useLoad(async () => {
    if (!status.data?.connected) return [];
    const evs = await getEvents(weekStart, addDays(weekStart, 7));
    if (session && profile) syncRiskEvents(session.user.id, evs.filter((e) => isHighRisk(e, profile))).catch(() => undefined);
    return evs;
  }, [status.data?.connected, weekStart.getTime()]);

  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);
  const dayEvents = (week.data ?? [])
    .filter((e) => dateKey(new Date(e.start)) === sel)
    .sort((a, b) => Date.parse(a.start) - Date.parse(b.start));
  const sponsor = links.find((l) => l.status === 'active');

  const monthLabel = weekStart.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  return (
    <div className="screen">
      <Header kicker={monthLabel} title="Campaign plan" right={
        status.data?.connected
          ? <span className="row xs" style={{ gap: 6, color: 'var(--steel-text)' }}><span className="dot" style={{ background: 'var(--good)' }} />Outlook synced</span>
          : null
      } />

      {status.data && !status.data.connected && (
        <div className="card steel stack">
          <span className="lbl steel">Outlook not connected</span>
          <p className="small">Connect your Outlook calendar to see your week here, flag risky evenings and add reminders.</p>
          <button className="btn steel" onClick={() => connectOutlook().catch((e) => setErr((e as Error).message))}>Connect Outlook</button>
        </div>
      )}

      <div className="row" style={{ gap: 6 }}>
        <button className="icon-btn" style={{ width: 30, height: 60, borderRadius: 10 }} aria-label="Previous week" onClick={() => setWeekStart(addDays(weekStart, -7))}><Icon name="back" size={16} /></button>
        <div className="days" style={{ flex: 1, minWidth: 0 }}>
          {days.map((d) => {
            const k = dateKey(d);
            return (
              <button key={k} className={`day${k === sel ? ' on' : ''}`} aria-pressed={k === sel} onClick={() => setSel(k)}>
                {d.toLocaleDateString('en-US', { weekday: 'short' })}<b>{d.getDate()}</b>
              </button>
            );
          })}
        </div>
        <button className="icon-btn" style={{ width: 30, height: 60, borderRadius: 10, transform: 'scaleX(-1)' }} aria-label="Next week" onClick={() => setWeekStart(addDays(weekStart, 7))}><Icon name="back" size={16} /></button>
      </div>

      <ErrorNote msg={err ?? week.error} />

      {status.data?.connected && (
        <div className="stack">
          {week.loading && <span className="small muted">Loading…</span>}
          {!week.loading && dayEvents.length === 0 && <span className="small muted">Nothing on the calendar this day.</span>}
          {dayEvents.map((e) => {
            const risky = profile ? isHighRisk(e, profile) : false;
            const cls = e.fromApp ? 'app' : risky ? 'risk' : 'outlook';
            return (
              <div key={e.id} className="ev">
                <span className="t">{e.isAllDay ? 'All day' : fmtTime(e.start)}</span>
                <div className={`box ${cls}`}>
                  <span className="between" style={{ gap: 8 }}>
                    <span>{e.subject}</span>
                    {risky && <span style={{ fontSize: 11, color: 'var(--urge-text)', fontWeight: 600 }}>HIGH RISK</span>}
                  </span>
                  <span className="src">
                    {e.fromApp ? KIND_LABEL[e.appKind ?? 'custom'] : 'Outlook'}
                    {e.location ? ` · ${e.location}` : ''}
                    {risky ? ` · plan your exit${sponsor ? ` + text ${sponsor.sponsor_name} after` : ''}` : ''}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="spacer" />
      {status.data?.connected && <button className="btn primary full" onClick={() => setAdding(true)}>Add to Outlook</button>}
      {adding && (
        <AddSheet day={sel} sponsorName={sponsor?.sponsor_name} reminderTime={profile?.checkin_reminder_time ?? '07:30'}
          onClose={() => setAdding(false)}
          onDone={(m) => { setAdding(false); toast(m); week.reload(); }} />
      )}
    </div>
  );
}

function AddSheet({ day, sponsorName, reminderTime, onClose, onDone }: {
  day: string; sponsorName?: string; reminderTime: string; onClose: () => void; onDone: (m: string) => void;
}) {
  const [preset, setPreset] = useState<'custom' | 'checkin' | 'sponsor_call'>('custom');
  const [title, setTitle] = useState('');
  const [time, setTime] = useState('17:30');
  const [mins, setMins] = useState('30');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function pick(p: typeof preset) {
    setPreset(p);
    if (p === 'checkin') { setTitle('Morning check-in'); setTime(reminderTime.slice(0, 5)); setMins('10'); }
    if (p === 'sponsor_call') { setTitle(`Call ${sponsorName ?? 'sponsor'}`); setTime('17:30'); setMins('30'); }
    if (p === 'custom') setTitle('');
  }

  async function go() {
    if (!title.trim()) return setErr('Add a title.');
    setBusy(true);
    setErr(null);
    try {
      const start = new Date(`${day}T${time}:00`);
      const ev: NewEvent = {
        subject: title.trim(), start, end: new Date(start.getTime() + (Number(mins) || 30) * 60_000),
        kind: preset, recurrence: preset === 'checkin' ? 'daily' : preset === 'sponsor_call' ? 'weekly' : undefined,
      };
      await createEvent(ev);
      onDone(ev.recurrence ? `Added — repeats ${ev.recurrence}` : 'Added to Outlook');
    } catch (e) {
      setErr((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <Sheet onClose={onClose} label="Add to Outlook">
      <span className="lbl">Add to Outlook · {new Date(`${day}T12:00:00`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</span>
      <div className="chips">
        <button className={`chip${preset === 'custom' ? ' on' : ''}`} onClick={() => pick('custom')}>Event</button>
        <button className={`chip${preset === 'checkin' ? ' on' : ''}`} onClick={() => pick('checkin')}>Daily check-in reminder</button>
        <button className={`chip${preset === 'sponsor_call' ? ' on' : ''}`} onClick={() => pick('sponsor_call')}>Weekly sponsor call</button>
      </div>
      <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" aria-label="Title" />
      <div className="grid2">
        <input className="input" type="time" value={time} onChange={(e) => setTime(e.target.value)} aria-label="Time" />
        <input className="input" type="number" min="5" value={mins} onChange={(e) => setMins(e.target.value)} aria-label="Minutes" />
      </div>
      <ErrorNote msg={err} />
      <button className="btn primary full" disabled={busy} onClick={go}>{busy ? 'Adding…' : 'Add'}</button>
    </Sheet>
  );
}
