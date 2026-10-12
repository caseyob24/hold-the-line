import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { ErrorNote } from '../components/Chrome';

/** Email-only sign-in. No password and no email to check: type your email and you're in. */
export default function Login({ heading }: { redirectTo?: string; heading?: string }) {
  const [email, setEmail] = useState(() => {
    try { return localStorage.getItem('htl_last_email') ?? ''; } catch { return ''; }
  });
  const [busy, setBusy] = useState<null | 'in' | 'create'>(null);
  const [err, setErr] = useState<string | null>(null);
  const [missing, setMissing] = useState(false);

  async function go(create: boolean) {
    const clean = email.trim().toLowerCase();
    if (!clean) return setErr('Enter your email.');
    setBusy(create ? 'create' : 'in');
    setErr(null);
    setMissing(false);
    try {
      const res = await fetch('/api/email-login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: clean, create }),
      });
      const body = await res.json().catch(() => ({}));
      if (res.status === 404) { setMissing(true); throw new Error(body.error); }
      if (!res.ok) throw new Error(body.error ?? `Sign-in failed (${res.status})`);
      let { error } = await supabase.auth.verifyOtp({ token_hash: body.token_hash, type: 'magiclink' });
      if (error) ({ error } = await supabase.auth.verifyOtp({ token_hash: body.token_hash, type: 'email' }));
      if (error) throw new Error(error.message);
      try { localStorage.setItem('htl_last_email', clean); } catch { /* private mode */ }
    } catch (e) {
      setErr((e as Error).message);
      setBusy(null);
    }
  }

  return (
    <div className="app">
      <form className="screen no-tabs" onSubmit={(e) => { e.preventDefault(); go(false); }}>
        <div className="head" style={{ marginTop: 40 }}>
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#D4AE52" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M5 9l7-4 7 4M5 13l7-4 7 4M5 17l7-4 7 4" />
          </svg>
          <span className="lbl brass">{heading ?? 'Report for duty'}</span>
          <h1 className="title" style={{ fontSize: 44 }}>Hold the Line</h1>
          <p className="muted">One day at a time, with backup.</p>
        </div>
        <div className="spacer" />

        <label className="field">
          <span className="lbl">Email</span>
          <input className="input" type="email" autoComplete="email" inputMode="email" autoCapitalize="none" required value={email}
            onChange={(e) => { setEmail(e.target.value); setMissing(false); }} placeholder="you@example.com" />
        </label>
        <ErrorNote msg={err} />
        <button className="btn primary full" disabled={busy !== null}>{busy === 'in' ? 'One moment…' : 'Sign in'}</button>
        <button type="button" className={`btn full ${missing ? 'primary' : 'dashed'}`} disabled={busy !== null} onClick={() => go(true)}>
          {busy === 'create' ? 'Creating…' : 'Create account'}
        </button>
        <a className="xs muted" href="/privacy" style={{ textAlign: 'center', padding: 8 }}>Privacy</a>
      </form>
    </div>
  );
}
