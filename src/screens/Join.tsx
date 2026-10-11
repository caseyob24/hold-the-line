import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useApp } from '../lib/store';
import Login from './Login';
import { ErrorNote } from '../components/Chrome';

export default function Join() {
  const { code = '' } = useParams();
  const { session, refresh } = useApp();
  const nav = useNavigate();
  const [info, setInfo] = useState<{ sponsee: string; status: string } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.rpc('invite_info', { code }).then(({ data, error }) => {
      if (error || !data) setErr('This invite link is not valid.');
      else setInfo(data as { sponsee: string; status: string });
    });
  }, [code]);

  if (!session) {
    return <Login redirectTo={window.location.href} heading={info ? `${info.sponsee} asked you to be their sponsor` : 'Sponsor invite'} />;
  }

  async function accept() {
    setBusy(true);
    const { error } = await supabase.rpc('accept_sponsor_invite', { code });
    setBusy(false);
    if (error) return setErr(error.message);
    await refresh();
    nav('/', { replace: true });
  }

  return (
    <div className="app">
      <div className="screen no-tabs sponsor">
        <div className="head" style={{ marginTop: 40 }}>
          <span className="lbl steel">Sponsor invite</span>
          <h1 className="title">{info ? `Stand with ${info.sponsee}` : 'Checking invite…'}</h1>
        </div>
        {info?.status === 'pending' && (
          <p className="muted">
            You'll see {info.sponsee}'s progress, get alerts when they need backup, send notes and witness their milestones.
            They choose exactly what you can see, and either of you can end it any time.
          </p>
        )}
        {info && info.status !== 'pending' && <div className="banner info">This invite has already been used.</div>}
        <ErrorNote msg={err} />
        <div className="spacer" />
        {info?.status === 'pending' && (
          <button className="btn steel full" disabled={busy} onClick={accept}>{busy ? 'Joining…' : 'Accept and continue'}</button>
        )}
        <button className="btn dashed full" onClick={() => nav('/', { replace: true })}>Not now</button>
      </div>
    </div>
  );
}
