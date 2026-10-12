import { useState } from 'react';
import { useApp, useLoad } from '../lib/store';
import { supabase } from '../lib/supabase';
import { RANKS, currentRank, nextRank } from '../lib/ranks';
import { daysSince, fmtDate } from '../lib/time';
import { Header, Empty } from '../components/Chrome';
import { RankMark } from '../components/Icon';
import type { Milestone } from '../lib/types';

export default function Milestones() {
  const { sobrieties, links, focus } = useApp();
  const [selId, setSelId] = useState(focus?.id ?? sobrieties[0]?.id);
  const sob = sobrieties.find((s) => s.id === selId) ?? sobrieties[0];

  const ms = useLoad(async () => {
    if (!sob) return [];
    const { data } = await supabase.from('milestones').select('*').eq('sobriety_id', sob.id).eq('streak_started_at', sob.start_at).order('days');
    return (data ?? []) as Milestone[];
  }, [sob?.id, sob?.start_at]);

  if (!sob) return <div className="screen"><Header title="Rank & decorations" /><Empty to="/sobrieties" cta="Add a front">Nothing tracked yet.</Empty></div>;

  const days = daysSince(sob.start_at);
  const rank = currentRank(days);
  const next = nextRank(days);
  const witnessed = (ms.data ?? []).filter((m) => m.witnessed_at).sort((a, b) => Date.parse(b.witnessed_at!) - Date.parse(a.witnessed_at!))[0];
  const sponsorName = (id: string | null) => links.find((l) => l.sponsor_id === id)?.sponsor_name ?? 'Your sponsor';

  return (
    <div className="screen">
      <Header kicker={`${sob.name} · Day ${days}`} title="Rank & decorations" />

      {sobrieties.length > 1 && (
        <div className="chips" role="tablist">
          {sobrieties.map((s) => (
            <button key={s.id} role="tab" aria-selected={s.id === sob.id} className={`chip${s.id === sob.id ? ' on' : ''}`} onClick={() => setSelId(s.id)}>{s.name}</button>
          ))}
        </div>
      )}

      <div className="card hero row" style={{ gap: 16 }}>
        <span style={{ color: 'var(--brass)' }}><RankMark rank={rank?.name ?? 'Recruit'} size={56} /></span>
        <div className="stack" style={{ flex: 1, gap: 6 }}>
          <span className="lbl brass">Current rank</span>
          <span className="display" style={{ fontWeight: 700, fontSize: 28, lineHeight: 1 }}>{rank?.name ?? 'In basic training'}</span>
          <span className="small muted">{next ? `${next.name} at ${next.label} · ${next.days - days} to go` : 'Highest rank reached'}</span>
        </div>
      </div>

      <div className="grid3">
        {RANKS.map((r) => {
          const won = days >= r.days;
          return (
            <div key={r.key} className={`badge ${won ? 'won' : 'lock'}`} aria-label={`${r.name}, ${r.label}, ${won ? 'earned' : 'locked'}`}>
              <RankMark rank={r.name} />
              <span className="rk">{r.name}</span>
              <span className="xs muted">{r.label}</span>
            </div>
          );
        })}
      </div>

      {witnessed && (
        <div className="card tight stack">
          <span className="lbl">Witnessed by your sponsor</span>
          <p style={{ fontSize: 14 }}>
            {sponsorName(witnessed.witnessed_by)} signed off on {witnessed.rank} on {fmtDate(witnessed.witnessed_at!, { month: 'short', day: 'numeric' })}
            {witnessed.witness_note ? ` — “${witnessed.witness_note}”` : ''}
          </p>
        </div>
      )}
    </div>
  );
}
