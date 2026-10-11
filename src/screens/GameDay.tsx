import { useEffect, useMemo, useState } from 'react';
import { useApp, useLoad } from '../lib/store';
import { api } from '../lib/api';
import { resolveTv } from '../lib/channels';
import { createEvent, outlookStatus } from '../lib/outlook';
import { fmtTime } from '../lib/time';
import { Header, ErrorNote, Empty } from '../components/Chrome';
import { Icon } from '../components/Icon';
import type { Game } from '../lib/types';

const LABEL: Record<string, string> = { nfl: 'NFL', ncaaf: 'NCAAF', nhl: 'NHL', mlb: 'MLB' };

export default function GameDay() {
  const { profile, toast } = useApp();
  const leagues = profile?.leagues?.length ? profile.leagues : ['nfl', 'ncaaf', 'nhl', 'mlb'];
  const [filter, setFilter] = useState<string>('all');
  const q = new URLSearchParams({ leagues: leagues.join(','), teams: (profile?.follow_teams ?? []).join('|') });

  const games = useLoad(() => api<{ games: Game[]; updated: string }>(`scores?${q}`), [q.toString()]);
  const outlook = useLoad(() => outlookStatus(), []);

  const list = useMemo(() => {
    const all = (games.data?.games ?? []).map((g) => ({ ...g, tv: resolveTv(g.networks, profile?.channel_overrides) }));
    const order = { in: 0, pre: 1, post: 2 } as const;
    return all
      .filter((g) => filter === 'all' || g.league === filter)
      .sort((a, b) => order[a.state] - order[b.state] || Date.parse(a.start) - Date.parse(b.start));
  }, [games.data, filter, profile?.channel_overrides]);
  const live = list.filter((g) => g.state === 'in').length;

  // Refresh every 30 s while anything is live, every 5 min otherwise.
  useEffect(() => {
    const t = window.setInterval(() => games.reload(), live ? 30_000 : 300_000);
    return () => window.clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live]);

  async function addToCalendar(g: Game) {
    try {
      const start = new Date(g.start);
      const tv = resolveTv(g.networks, profile?.channel_overrides);
      await createEvent({
        subject: `${g.away.name} at ${g.home.name}`,
        start,
        end: new Date(start.getTime() + 3 * 3_600_000),
        kind: 'game',
        body: tv ? `On ${tv.label}${tv.channel ? ` (DirecTV ch ${tv.channel})` : ''}` : undefined,
      });
      toast('Game added to Outlook');
    } catch (e) {
      toast((e as Error).message);
    }
  }

  return (
    <div className="screen">
      <Header kicker="DirecTV · Las Vegas" title="Game Day" right={
        live > 0 ? <span className="row xs" style={{ gap: 6, color: 'var(--urge-text)' }}><span className="dot" style={{ background: '#E0703F' }} />{live} live</span> : null
      } />

      <div className="chips">
        {['all', ...leagues].map((l) => (
          <button key={l} className={`chip${filter === l ? ' on' : ''}`} aria-pressed={filter === l} onClick={() => setFilter(l)}>{l === 'all' ? 'All' : LABEL[l] ?? l}</button>
        ))}
      </div>

      <ErrorNote msg={games.error} />
      {games.loading && !games.data && <span className="small muted">Loading scores…</span>}
      {!games.loading && list.length === 0 && <Empty>No games today for the leagues and teams you follow.</Empty>}

      {list.map((g) => {
        const isLive = g.state === 'in';
        const status = isLive ? `LIVE · ${g.detail}` : g.state === 'pre' ? `Today ${fmtTime(g.start)}` : g.detail;
        const dateTag = new Date(g.start).toDateString() !== new Date().toDateString()
          ? new Date(g.start).toLocaleDateString('en-US', { weekday: 'short' }) + ' · ' : '';
        return (
          <div key={`${g.league}-${g.id}`} className={`card tight game${isLive ? ' live' : ''}`}>
            <div className="between xs muted">
              <span style={isLive ? { color: 'var(--urge-text)', fontWeight: 600 } : undefined}>{LABEL[g.league]} · {g.state === 'pre' ? dateTag : ''}{status}</span>
              {g.tv && (
                <span className="tv"><Icon name="tv" size={12} width={2} />{g.tv.label}{g.tv.channel ? ` · ch ${g.tv.channel}` : g.tv.streaming ? ' · stream' : ''}</span>
              )}
            </div>
            {[g.away, g.home].map((t, i) => (
              <div key={i} className="tm" style={g.state === 'post' && Number(t.score) < Number((i ? g.away : g.home).score) ? { color: 'var(--muted)' } : undefined}>
                <span>{t.rank ? <span className="mono xs muted">{t.rank} </span> : null}{t.name}</span>
                {g.state !== 'pre' ? <span className="sc">{t.score}</span>
                  : i === 1 && outlook.data?.connected ? (
                    <button className="icon-btn" style={{ width: 36, height: 36 }} aria-label={`Add ${g.away.name} at ${g.home.name} to Outlook`} onClick={() => addToCalendar(g)}>
                      <Icon name="calendarAdd" size={16} />
                    </button>
                  ) : null}
              </div>
            ))}
          </div>
        );
      })}

      <div className="spacer" />
      <div className="card dashed xs muted">
        No betting lines shown. Watching at a bar or party? Add the game to your calendar so the evening gets flagged.
        {games.data?.updated ? ` Updated ${fmtTime(games.data.updated)}.` : ''}
      </div>
    </div>
  );
}
