import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useApp, useLoad } from '../lib/store';
import { supabase } from '../lib/supabase';
import { AUTHORS } from '../lib/quotes';
import { connectOutlook, disconnectOutlook, outlookStatus } from '../lib/outlook';
import { enablePush, pushState } from '../lib/push';
import { biometricAvailable, biometricEnrolled, disableLock, enrollBiometric, lockEnabled, setPin } from '../lib/lock';
import { Header, Sheet, ErrorNote } from '../components/Chrome';
import channelMap from '../data/directv-lv-channels.json';
import type { Profile } from '../lib/types';

const LEAGUES = [{ k: 'nfl', l: 'NFL' }, { k: 'ncaaf', l: 'NCAAF' }, { k: 'nhl', l: 'NHL' }, { k: 'mlb', l: 'MLB' }];

export default function Settings() {
  const { profile, updateProfile, session, toast } = useApp();
  const [params, setParams] = useSearchParams();
  const [sheet, setSheet] = useState<null | 'quotes' | 'keywords' | 'teams' | 'channels' | 'pin' | 'name'>(null);
  const [push, setPush] = useState<'on' | 'off' | 'unsupported'>('off');
  const [lockOn, setLockOn] = useState(lockEnabled());
  const [bioOk, setBioOk] = useState(false);
  const outlook = useLoad(() => outlookStatus(), []);

  useEffect(() => { pushState().then(setPush); biometricAvailable().then(setBioOk); }, []);
  useEffect(() => {
    const o = params.get('outlook');
    if (o) {
      toast(o === 'connected' ? 'Outlook connected' : `Outlook: ${params.get('reason') ?? 'connection failed'}`);
      setParams({}, { replace: true });
    }
  }, [params, setParams, toast]);

  if (!profile) return null;
  const save = (patch: Partial<Profile>) => updateProfile(patch).catch((e) => toast((e as Error).message));
  const time = (t: string) => t.slice(0, 5);

  async function exportCsv() {
    const tables = ['sobrieties', 'streak_history', 'check_ins', 'urges', 'workouts', 'milestones'] as const;
    const parts: string[] = [];
    for (const t of tables) {
      const { data } = await supabase.from(t).select('*');
      const rows = (data ?? []) as Record<string, unknown>[];
      if (!rows.length) continue;
      const cols = Object.keys(rows[0]).filter((c) => c !== 'user_id');
      const esc = (v: unknown) => `"${String(Array.isArray(v) ? v.join('; ') : v ?? '').replace(/"/g, '""')}"`;
      parts.push(`# ${t}`, cols.join(','), ...rows.map((r) => cols.map((c) => esc(r[c])).join(',')), '');
    }
    const blob = new Blob([parts.join('\n')], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `hold-the-line-export-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  }

  return (
    <div className="screen">
      <Header title="Settings" back />

      <span className="lbl">You</span>
      <div className="group">
        <button className="item" onClick={() => setSheet('name')}><span>Name &amp; phone</span><span className="v">{profile.display_name}{profile.phone ? ` · ${profile.phone}` : ''}</span></button>
        <label className="item"><span>Time zone</span>
          <select className="select" style={{ width: 200, minHeight: 36, padding: '4px 8px', fontSize: 13 }} value={profile.timezone} onChange={(e) => save({ timezone: e.target.value })}>
            {['America/Los_Angeles', 'America/Denver', 'America/Phoenix', 'America/Chicago', 'America/New_York', 'Pacific/Honolulu', 'America/Anchorage'].map((z) => <option key={z}>{z}</option>)}
          </select>
        </label>
      </div>

      <span className="lbl">Daily quote</span>
      <div className="group">
        <button className="item" onClick={() => setSheet('quotes')}><span>Quote source</span><span className="v">{profile.quote_authors.length ? profile.quote_authors.map((a) => a.split(' ').slice(-1)[0]).join(', ') : 'All commanders'}</span></button>
        {!profile.notify_checkin && (
          <label className="item"><span>Quote-only push time</span>
            <input className="input sm" type="time" style={{ width: 120 }} value={time(profile.quote_time)} onChange={(e) => save({ quote_time: e.target.value })} /></label>
        )}
      </div>

      <span className="lbl">Integrations</span>
      <div className="group">
        <div className="item">
          <span>Outlook calendar</span>
          {outlook.data?.connected
            ? <button className="v" style={{ background: 'none', border: 0, color: 'var(--good)' }} onClick={async () => { await disconnectOutlook(); outlook.reload(); toast('Outlook disconnected'); }}>Connected · Disconnect</button>
            : <button className="v" style={{ background: 'none', border: 0, color: 'var(--brass)' }} onClick={() => connectOutlook().catch((e) => toast((e as Error).message))}>Connect</button>}
        </div>
        <label className="toggle">Flag high-risk events<input type="checkbox" checked={profile.risk_flagging} onChange={(e) => save({ risk_flagging: e.target.checked })} /></label>
        <button className="item" onClick={() => setSheet('keywords')}><span>Risk keywords</span><span className="v">{profile.risk_keywords.length} words · after {time(profile.risk_after)}</span></button>
        <div className="item"><span>Game Day leagues</span>
          <span className="row" style={{ gap: 4 }}>
            {LEAGUES.map((l) => {
              const on = profile.leagues.includes(l.k);
              return <button key={l.k} className={`chip${on ? ' on' : ''}`} style={{ minHeight: 32, padding: '0 8px', fontSize: 12 }} aria-pressed={on}
                onClick={() => save({ leagues: on ? profile.leagues.filter((x) => x !== l.k) : [...profile.leagues, l.k] })}>{l.l}</button>;
            })}
          </span>
        </div>
        <button className="item" onClick={() => setSheet('teams')}><span>Teams I follow</span><span className="v">{profile.follow_teams.length} teams</span></button>
        <button className="item" onClick={() => setSheet('channels')}><span>TV provider</span><span className="v">DirecTV · Las Vegas</span></button>
      </div>

      <span className="lbl">Notifications</span>
      <div className="group">
        <div className="item"><span>Push on this phone</span>
          {push === 'on' ? <span className="v" style={{ color: 'var(--good)' }}>On</span>
            : push === 'unsupported' ? <span className="v">Add to Home Screen first</span>
              : <button className="v" style={{ background: 'none', border: 0, color: 'var(--brass)' }} onClick={async () => { if (session) setPush((await enablePush(session.user.id)) === 'on' ? 'on' : 'off'); }}>Turn on</button>}
        </div>
        <label className="toggle">Morning pledge (with the day's quote)<input type="checkbox" checked={profile.notify_checkin} onChange={(e) => save({ notify_checkin: e.target.checked })} /></label>
        <label className="item"><span>Pledge time</span><input className="input sm" type="time" style={{ width: 120 }} value={time(profile.checkin_reminder_time)} onChange={(e) => save({ checkin_reminder_time: e.target.value })} /></label>
        <label className="toggle">Evening debrief<input type="checkbox" checked={profile.notify_review} onChange={(e) => save({ notify_review: e.target.checked })} /></label>
        <label className="item"><span>Debrief time</span><input className="input sm" type="time" style={{ width: 120 }} value={time(profile.review_time ?? '21:00')} onChange={(e) => save({ review_time: e.target.value })} /></label>
        <label className="toggle">Milestone celebrations<input type="checkbox" checked={profile.notify_milestones} onChange={(e) => save({ notify_milestones: e.target.checked })} /></label>
      </div>

      <span className="lbl">Privacy</span>
      <div className="group">
        <label className="toggle">Passcode lock
          <input type="checkbox" checked={lockOn} onChange={(e) => { if (e.target.checked) setSheet('pin'); else { disableLock(); setLockOn(false); } }} /></label>
        {lockOn && bioOk && (
          <div className="item"><span>Face ID / Touch ID</span>
            {biometricEnrolled() ? <span className="v" style={{ color: 'var(--good)' }}>On</span>
              : <button className="v" style={{ background: 'none', border: 0, color: 'var(--brass)' }} onClick={() => enrollBiometric(profile.display_name || 'me').then(() => toast('Face ID on')).catch((e) => toast((e as Error).message))}>Turn on</button>}
          </div>
        )}
        <label className="toggle">Share check-ins with sponsor by default<input type="checkbox" checked={profile.share_checkins_default} onChange={(e) => save({ share_checkins_default: e.target.checked })} /></label>
        <Link className="item" to="/sponsor"><span>Sponsor permissions</span><span className="v">Manage</span></Link>
        <button className="item" onClick={exportCsv}><span>Export my data</span><span className="v">CSV</span></button>
        <button className="item" onClick={() => supabase.auth.signOut()}><span>Sign out</span><span className="v">{session?.user.email}</span></button>
      </div>

      {sheet === 'name' && <NameSheet p={profile} onClose={() => setSheet(null)} onSave={async (patch) => { await save(patch); setSheet(null); }} />}
      {sheet === 'quotes' && <QuoteSheet selected={profile.quote_authors} onClose={() => setSheet(null)} onSave={async (a) => { await save({ quote_authors: a }); setSheet(null); }} />}
      {sheet === 'keywords' && <ListSheet title="Risk keywords" hint="Events whose title or location contains any of these are flagged." value={profile.risk_keywords}
        extra={<label className="field"><span className="lbl">Also flag anything starting after</span><input className="input" type="time" defaultValue={time(profile.risk_after)} onChange={(e) => save({ risk_after: e.target.value })} /></label>}
        onClose={() => setSheet(null)} onSave={async (v) => { await save({ risk_keywords: v }); setSheet(null); }} />}
      {sheet === 'teams' && <ListSheet title="Teams I follow" hint="Their games always show, plus every AP Top 25 college game. Use ESPN's full team names." value={profile.follow_teams}
        onClose={() => setSheet(null)} onSave={async (v) => { await save({ follow_teams: v }); setSheet(null); }} />}
      {sheet === 'channels' && <ChannelSheet overrides={profile.channel_overrides} onClose={() => setSheet(null)} onSave={async (o) => { await save({ channel_overrides: o }); setSheet(null); }} />}
      {sheet === 'pin' && <PinSheet onClose={() => setSheet(null)} onSet={() => { setLockOn(true); setSheet(null); toast('Passcode set'); }} />}
    </div>
  );
}

function NameSheet({ p, onClose, onSave }: { p: Profile; onClose: () => void; onSave: (patch: Partial<Profile>) => Promise<void> }) {
  const [name, setName] = useState(p.display_name);
  const [phone, setPhone] = useState(p.phone ?? '');
  return (
    <Sheet onClose={onClose} label="Name and phone">
      <span className="lbl">Name &amp; phone</span>
      <input className="input" value={name} onChange={(e) => setName(e.target.value)} aria-label="Name" />
      <input className="input" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Your mobile (your sponsor can call you)" aria-label="Phone" />
      <button className="btn primary full" onClick={() => onSave({ display_name: name.trim(), phone: phone.trim() || null })}>Save</button>
    </Sheet>
  );
}

function QuoteSheet({ selected, onClose, onSave }: { selected: string[]; onClose: () => void; onSave: (a: string[]) => Promise<void> }) {
  const [sel, setSel] = useState(selected);
  return (
    <Sheet onClose={onClose} label="Quote source">
      <span className="lbl">Quote source</span>
      <p className="small muted">Pick commanders, or none for all of them.</p>
      <div className="chips" style={{ maxHeight: '40vh', overflowY: 'auto' }}>
        {AUTHORS.map((a) => (
          <button key={a} className={`chip${sel.includes(a) ? ' on' : ''}`} aria-pressed={sel.includes(a)} onClick={() => setSel((s) => (s.includes(a) ? s.filter((x) => x !== a) : [...s, a]))}>{a}</button>
        ))}
      </div>
      <button className="btn primary full" onClick={() => onSave(sel)}>Save</button>
    </Sheet>
  );
}

function ListSheet({ title, hint, value, extra, onClose, onSave }: { title: string; hint: string; value: string[]; extra?: React.ReactNode; onClose: () => void; onSave: (v: string[]) => Promise<void> }) {
  const [text, setText] = useState(value.join('\n'));
  return (
    <Sheet onClose={onClose} label={title}>
      <span className="lbl">{title}</span>
      <p className="small muted">{hint} One per line.</p>
      <textarea className="textarea" rows={7} value={text} onChange={(e) => setText(e.target.value)} aria-label={title} />
      {extra}
      <button className="btn primary full" onClick={() => onSave(text.split('\n').map((s) => s.trim()).filter(Boolean))}>Save</button>
    </Sheet>
  );
}

function ChannelSheet({ overrides, onClose, onSave }: { overrides: Record<string, string>; onClose: () => void; onSave: (o: Record<string, string>) => Promise<void> }) {
  const base = channelMap.channels as Record<string, string>;
  const [vals, setVals] = useState<Record<string, string>>({ ...base, ...overrides });
  return (
    <Sheet onClose={onClose} label="DirecTV channels">
      <span className="lbl">DirecTV Las Vegas channels</span>
      <p className="small muted">Starting values — check each against your on-screen guide and fix any that are off.</p>
      <div className="stack" style={{ maxHeight: '45vh', overflowY: 'auto', gap: 6 }}>
        {Object.keys(vals).map((k) => (
          <label key={k} className="between" style={{ fontSize: 14 }}>
            <span>{k}</span>
            <input className="input sm" style={{ width: 90 }} inputMode="numeric" value={vals[k]} onChange={(e) => setVals((v) => ({ ...v, [k]: e.target.value }))} aria-label={`${k} channel`} />
          </label>
        ))}
      </div>
      <button className="btn primary full" onClick={() => {
        const diff = Object.fromEntries(Object.entries(vals).filter(([k, v]) => base[k] !== v));
        return onSave(diff);
      }}>Save</button>
    </Sheet>
  );
}

function PinSheet({ onClose, onSet }: { onClose: () => void; onSet: () => void }) {
  const [a, setA] = useState('');
  const [b, setB] = useState('');
  const [err, setErr] = useState<string | null>(null);
  return (
    <Sheet onClose={onClose} label="Set passcode">
      <span className="lbl">Set a 4-digit passcode</span>
      <input className="input mono" inputMode="numeric" type="password" maxLength={4} value={a} onChange={(e) => setA(e.target.value.replace(/\D/g, ''))} placeholder="••••" aria-label="Passcode" />
      <input className="input mono" inputMode="numeric" type="password" maxLength={4} value={b} onChange={(e) => setB(e.target.value.replace(/\D/g, ''))} placeholder="Confirm" aria-label="Confirm passcode" />
      <ErrorNote msg={err} />
      <button className="btn primary full" onClick={async () => {
        if (a.length !== 4) return setErr('Use 4 digits.');
        if (a !== b) return setErr("Those don't match.");
        await setPin(a);
        onSet();
      }}>Set passcode</button>
    </Sheet>
  );
}
