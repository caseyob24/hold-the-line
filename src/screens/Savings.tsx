import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../lib/store';
import { daysSince, money } from '../lib/time';
import { Header, Sheet, ErrorNote } from '../components/Chrome';

export default function Savings() {
  const { sobrieties, profile, updateProfile, toast } = useApp();
  const [goalOpen, setGoalOpen] = useState(false);

  const rows = sobrieties.map((s) => {
    const d = daysSince(s.start_at);
    return { s, d, saved: d * Number(s.daily_cost_usd), hours: d * Number(s.daily_hours) };
  });
  const totalSaved = rows.reduce((n, r) => n + r.saved, 0);
  const totalHours = rows.reduce((n, r) => n + r.hours, 0);
  const unset = rows.filter((r) => !Number(r.s.daily_cost_usd));
  const goal = Number(profile?.war_chest_goal_usd) || 0;

  return (
    <div className="screen">
      <Header kicker="Spoils of war" title="What you've reclaimed" />

      <div className="grid2">
        <div className="card hero stack" style={{ gap: 4 }}>
          <span className="lbl brass">Money</span>
          <span className="big-num" style={{ fontSize: 44 }}>{money(totalSaved)}</span>
          <span className="xs muted">{unset.length ? `+ ${unset.map((r) => r.s.name.toLowerCase()).join(', ')}, once set` : 'all fronts'}</span>
        </div>
        <div className="card stack" style={{ gap: 4 }}>
          <span className="lbl">Time</span>
          <span className="big-num" style={{ fontSize: 44 }}>{Math.round(totalHours)} h</span>
          <span className="xs muted">{totalHours ? 'reclaimed so far' : 'set hours/day per front'}</span>
        </div>
      </div>

      <div className="card" style={{ padding: '12px 16px' }}>
        <span className="lbl" style={{ display: 'block', padding: '4px 0 6px' }}>By front</span>
        {rows.map((r, i) => (
          <div key={r.s.id} className="between" style={{ minHeight: 40, borderTop: i ? '1px solid var(--line)' : 0, fontSize: 15 }}>
            <span>{r.s.name}{Number(r.s.daily_cost_usd) ? ` · ${money(Number(r.s.daily_cost_usd))}/day` : ''}</span>
            {Number(r.s.daily_cost_usd)
              ? <span className="mono small">{money(r.saved)}</span>
              : <Link to="/sobrieties" className="mono small">Set</Link>}
          </div>
        ))}
      </div>

      <button className="card stack" style={{ textAlign: 'left' }} onClick={() => setGoalOpen(true)}>
        <div className="between"><span className="lbl">War chest goal</span>
          <span className="mono xs muted">{goal ? `${money(totalSaved)} / ${money(goal)}` : 'Tap to set'}</span></div>
        <span style={{ fontSize: 16, fontWeight: 600 }}>{profile?.war_chest_label || 'Pick a reward to save toward'}</span>
        <div className="bar" style={{ height: 8 }}><div style={{ width: `${goal ? Math.min(100, (totalSaved / goal) * 100) : 0}%` }} /></div>
      </button>

      <div className="card stack">
        <span className="lbl">Health recovery timeline</span>
        <p className="small muted">
          Per-substance recovery milestones (sleep, blood pressure, lung function) will appear here once the copy is sourced from
          medical references. Talk to your doctor about what to expect for your situation.
        </p>
      </div>

      {goalOpen && profile && (
        <GoalSheet label={profile.war_chest_label ?? ''} amount={goal ? String(goal) : ''} onClose={() => setGoalOpen(false)}
          onSave={async (label, amount) => {
            await updateProfile({ war_chest_label: label || null, war_chest_goal_usd: Number(amount) || null });
            setGoalOpen(false);
            toast('Goal set');
          }} />
      )}
    </div>
  );
}

function GoalSheet({ label, amount, onClose, onSave }: { label: string; amount: string; onClose: () => void; onSave: (l: string, a: string) => Promise<void> }) {
  const [l, setL] = useState(label);
  const [a, setA] = useState(amount);
  const [err, setErr] = useState<string | null>(null);
  return (
    <Sheet onClose={onClose} label="War chest goal">
      <span className="lbl">War chest goal</span>
      <label className="field"><span className="lbl">Reward</span><input className="input" value={l} onChange={(e) => setL(e.target.value)} placeholder="New tattoo session" /></label>
      <label className="field"><span className="lbl">Amount ($)</span><input className="input" type="number" inputMode="decimal" min="0" value={a} onChange={(e) => setA(e.target.value)} /></label>
      <ErrorNote msg={err} />
      <button className="btn primary full" onClick={() => onSave(l.trim(), a).catch((e) => setErr((e as Error).message))}>Save goal</button>
    </Sheet>
  );
}
