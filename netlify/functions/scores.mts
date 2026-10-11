import type { Config } from '@netlify/functions';
import { handle, json } from '../lib/util';

// ESPN's public scoreboard JSON. Unofficial and undocumented: everything ESPN-specific lives in
// this file so a paid provider (SCORES_PROVIDER) can replace it without touching the app.
const ESPN: Record<string, string> = {
  nfl: 'football/nfl',
  ncaaf: 'football/college-football',
  nhl: 'hockey/nhl',
  mlb: 'baseball/mlb',
};

interface EspnCompetitor {
  homeAway: 'home' | 'away';
  score?: string;
  curatedRank?: { current?: number };
  team: { displayName: string; abbreviation: string };
}
interface EspnEvent {
  id: string;
  date: string;
  status: { type: { state: 'pre' | 'in' | 'post'; shortDetail: string } };
  competitions: {
    competitors: EspnCompetitor[];
    broadcasts?: { names?: string[] }[];
    geoBroadcasts?: { media?: { shortName?: string } }[];
  }[];
}

const cache = new Map<string, { at: number; games: Game[] }>();

interface Game {
  league: string;
  id: string;
  state: 'pre' | 'in' | 'post';
  detail: string;
  start: string;
  home: { name: string; abbr: string; score: string | null; rank: number | null };
  away: { name: string; abbr: string; score: string | null; rank: number | null };
  networks: string[];
}

async function fetchLeague(league: string): Promise<Game[]> {
  const hit = cache.get(league);
  const live = hit?.games.some((g) => g.state === 'in');
  if (hit && Date.now() - hit.at < (live ? 30_000 : 600_000)) return hit.games;

  const url = new URL(`https://site.api.espn.com/apis/site/v2/sports/${ESPN[league]}/scoreboard`);
  if (league === 'ncaaf') {
    url.searchParams.set('groups', '80'); // FBS
    url.searchParams.set('limit', '300');
  }
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`${league.toUpperCase()} scores unavailable (${res.status})`);
  const body = (await res.json()) as { events?: EspnEvent[] };

  const games = (body.events ?? []).map((e): Game => {
    const c = e.competitions[0];
    const side = (h: 'home' | 'away') => {
      const t = c.competitors.find((x) => x.homeAway === h)!;
      const rank = t.curatedRank?.current;
      return { name: t.team.displayName, abbr: t.team.abbreviation, score: t.score ?? null, rank: rank && rank <= 25 ? rank : null };
    };
    const nets = [
      ...(c.broadcasts ?? []).flatMap((b) => b.names ?? []),
      ...(c.geoBroadcasts ?? []).map((g) => g.media?.shortName ?? ''),
    ].filter(Boolean);
    return {
      league,
      id: e.id,
      state: e.status.type.state,
      detail: e.status.type.shortDetail,
      start: e.date,
      home: side('home'),
      away: side('away'),
      networks: [...new Set(nets)],
    };
  });
  cache.set(league, { at: Date.now(), games });
  return games;
}

export default handle(async (req) => {
  const u = new URL(req.url);
  const leagues = (u.searchParams.get('leagues') ?? 'nfl,ncaaf,nhl,mlb').split(',').filter((l) => l in ESPN);
  const follow = (u.searchParams.get('teams') ?? '').split('|').map((t) => t.trim().toLowerCase()).filter(Boolean);
  const isFollowed = (g: Game) => follow.some((t) => [g.home.name, g.away.name].some((n) => n.toLowerCase() === t));

  const results = await Promise.allSettled(leagues.map(fetchLeague));
  const games: Game[] = [];
  const errors: string[] = [];
  results.forEach((r, i) => {
    if (r.status === 'rejected') return errors.push((r.reason as Error).message);
    // College: AP Top 25 games plus teams you follow. Pro leagues: everything on the board.
    const list = leagues[i] === 'ncaaf' ? r.value.filter((g) => g.home.rank || g.away.rank || isFollowed(g)) : r.value;
    games.push(...list);
  });

  if (!games.length && errors.length) return json({ error: errors.join('; ') }, 502);
  const anyLive = games.some((g) => g.state === 'in');
  return json(
    { games, errors, updated: new Date().toISOString() },
    200,
    { 'Cache-Control': 'public, max-age=0, must-revalidate', 'Netlify-CDN-Cache-Control': `public, s-maxage=${anyLive ? 30 : 300}, stale-while-revalidate=60` },
  );
});

export const config: Config = { path: '/api/scores' };
