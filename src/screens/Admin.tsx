import { supabase } from '../lib/supabase';
import { useLoad } from '../lib/store';
import { Header, ErrorNote } from '../components/Chrome';

interface Stats {
  users: number; onboarded: number; sponsors: number; active_links: number; sponsors_with_many: number;
  active_1d: number; active_7d: number; active_30d: number; new_7d: number; push_devices: number;
  check_ins_7d: number; reviews_7d: number; urges_7d: number; errors_7d: number;
  events_7d: { name: string; n: number }[];
  signups_by_week: { week: string; n: number }[];
  errors: { message: string; url: string | null; created_at: string }[];
}

function Stat({ n, label }: { n: number; label: string }) {
  return (
    <div className="card tight stack" style={{ gap: 2 }}>
      <b className="display" style={{ fontSize: 30, lineHeight: 1 }}>{n}</b>
      <span className="xs muted">{label}</span>
    </div>
  );
}

/** Owner-only overview. The database refuses the query for anyone who isn't an admin. */
export default function Admin() {
  const stats = useLoad(async () => {
    const { data, error } = await supabase.rpc('admin_stats');
    if (error) throw new Error(error.message);
    return data as Stats;
  }, []);
  const s = stats.data;
  const maxWeek = Math.max(1, ...(s?.signups_by_week ?? []).map((w) => w.n));

  return (
    <div className="screen">
      <Header kicker="Owner" title="Command post" back />
      <ErrorNote msg={stats.error} />
      {!s ? (!stats.error && <span className="small muted">Loading…</span>) : (
        <>
          <span className="lbl">People</span>
          <div className="grid3">
            <Stat n={s.users} label="Accounts" />
            <Stat n={s.onboarded} label="Set up" />
            <Stat n={s.new_7d} label="New this week" />
            <Stat n={s.sponsors} label="Sponsors" />
            <Stat n={s.active_links} label="Active pairings" />
            <Stat n={s.sponsors_with_many} label="Sponsors with 2+" />
          </div>

          <span className="lbl">Active</span>
          <div className="grid3">
            <Stat n={s.active_1d} label="Today" />
            <Stat n={s.active_7d} label="7 days" />
            <Stat n={s.active_30d} label="30 days" />
          </div>

          <span className="lbl">Last 7 days</span>
          <div className="grid3">
            <Stat n={s.check_ins_7d} label="Check-ins" />
            <Stat n={s.reviews_7d} label="Debriefs" />
            <Stat n={s.urges_7d} label="Urges logged" />
            <Stat n={s.push_devices} label="Push devices" />
            <Stat n={s.errors_7d} label="App errors" />
          </div>

          {s.signups_by_week.length > 0 && (
            <>
              <span className="lbl">Sign-ups by week</span>
              <div className="card stack" style={{ gap: 6 }}>
                {s.signups_by_week.map((w) => (
                  <div key={w.week} className="row" style={{ gap: 10, alignItems: 'center' }}>
                    <span className="mono xs muted" style={{ width: 70 }}>{w.week.slice(5)}</span>
                    <div style={{ flex: 1, height: 10, background: 'var(--line)', borderRadius: 5 }}>
                      <div style={{ width: `${(w.n / maxWeek) * 100}%`, height: '100%', background: 'var(--brass)', borderRadius: 5 }} />
                    </div>
                    <span className="xs" style={{ width: 24, textAlign: 'right' }}>{w.n}</span>
                  </div>
                ))}
              </div>
            </>
          )}

          <span className="lbl">What people use (7 days)</span>
          <div className="group">
            {s.events_7d.length ? s.events_7d.map((e) => (
              <div key={e.name} className="item"><span>{e.name.replace(/_/g, ' ')}</span><span className="v">{e.n}</span></div>
            )) : <div className="item"><span className="muted">No activity yet</span></div>}
          </div>

          <span className="lbl">Recent errors</span>
          <div className="group">
            {s.errors.length ? s.errors.map((e, i) => (
              <div key={i} className="item" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 2, padding: '10px 0' }}>
                <span style={{ fontSize: 13, wordBreak: 'break-word' }}>{e.message}</span>
                <span className="xs muted">{new Date(e.created_at).toLocaleString()}{e.url ? ` · ${e.url}` : ''}</span>
              </div>
            )) : <div className="item"><span className="muted">None. Clean line.</span></div>}
          </div>
          <span className="xs muted">Backups run nightly at about 3:30 am and keep the last 30 nights.</span>
        </>
      )}
    </div>
  );
}
