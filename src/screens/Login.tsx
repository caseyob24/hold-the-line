import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { ErrorNote } from '../components/Chrome';

export default function Login({ redirectTo, heading }: { redirectTo?: string; heading?: string }) {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: redirectTo ?? window.location.origin },
    });
    setBusy(false);
    if (error) setErr(error.message);
    else setSent(true);
  }

  return (
    <div className="app">
      <form className="screen no-tabs" onSubmit={send}>
        <div className="head" style={{ marginTop: 40 }}>
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#D4AE52" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M5 9l7-4 7 4M5 13l7-4 7 4M5 17l7-4 7 4" />
          </svg>
          <span className="lbl brass">{heading ?? 'Report for duty'}</span>
          <h1 className="title" style={{ fontSize: 44 }}>Hold the Line</h1>
          <p className="muted">One day at a time, with backup.</p>
        </div>
        <div className="spacer" />
        {sent ? (
          <div className="card hero stack">
            <span className="lbl brass">Orders sent</span>
            <p>Check <b>{email}</b> for a sign-in link. Open it on this device.</p>
            <button type="button" className="btn dashed" onClick={() => setSent(false)}>Use a different email</button>
          </div>
        ) : (
          <>
            <label className="field">
              <span className="lbl">Email</span>
              <input className="input" type="email" autoComplete="email" required value={email}
                onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
            </label>
            <ErrorNote msg={err} />
            <button className="btn primary full" disabled={busy}>{busy ? 'Sending…' : 'Send sign-in link'}</button>
          </>
        )}
      </form>
    </div>
  );
}
