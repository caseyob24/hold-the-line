import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { ErrorNote } from '../components/Chrome';

/**
 * Email + password sign-in. Signing in here (inside the Home Screen app) saves the session in
 * the app itself, so it stays signed in. The emailed link is only for first-time setup or a
 * forgotten password; it opens in Safari, where you can then set a password in Settings.
 */
export default function Login({ redirectTo, heading }: { redirectTo?: string; heading?: string }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<'password' | 'link'>('password');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (error) {
      setErr(error.message.toLowerCase().includes('invalid')
        ? "Email or password didn't match. No password yet? Use “Email me a link” once, then set one in Settings."
        : error.message);
    }
  }

  async function sendLink(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    const { error } = await supabase.auth.signInWithOtp({ email: email.trim(), options: { emailRedirectTo: redirectTo ?? window.location.origin } });
    setBusy(false);
    if (error) setErr(error.message);
    else setSent(true);
  }

  return (
    <div className="app">
      <form className="screen no-tabs" onSubmit={mode === 'password' ? signIn : sendLink}>
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
            <span className="lbl brass">Link sent</span>
            <p>Open the email on this phone. It signs you in through Safari — then go to <b>Settings → Sign-in password</b> to set a password, and use it here in the app from then on.</p>
            <button type="button" className="btn dashed" onClick={() => { setSent(false); setMode('password'); }}>Back to sign in</button>
          </div>
        ) : (
          <>
            <label className="field">
              <span className="lbl">Email</span>
              <input className="input" type="email" autoComplete="username" inputMode="email" required value={email}
                onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
            </label>
            {mode === 'password' && (
              <label className="field">
                <span className="lbl">Password</span>
                <input className="input" type="password" autoComplete="current-password" required value={password}
                  onChange={(e) => setPassword(e.target.value)} />
              </label>
            )}
            <ErrorNote msg={err} />
            <button className="btn primary full" disabled={busy}>
              {busy ? 'One moment…' : mode === 'password' ? 'Sign in' : 'Email me a link'}
            </button>
            <button type="button" className="btn dashed full" onClick={() => { setMode(mode === 'password' ? 'link' : 'password'); setErr(null); }}>
              {mode === 'password' ? 'First time or forgot password? Email me a link' : 'I have a password'}
            </button>
          </>
        )}
      </form>
    </div>
  );
}
