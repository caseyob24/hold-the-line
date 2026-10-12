import { useEffect, useState } from 'react';
import { useApp, useLoad } from '../lib/store';
import { supabase } from '../lib/supabase';
import { addDays, dateKey, daysSince, fmtDate, fmtDayTime, fmtTime } from '../lib/time';
import { nextRank } from '../lib/ranks';
import { Sheet, ErrorNote, Empty } from '../components/Chrome';
import { Thread } from '../components/Thread';
import { Icon } from '../components/Icon';
import type { Alert, SponseeDashboard } from '../lib/types';

const MOODS = ['', 'Rough', 'Low', 'Steady', 'Good', 'Strong'];

function alertText(a: Alert, name: string): { text: string; color: string } {
  const p = a.payload as Record<string, unknown>;
  switch (a.kind) {
    case 'urge': {
      const coping = (p.coping as string[] | undefined) ?? [];
      const held = coping.filter((c) => c !== 'Still in it');
      const tail = coping.includes('Still in it') ? ' · still in it — reach out' : held.length ? ` · held by ${held.join(', ').toLowerCase()}` : '';
      return { text: `${name} logged an urge · ${p.intensity}/10${tail}`, color: 'var(--urge)' };
    }
    case 'reach_out': return { text: `${name} hit Reach Out — call them now`, color: 'var(--alarm)' };
    case 'missed_checkin': return { text: `${name} hasn't checked in today`, color: '#5E6B78' };
    case 'milestone_upcoming': return { text: `${p.rank} (${p.days} days) coming up ${p.date ? fmtDate(String(p.date), { month: 'short', day: 'numeric' }) : 'soon'} — you can witness it`, color: 'var(--brass)' };
    case 'milestone_reached': return { text: `${name} reached ${p.rank} on ${p.sobriety ?? 'their streak'} (${p.days} days)`, color: 'var(--brass)' };
    default: return { text: a.kind, color: '#5E6B78' };
  }
}

export default function SponsorView() {
  const { session, profile, toast } = useApp();
  const me = session?.user.id ?? '';
  const dash = useLoad(async () => {
    const { data, error } = await supabase.rpc('sponsor_dashboard');
    if (error) throw new Error(error.message);
    return (data ?? []) as SponseeDashboard[];
  }, []);
  const [selId, setSelId] = useState<string | null>(null);
  const [witnessing, setWitnessing] = useState<{ id: string; rank: string } | null>(null);
  const list = dash.data ?? [];
  const s = list.find((x) => x.link_id === selId) ?? list[0];

  const alerts = useLoad(async () => {
    if (!s) return [];
    const { data } = await supabase.from('alerts').select('*').eq('link_id', s.link_id).order('created_at', { ascending: false }).limit(15);
    return (data ?? []) as Alert[];
  }, [s?.link_id]);

  // Live alerts + mark the visible ones seen.
  useEffect(() => {
    if (!s) return;
    const unseen = (alerts.data ?? []).filter((a) => !a.seen_at).map((a) => a.id);
    if (unseen.length) supabase.from('alerts').update({ seen_at: new Date().toISOString() }).in('id', unseen).then(() => undefined);
    const ch = supabase.channel(`alerts:${s.link_id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'alerts', filter: `link_id=eq.${s.link_id}` }, () => { alerts.reload(); dash.reload(); })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s?.link_id, alerts.data]);

  if (dash.loading && !dash.data) return <div className="screen sponsor"><span className="lbl steel">Loading…</span></div>;

  const primary = s?.sobrieties?.find((x) => x.is_primary) ?? s?.sobrieties?.[0];
  const days = primary ? daysSince(primary.start_at) : null;
  const next = days !== null ? nextRank(days) : null;
  const ci = s?.check_ins ?? null;
  const today = new Date();
  const strip = Array.from({ length: 14 }, (_, i) => {
    const k = dateKey(addDays(today, i - 13));
    return { k, done: Boolean(ci?.some((c) => c.date === k)) };
  });
  const latest = ci?.[0];
  const toWitness = s?.permissions.witness ? (s.milestones ?? []).filter((m) => !m.witnessed && Date.now() - Date.parse(m.reached_at) < 21 * 86_400_000) : [];

  return (
    <div className="screen sponsor">
      <div className="head">
        <span className="lbl steel">Sponsor command · {profile?.display_name}</span>
        <h1 className="title">{list.length === 1 ? `${list[0].name}'s progress` : 'Your sponsees'}</h1>
      </div>
      <ErrorNote msg={dash.error} />

      {!s && <Empty>No one has added you as their sponsor yet. When they send you an invite link, open it on this phone.</Empty>}

      {list.length > 1 && (
        <div className="chips" role="tablist">
          {list.map((x) => (
            <button key={x.link_id} role="tab" aria-selected={x.link_id === s?.link_id} className={`chip${x.link_id === s?.link_id ? ' on' : ''}`} onClick={() => setSelId(x.link_id)}>{x.name}</button>
          ))}
        </div>
      )}

      {s && (
        <>
          <div className="card steel stack" style={{ gap: 12 }}>
            <div className="row">
              <div className="avatar" style={{ width: 44, height: 44, borderRadius: 22, background: '#3A3420', color: 'var(--brass-text)' }}>{s.name.slice(0, 1).toUpperCase()}</div>
              <div className="stack" style={{ flex: 1, gap: 2 }}>
                <span style={{ fontSize: 17, fontWeight: 600 }}>{s.name}</span>
                <span className="small muted">
                  {ci === null ? 'Check-ins not shared' : latest && latest.date === dateKey(today)
                    ? `Checked in ${fmtTime(latest.created_at)}${latest.mood ? ` · morale ${latest.mood}/5 ${MOODS[latest.mood].toLowerCase()}` : ''}`
                    : 'No check-in yet today'}
                </span>
              </div>
              {days !== null ? (
                <div style={{ textAlign: 'right' }}><div className="big-num" style={{ fontSize: 40 }}>{days}</div><span className="lbl">days</span></div>
              ) : <span className="xs muted">Streak hidden</span>}
            </div>
            {ci !== null && (
              <>
                <div style={{ display: 'flex', gap: 4 }} aria-label={`Check-ins, last 14 days: ${strip.filter((d) => d.done).length} of 14`}>
                  {strip.map((d) => <div key={d.k} style={{ flex: 1, height: 18, borderRadius: 3, background: d.done ? '#5E8FC0' : '#2B3440' }} />)}
                </div>
                <span className="xs muted">Check-ins, last 14 days · {strip.filter((d) => d.done).length} of 14</span>
              </>
            )}
            {s.sobrieties && s.sobrieties.length > 1 && (
              <span className="xs muted">{s.sobrieties.map((x) => `${x.name} ${daysSince(x.start_at)}d`).join(' · ')}</span>
            )}
          </div>

          {s.reviews && s.reviews.length > 0 && (() => {
            const r = s.reviews[0];
            const color = r.outcome === 'held' ? 'var(--olive)' : r.outcome === 'struggled' ? 'var(--brass)' : 'var(--urge)';
            const label = r.outcome === 'held' ? 'Held the line' : r.outcome === 'struggled' ? 'Held — hard day' : 'Slipped';
            return (
              <div className="card tight stack" style={{ gap: 6 }}>
                <div className="between">
                  <span className="lbl">Debrief · {fmtDate(`${r.date}T12:00:00`, { weekday: 'short', month: 'short', day: 'numeric' })}</span>
                  <span className="small" style={{ color, fontWeight: 600, whiteSpace: 'nowrap' }}>{label}</span>
                </div>
                {r.difficulties.length > 0 && <span className="small muted">{r.difficulties.join(' · ')}</span>}
                {r.difficult_notes && <p className="small">{r.difficult_notes}</p>}
                {r.went_right && <p className="small" style={{ color: '#DCE3A8' }}>Went right: {r.went_right}</p>}
              </div>
            );
          })()}

          {toWitness.map((m) => (
            <div key={m.id} className="card hero row">
              <Icon name="medal" stroke="var(--brass)" size={26} />
              <div className="stack" style={{ flex: 1, gap: 2 }}>
                <span style={{ fontWeight: 600 }}>{m.rank} reached · {m.days} days</span>
                <span className="xs muted">{fmtDate(m.reached_at, { month: 'short', day: 'numeric' })} · waiting for your sign-off</span>
              </div>
              <button className="btn outline" style={{ minHeight: 44, fontSize: 15 }} onClick={() => setWitnessing({ id: m.id, rank: m.rank })}>Witness</button>
            </div>
          ))}

          <div className="stack" style={{ gap: 0 }}>
            <span className="lbl" style={{ paddingBottom: 4 }}>Alerts</span>
            {(alerts.data ?? []).length === 0 && <span className="small muted" style={{ padding: '8px 0' }}>All quiet.</span>}
            {(alerts.data ?? []).map((a) => {
              const t = alertText(a, s.name);
              return (
                <div key={a.id} className="row" style={{ alignItems: 'flex-start', padding: '12px 0', borderTop: '1px solid #29313A', fontSize: 14 }}>
                  <span className="dot" style={{ width: 10, height: 10, borderRadius: 5, marginTop: 5, background: t.color }} />
                  <div className="stack" style={{ flex: 1, gap: 2 }}><span>{t.text}</span><span className="mono xs muted">{fmtDayTime(a.created_at)}</span></div>
                </div>
              );
            })}
            {next && days !== null && s.permissions.streaks && (
              <div className="row" style={{ alignItems: 'flex-start', padding: '12px 0', borderTop: '1px solid #29313A', fontSize: 14 }}>
                <span className="dot" style={{ width: 10, height: 10, borderRadius: 5, marginTop: 5, background: 'var(--brass)' }} />
                <div className="stack" style={{ flex: 1, gap: 2 }}>
                  <span>Next: {next.name} ({next.days} days) on {fmtDate(addDays(new Date(primary!.start_at), next.days).toISOString(), { month: 'short', day: 'numeric' })}</span>
                  <span className="mono xs muted">Upcoming</span>
                </div>
              </div>
            )}
          </div>

          {s.risk_events && s.risk_events.length > 0 && (
            <div className="card tight stack">
              <span className="lbl urge">High-risk on the calendar</span>
              {s.risk_events.map((r, i) => <span key={i} className="small">{fmtDayTime(r.start_at)} · {r.title}</span>)}
            </div>
          )}

          {s.permissions.journal && latest?.notes && (
            <div className="card tight stack">
              <span className="lbl">Latest field notes</span>
              <p className="small">{latest.notes}</p>
            </div>
          )}

          <div className="card steel stack">
            <span className="lbl steel">Notes with {s.name}</span>
            <Thread linkId={s.link_id} meId={me} otherName={s.name} tone="steel" />
          </div>

          {s.phone && (
            <a className="btn steel-outline full" href={`tel:${s.phone.replace(/[^\d+]/g, '')}`}><Icon name="phone" size={18} />Call {s.name}</a>
          )}
        </>
      )}

      {witnessing && (
        <WitnessSheet m={witnessing} name={s?.name ?? ''} onClose={() => setWitnessing(null)}
          onDone={() => { setWitnessing(null); dash.reload(); toast('Signed off. They will see your note.'); }} />
      )}
    </div>
  );
}

function WitnessSheet({ m, name, onClose, onDone }: { m: { id: string; rank: string }; name: string; onClose: () => void; onDone: () => void }) {
  const [note, setNote] = useState('Earned it. Keep marching.');
  const [err, setErr] = useState<string | null>(null);
  return (
    <Sheet onClose={onClose} label="Witness milestone">
      <span className="lbl brass">Sign off on {m.rank}</span>
      <p className="small muted">Your note shows on {name}'s milestones screen.</p>
      <textarea className="textarea" rows={3} maxLength={280} value={note} onChange={(e) => setNote(e.target.value)} aria-label="Note" />
      <ErrorNote msg={err} />
      <button className="btn primary full" onClick={async () => {
        const { error } = await supabase.rpc('witness_milestone', { milestone: m.id, note });
        if (error) setErr(error.message); else onDone();
      }}>Witness {m.rank}</button>
    </Sheet>
  );
}
