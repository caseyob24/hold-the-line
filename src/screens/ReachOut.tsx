import { useEffect, useRef, useState } from 'react';
import { useApp, useLoad } from '../lib/store';
import { must, supabase } from '../lib/supabase';
import { api } from '../lib/api';
import { Header, Sheet, ErrorNote } from '../components/Chrome';
import { Icon } from '../components/Icon';
import type { BackupContact } from '../lib/types';

const tel = (p: string) => `tel:${p.replace(/[^\d+]/g, '')}`;
const isIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent);
const sms = (p: string, body: string) => `sms:${p.replace(/[^\d+]/g, '')}${isIOS() ? '&' : '?'}body=${encodeURIComponent(body)}`;

export default function ReachOut() {
  const { links, session, profile, toast } = useApp();
  const sponsor = links.find((l) => l.status === 'active') ?? links[0];
  const [adding, setAdding] = useState(false);
  const [breathing, setBreathing] = useState(false);

  const contacts = useLoad(async () => {
    const { data } = await supabase.from('backup_contacts').select('*').order('name');
    return (data ?? []) as BackupContact[];
  }, []);

  async function alertSponsor() {
    try {
      await supabase.rpc('fire_reach_out');
      await api('push-flush', { method: 'POST' });
    } catch { /* the call itself matters more than the alert */ }
  }

  return (
    <div className="screen">
      <Header kicker="Call for backup" kickerClass="urge" title="You don't fight alone" />

      {sponsor?.sponsor_phone ? (
        <>
          <a href={tel(sponsor.sponsor_phone)} onClick={alertSponsor} className="btn alarm full"
            style={{ minHeight: 120, borderRadius: 18, flexDirection: 'column', gap: 8, textDecoration: 'none' }}>
            <Icon name="phone" size={32} />
            <span className="display" style={{ fontWeight: 700, fontSize: 26, letterSpacing: '.08em', textTransform: 'uppercase' }}>Call {sponsor.sponsor_name} now</span>
            <span style={{ fontSize: 13, fontWeight: 400 }}>{sponsor.status === 'active' ? 'Your sponsor also gets an alert' : 'Sponsor hasn’t joined the app yet'}</span>
          </a>
          <a className="btn alarm-soft full" onClick={alertSponsor}
            href={sms(sponsor.sponsor_phone, `It's ${profile?.display_name || 'me'}. I'm having a hard time and I need you. Can you call me?`)}>
            Send “I need you” text to {sponsor.sponsor_name}
          </a>
        </>
      ) : (
        <div className="card urge stack">
          <p className="small">{sponsor ? `Add ${sponsor.sponsor_name}'s phone number in the Sponsor tab to call with one tap.` : 'No sponsor yet. Add a backup contact below, or use the helplines.'}</p>
        </div>
      )}

      <div className="stack">
        <div className="between"><span className="lbl">Backup line</span>
          <button className="btn dashed" style={{ minHeight: 36, padding: '0 12px' }} onClick={() => setAdding(true)}><Icon name="plus" size={14} />Add</button></div>
        {(contacts.data ?? []).map((c) => (
          <div key={c.id} className="card tight row">
            <div className="avatar">{c.name.slice(0, 1).toUpperCase()}</div>
            <span style={{ flex: 1, fontSize: 15 }}>{c.name}{c.relation ? ` · ${c.relation}` : ''}</span>
            <a className="icon-btn" href={sms(c.phone, '')} aria-label={`Text ${c.name}`}><Icon name="chat" size={18} /></a>
            <a className="icon-btn" href={tel(c.phone)} aria-label={`Call ${c.name}`}><Icon name="phone" size={18} /></a>
          </div>
        ))}
        <a className="card tight row" href="https://www.aa.org/find-aa" target="_blank" rel="noreferrer" style={{ textDecoration: 'none', color: 'inherit' }}>
          <div className="avatar" style={{ background: '#3A3420', color: 'var(--brass-text)' }}>AA</div>
          <span style={{ flex: 1, fontSize: 15 }}>Find a meeting near me</span>
          <span className="icon-btn" aria-hidden="true"><Icon name="pin" size={18} /></span>
        </a>
        <div className="card tight row">
          <div className="avatar" style={{ background: '#2A2D24', color: 'var(--text)', fontSize: 11 }}>SAM</div>
          <div className="stack" style={{ flex: 1, gap: 2 }}><span style={{ fontSize: 15 }}>SAMHSA National Helpline</span><span className="mono xs muted">1-800-662-4357 · free, 24/7</span></div>
          <a className="icon-btn" href="tel:18006624357" aria-label="Call SAMHSA helpline"><Icon name="phone" size={18} /></a>
        </div>
        <div className="card tight row">
          <div className="avatar" style={{ background: '#2A2D24', color: 'var(--text)', fontSize: 12 }}>988</div>
          <div className="stack" style={{ flex: 1, gap: 2 }}><span style={{ fontSize: 15 }}>988 Crisis Lifeline</span><span className="mono xs muted">Call or text 988 · 24/7</span></div>
          <a className="icon-btn" href="tel:988" aria-label="Call 988"><Icon name="phone" size={18} /></a>
        </div>
      </div>

      <button className="card row" style={{ gap: 14, textAlign: 'left' }} onClick={() => setBreathing(true)}>
        <div style={{ width: 56, height: 56, borderRadius: 28, border: '2px solid var(--steel)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--steel-text)' }} className="display">4·4</div>
        <div className="stack" style={{ flex: 1, gap: 2 }}><span style={{ fontSize: 15, fontWeight: 600 }}>Box breathing · 2 min</span><span className="small muted">In 4, hold 4, out 4, hold 4</span></div>
      </button>

      {adding && session && (
        <AddContact userId={session.user.id} onClose={() => setAdding(false)} onSaved={() => { setAdding(false); contacts.reload(); toast('Added to your backup line'); }} />
      )}
      {breathing && <Breathing onClose={() => setBreathing(false)} />}
    </div>
  );
}

function AddContact({ userId, onClose, onSaved }: { userId: string; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [relation, setRelation] = useState('');
  const [err, setErr] = useState<string | null>(null);
  return (
    <Sheet onClose={onClose} label="Add backup contact">
      <span className="lbl">Backup contact</span>
      <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" aria-label="Name" />
      <input className="input" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone" aria-label="Phone" />
      <input className="input" value={relation} onChange={(e) => setRelation(e.target.value)} placeholder="Friend, brother…" aria-label="Relation" />
      <ErrorNote msg={err} />
      <button className="btn primary full" onClick={async () => {
        if (!name.trim() || !phone.trim()) return setErr('Name and phone are required.');
        try {
          must(await supabase.from('backup_contacts').insert({ user_id: userId, name: name.trim(), phone: phone.trim(), relation: relation.trim() || null }));
          onSaved();
        } catch (e) { setErr((e as Error).message); }
      }}>Save</button>
    </Sheet>
  );
}

const PHASES = ['Breathe in', 'Hold', 'Breathe out', 'Hold'] as const;

function Breathing({ onClose }: { onClose: () => void }) {
  const [tick, setTick] = useState(0); // seconds elapsed
  const timer = useRef<number>();
  useEffect(() => {
    timer.current = window.setInterval(() => setTick((t) => t + 1), 1000);
    return () => window.clearInterval(timer.current);
  }, []);
  const total = 120;
  const done = tick >= total;
  useEffect(() => { if (done) window.clearInterval(timer.current); }, [done]);
  const phase = Math.floor(tick / 4) % 4;
  const count = 4 - (tick % 4);
  const cls = phase === 0 ? 'in' : phase === 2 ? 'out' : phase === 1 ? 'in' : 'out';
  return (
    <Sheet onClose={onClose} label="Box breathing">
      <span className="lbl steel">Box breathing</span>
      <div style={{ padding: '24px 0' }}>
        <div className={`breath ${cls}`} aria-live="polite">
          <span className="display" style={{ fontSize: 22, fontWeight: 600 }}>{done ? 'Done' : PHASES[phase]}</span>
          {!done && <span className="big-num" style={{ fontSize: 40 }}>{count}</span>}
        </div>
      </div>
      <span className="small muted" style={{ textAlign: 'center' }}>{done ? 'Two minutes held. Check in with how you feel.' : `${Math.ceil((total - tick) / 60)} min left`}</span>
    </Sheet>
  );
}
