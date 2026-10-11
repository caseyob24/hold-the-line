import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { must, supabase } from '../lib/supabase';
import { useApp } from '../lib/store';
import { inputDateToIso, isoToInputDate } from '../lib/time';
import { connectOutlook } from '../lib/outlook';
import { Icon } from '../components/Icon';
import { ErrorNote } from '../components/Chrome';
import { shareInvite } from './SponsorHub';

export const PRESET_FRONTS = [
  'Alcohol', 'Nicotine', 'Cannabis', 'Gambling', 'Sports betting', 'Opioids', 'Stimulants',
  'Sugar', 'Caffeine', 'Porn', 'Social media', 'Energy drinks',
];

interface Front { name: string; date: string; cost: string }

export default function Onboarding() {
  const { session, profile, sobrieties, refresh, updateProfile } = useApp();
  const nav = useNavigate();
  // Coming back from the Outlook sign-in (fronts already saved) resumes at the sponsor step.
  const [step, setStep] = useState(sobrieties.length ? 3 : 1);
  const [name, setName] = useState(profile?.display_name ?? '');
  const [fronts, setFronts] = useState<Front[]>([]);
  const [custom, setCustom] = useState('');
  const [addingCustom, setAddingCustom] = useState(false);
  const [sponsorName, setSponsorName] = useState('');
  const [sponsorPhone, setSponsorPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const today = isoToInputDate(new Date().toISOString());

  const toggle = (n: string) =>
    setFronts((f) => (f.some((x) => x.name === n) ? f.filter((x) => x.name !== n) : [...f, { name: n, date: today, cost: '' }]));
  const setField = (n: string, k: keyof Front, v: string) => setFronts((f) => f.map((x) => (x.name === n ? { ...x, [k]: v } : x)));

  async function saveFronts() {
    if (!session) return;
    if (!fronts.length) return setErr('Pick at least one.');
    setBusy(true);
    setErr(null);
    try {
      await updateProfile({ display_name: name.trim() || profile?.display_name || 'Me', role: 'user' });
      must(await supabase.from('sobrieties').insert(fronts.map((f, i) => ({
        user_id: session.user.id,
        name: f.name,
        start_at: inputDateToIso(f.date),
        daily_cost_usd: Number(f.cost) || 0,
        is_primary: i === 0,
      }))));
      setStep(2);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function finish(withSponsor: boolean) {
    if (!session) return;
    setBusy(true);
    setErr(null);
    try {
      if (withSponsor && sponsorName.trim()) {
        const link = must(await supabase.from('sponsor_links').insert({
          user_id: session.user.id, sponsor_name: sponsorName.trim(), sponsor_phone: sponsorPhone.trim() || null,
        }).select().single()) as { invite_code: string };
        await shareInvite(link.invite_code, name || 'I', sponsorPhone.trim());
      }
      await updateProfile({ onboarded: true });
      await refresh();
      nav('/', { replace: true });
    } catch (e) {
      setErr((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <div className="app">
      <div className="screen no-tabs">
        <div style={{ display: 'flex', gap: 6 }} aria-label={`Step ${step} of 3`}>
          {[1, 2, 3].map((s) => (
            <div key={s} style={{ flex: 1, height: 4, borderRadius: 2, background: s <= step ? 'var(--brass)' : 'var(--line)' }} />
          ))}
        </div>

        {step === 1 && (
          <>
            <div className="head">
              <span className="lbl">Step 1 of 3 · Enlist</span>
              <h1 className="title" style={{ fontSize: 38 }}>What are you holding the line against?</h1>
              <p className="muted">Pick everything that applies. Each one gets its own counter and start date.</p>
            </div>
            <label className="field">
              <span className="lbl">Your name</span>
              <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Casey" autoComplete="given-name" />
            </label>
            <div className="chips">
              {[...PRESET_FRONTS, ...fronts.map((f) => f.name).filter((n) => !PRESET_FRONTS.includes(n))].map((n) => {
                const on = fronts.some((f) => f.name === n);
                return (
                  <button key={n} className={`chip${on ? ' on' : ''}`} aria-pressed={on} onClick={() => toggle(n)}>
                    {on && <Icon name="check" size={16} width={2.2} />}{n}
                  </button>
                );
              })}
              {addingCustom ? (
                <form className="row" onSubmit={(e) => { e.preventDefault(); if (custom.trim()) { toggle(custom.trim()); setCustom(''); setAddingCustom(false); } }}>
                  <input className="input" autoFocus value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="Name it" style={{ width: 160, minHeight: 44 }} aria-label="Custom front" />
                  <button className="chip on">Add</button>
                </form>
              ) : (
                <button className="chip add" onClick={() => setAddingCustom(true)}><Icon name="plus" size={16} />Add your own</button>
              )}
            </div>
            {fronts.length > 0 && (
              <div className="card stack">
                <span className="lbl">Start dates &amp; daily cost</span>
                {fronts.map((f) => (
                  <div key={f.name} className="between" style={{ minHeight: 44 }}>
                    <span style={{ flex: 1 }}>{f.name}</span>
                    <input className="input sm" type="number" inputMode="decimal" min="0" placeholder="$/day" aria-label={`${f.name} daily cost`}
                      value={f.cost} onChange={(e) => setField(f.name, 'cost', e.target.value)} style={{ width: 80 }} />
                    <input className="input sm" type="date" max={today} aria-label={`${f.name} start date`}
                      value={f.date} onChange={(e) => setField(f.name, 'date', e.target.value)} style={{ width: 150 }} />
                  </div>
                ))}
              </div>
            )}
            <ErrorNote msg={err} />
            <div className="spacer" />
            <button className="btn primary full" disabled={busy} onClick={saveFronts}>{busy ? 'Saving…' : 'Continue'}</button>
          </>
        )}

        {step === 2 && (
          <>
            <div className="head">
              <span className="lbl">Step 2 of 3 · Supply lines</span>
              <h1 className="title" style={{ fontSize: 38 }}>Connect your Outlook calendar</h1>
              <p className="muted">
                Check-in reminders, workouts and sponsor calls land on your calendar, and evenings with dinners, bars or games get
                flagged so you can plan ahead.
              </p>
            </div>
            <div className="spacer" />
            <button className="btn primary full" onClick={async () => {
              try { await connectOutlook(); } catch (e) { setErr((e as Error).message); }
            }}>Connect Outlook</button>
            <ErrorNote msg={err} />
            <button className="btn dashed full" onClick={() => setStep(3)}>Skip for now</button>
          </>
        )}

        {step === 3 && (
          <>
            <div className="head">
              <span className="lbl">Step 3 of 3 · Chain of command</span>
              <h1 className="title" style={{ fontSize: 38 }}>Invite your sponsor</h1>
              <p className="muted">They'll get a link to join. You choose what they can see, and you can change it any time.</p>
            </div>
            <label className="field">
              <span className="lbl">Sponsor's name</span>
              <input className="input" value={sponsorName} onChange={(e) => setSponsorName(e.target.value)} placeholder="Mark" />
            </label>
            <label className="field">
              <span className="lbl">Sponsor's mobile (for calls and texts)</span>
              <input className="input" type="tel" inputMode="tel" value={sponsorPhone} onChange={(e) => setSponsorPhone(e.target.value)} placeholder="(702) 555-0100" />
            </label>
            <ErrorNote msg={err} />
            <div className="spacer" />
            <button className="btn primary full" disabled={busy || !sponsorName.trim()} onClick={() => finish(true)}>
              {busy ? 'Saving…' : 'Send invite & finish'}
            </button>
            <button className="btn dashed full" disabled={busy} onClick={() => finish(false)}>Skip — I'll do this later</button>
          </>
        )}
      </div>
    </div>
  );
}
