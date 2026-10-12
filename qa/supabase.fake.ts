/* eslint-disable @typescript-eslint/no-explicit-any */
// In-memory stand-in for the Supabase client, used only by the QA harness (vite.qa.config.ts).
// Covers the query shapes the app uses: select/insert/upsert/update/delete with eq/neq/is/in/gte/lte,
// order/limit/range, single/maybeSingle, count+head, nested `workout_sets(*)`, rpc, auth, channels.

type Row = Record<string, any>;
const tables: Record<string, Row[]> = {};
const t = (n: string) => (tables[n] ??= []);
let seq = 1;
const uid = () => `00000000-0000-4000-8000-${String(seq++).padStart(12, '0')}`;
const nowIso = () => new Date().toISOString();
const daysAgo = (n: number, h = 8) => { const d = new Date(); d.setDate(d.getDate() - n); d.setHours(h, 0, 0, 0); return d; };
const dkey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export const ME = '11111111-1111-4111-8111-111111111111';
export const SPONSOR = '22222222-2222-4222-8222-222222222222';
const params = new URLSearchParams(location.search);
const scenario = params.get('qa') ?? 'user'; // user | fresh | sponsor | signedout

// ------------------------------------------------------------------ seed
function seed() {
  const profileDefaults = {
    display_name: 'Casey', phone: '702-555-0100', role: 'user', timezone: 'America/Los_Angeles', onboarded: true,
    quote_time: '06:30', quote_authors: [], quote_last_sent: null, checkin_reminder_time: '07:30', notify_checkin: true,
    notify_milestones: true, notify_evening: false, notify_review: true, review_time: '21:00', share_checkins_default: true,
    risk_flagging: true, risk_keywords: ['dinner', 'bar', 'happy hour', 'party', 'casino', 'game', 'drinks', 'tailgate'], risk_after: '18:00',
    leagues: ['nfl', 'ncaaf', 'nhl', 'mlb'], follow_teams: ['Las Vegas Raiders', 'Vegas Golden Knights', 'UNLV Rebels'], channel_overrides: {},
    war_chest_label: 'Trip to Ireland', war_chest_goal_usd: 2500, created_at: daysAgo(45).toISOString(), last_seen_at: nowIso(),
  };
  if (scenario === 'fresh') {
    t('profiles').push({ id: ME, ...profileDefaults, display_name: '', phone: null, onboarded: false, war_chest_label: null, war_chest_goal_usd: null });
    return;
  }
  if (scenario === 'sponsor') {
    t('profiles').push({ id: ME, ...profileDefaults, display_name: 'Pat', role: 'sponsor' });
    t('profiles').push({ id: SPONSOR, ...profileDefaults, display_name: 'Casey' });
    const link = { id: uid(), user_id: SPONSOR, sponsor_id: ME, sponsor_name: 'Pat', sponsor_phone: '702-555-0199', status: 'active', is_primary: true, invite_code: 'abc123',
      permissions: { streaks: true, checkins: true, urge_alerts: true, missed_checkin_alerts: true, witness: true, journal: true, risk_events: true }, invited_at: daysAgo(30).toISOString(), accepted_at: daysAgo(29).toISOString() };
    t('sponsor_links').push(link);
    t('alerts').push({ id: uid(), link_id: link.id, kind: 'urge', payload: { intensity: 7, triggers: ['stress'], name: 'Casey' }, created_at: daysAgo(0, 7).toISOString(), seen_at: null });
    t('alerts').push({ id: uid(), link_id: link.id, kind: 'milestone_reached', payload: { rank: 'Corporal', days: 30, name: 'Casey' }, created_at: daysAgo(10).toISOString(), seen_at: daysAgo(9).toISOString() });
    t('messages').push({ id: uid(), link_id: link.id, from_id: SPONSOR, body: 'Rough morning but I held.', created_at: daysAgo(0, 9).toISOString(), read_at: null });
    return;
  }
  t('profiles').push({ id: ME, ...profileDefaults });
  const sob = { id: uid(), user_id: ME, name: 'Alcohol', start_at: daysAgo(40, 6).toISOString(), daily_cost_usd: 28, daily_hours: 2.5, is_primary: true, archived_at: null, created_at: daysAgo(40).toISOString() };
  const sob2 = { id: uid(), user_id: ME, name: 'Sports betting', start_at: daysAgo(12, 6).toISOString(), daily_cost_usd: 40, daily_hours: 1, is_primary: false, archived_at: null, created_at: daysAgo(12).toISOString() };
  t('sobrieties').push(sob, sob2);
  t('streak_history').push({ id: uid(), sobriety_id: sob.id, user_id: ME, started_at: daysAgo(70).toISOString(), ended_at: daysAgo(41).toISOString(), note: 'Vegas weekend' });
  for (let i = 1; i <= 14; i++) {
    if (i % 5 === 0) continue;
    t('check_ins').push({ id: uid(), user_id: ME, date: dkey(daysAgo(i)), pledged: true, mood: 2 + (i % 4), notes: i % 3 ? null : 'Slept badly, still pledged.', shared_with_sponsor: true, created_at: daysAgo(i, 7).toISOString() });
    if (i % 4 !== 0) t('reviews').push({ id: uid(), user_id: ME, date: dkey(daysAgo(i)), outcome: i === 6 ? 'struggled' : 'held', difficulties: i === 6 ? ['Stress', 'Boredom'] : [], difficult_notes: i === 6 ? 'Game went to overtime, wanted a beer badly.' : null, went_right: 'Gym after work.', shared_with_sponsor: true, created_at: daysAgo(i, 21).toISOString() });
  }
  t('urges').push({ id: uid(), user_id: ME, sobriety_id: sob.id, at: daysAgo(2, 19).toISOString(), intensity: 7, triggers: ['Stress', 'Sports'], coping: ['Walked', 'Called sponsor'], notes: 'Raiders game.' });
  t('urges').push({ id: uid(), user_id: ME, sobriety_id: sob.id, at: daysAgo(9, 22).toISOString(), intensity: 4, triggers: ['Boredom'], coping: ['Water'], notes: null });
  const w = { id: uid(), user_id: ME, at: daysAgo(1, 17).toISOString(), title: 'Push day', duration_min: 55, notes: 'Felt strong.', outlook_event_id: null, created_at: daysAgo(1).toISOString() };
  t('workouts').push(w);
  t('workout_sets').push({ id: uid(), workout_id: w.id, position: 0, exercise: 'Bench', sets: 4, reps: 8, weight: '185' }, { id: uid(), workout_id: w.id, position: 1, exercise: 'Incline DB', sets: 3, reps: 10, weight: '60' });
  t('backup_contacts').push({ id: uid(), user_id: ME, name: 'Remi', phone: '702-555-0123', relation: 'Friend' });
  t('affirmation_favorites').push({ user_id: ME, affirmation_index: 3 }, { user_id: ME, affirmation_index: 11 });
  const monday = (() => { const d = daysAgo(0); const dow = (d.getDay() + 6) % 7; d.setDate(d.getDate() - dow); return d; })();
  const mk = dkey(monday);
  const g1 = { id: uid(), user_id: ME, title: 'Skincare', cadence: 'daily', target: 7, remind: true, position: 0, created_week: mk, carried_over: false, paused_at: null, archived_at: null, created_at: daysAgo(20).toISOString() };
  const g2 = { id: uid(), user_id: ME, title: 'Whiten teeth', cadence: 'daily', target: 7, remind: false, position: 1, created_week: mk, carried_over: false, paused_at: null, archived_at: null, created_at: daysAgo(20).toISOString() };
  const g3 = { id: uid(), user_id: ME, title: 'Gym', cadence: 'weekly', target: 4, remind: false, position: 2, created_week: mk, carried_over: false, paused_at: null, archived_at: null, created_at: daysAgo(20).toISOString() };
  const g4 = { id: uid(), user_id: ME, title: 'Book dentist', cadence: 'once', target: 1, remind: false, position: 3, created_week: mk, carried_over: false, paused_at: null, archived_at: null, created_at: daysAgo(2).toISOString() };
  t('goals').push(g1, g2, g3, g4);
  for (let i = 1; i <= 9; i++) { t('goal_checks').push({ id: uid(), goal_id: g1.id, user_id: ME, date: dkey(daysAgo(i)) }); if (i % 3) t('goal_checks').push({ id: uid(), goal_id: g2.id, user_id: ME, date: dkey(daysAgo(i)) }); }
  [1, 3].forEach((i) => t('goal_checks').push({ id: uid(), goal_id: g3.id, user_id: ME, date: dkey(daysAgo(i)) }));
  t('workbook_entries').push({ id: uid(), user_id: ME, date: dkey(daysAgo(0)), drill_key: 'gratitude', answers: { a: 'Coffee on the patio' }, created_at: nowIso() });
  const link = { id: uid(), user_id: ME, sponsor_id: SPONSOR, sponsor_name: 'Pat', sponsor_phone: '702-555-0199', status: 'active', is_primary: true, invite_code: 'abc123',
    permissions: { streaks: true, checkins: true, urge_alerts: true, missed_checkin_alerts: true, witness: true, journal: false, risk_events: true }, invited_at: daysAgo(30).toISOString(), accepted_at: daysAgo(29).toISOString() };
  t('sponsor_links').push(link);
  t('messages').push({ id: uid(), link_id: link.id, from_id: SPONSOR, body: 'Proud of you. Call me after the game.', created_at: daysAgo(0, 10).toISOString(), read_at: null });
  t('milestones').push({ id: uid(), sobriety_id: sob.id, user_id: ME, rank: 'Corporal', days: 30, streak_started_at: sob.start_at, reached_at: daysAgo(10).toISOString(), witnessed_by: SPONSOR, witness_note: 'Thirty days. Hell yes.', witnessed_at: daysAgo(10).toISOString() });
}
// Persist across page loads within a tab so multi-screen flows can be tested; ?reset=1 wipes it.
const STORE_KEY = `qa_tables_${scenario}`;
function persist() { try { sessionStorage.setItem(STORE_KEY, JSON.stringify(tables)); } catch { /* ignore */ } }
(() => {
  try {
    const saved = params.get('reset') ? null : sessionStorage.getItem(STORE_KEY);
    if (saved) { Object.assign(tables, JSON.parse(saved)); seq = 1000; return; }
  } catch { /* ignore */ }
  seed();
  persist();
})();

// ------------------------------------------------------------------ query builder
type Filter = (r: Row) => boolean;
class Q implements PromiseLike<any> {
  private filters: Filter[] = [];
  private op: 'select' | 'insert' | 'upsert' | 'update' | 'delete' = 'select';
  private payload: any;
  private opts: any = {};
  private cols = '*';
  private orders: { k: string; asc: boolean }[] = [];
  private lim: number | null = null;
  private off = 0;
  private mode: 'many' | 'single' | 'maybe' = 'many';
  private returning = false;
  constructor(private table: string) {}
  select(cols = '*', opts: any = {}) { if (this.op !== 'select') this.returning = true; else { this.cols = cols; this.opts = opts; } return this; }
  insert(p: any) { this.op = 'insert'; this.payload = p; return this; }
  upsert(p: any, o: any = {}) { this.op = 'upsert'; this.payload = p; this.opts = o; return this; }
  update(p: any) { this.op = 'update'; this.payload = p; return this; }
  delete() { this.op = 'delete'; return this; }
  eq(k: string, v: any) { this.filters.push((r) => r[k] === v); return this; }
  neq(k: string, v: any) { this.filters.push((r) => r[k] !== v); return this; }
  is(k: string, v: any) { this.filters.push((r) => (v === null ? r[k] == null : r[k] === v)); return this; }
  in(k: string, v: any[]) { this.filters.push((r) => v.includes(r[k])); return this; }
  gte(k: string, v: any) { this.filters.push((r) => r[k] >= v); return this; }
  lte(k: string, v: any) { this.filters.push((r) => r[k] <= v); return this; }
  gt(k: string, v: any) { this.filters.push((r) => r[k] > v); return this; }
  lt(k: string, v: any) { this.filters.push((r) => r[k] < v); return this; }
  order(k: string, o: any = {}) { this.orders.push({ k, asc: o.ascending !== false }); return this; }
  limit(n: number) { this.lim = n; return this; }
  range(a: number, b: number) { this.off = a; this.lim = b - a + 1; return this; }
  single() { this.mode = 'single'; return this; }
  maybeSingle() { this.mode = 'maybe'; return this; }
  private match(r: Row) { return this.filters.every((f) => f(r)); }
  private project(r: Row) {
    const out = { ...r };
    const m = this.cols.match(/(\w+)\(\*\)/);
    if (m) {
      const child = m[1];
      const fk = `${this.table.replace(/s$/, '')}_id`;
      out[child] = t(child).filter((c) => c[fk] === r.id).map((c) => ({ ...c }));
    }
    return out;
  }
  private run(): { data: any; error: any; count: number | null } {
    const rows = t(this.table);
    const log = (...a: any[]) => (window as any).__qaLog?.push([this.table, this.op, ...a]);
    if (this.op === 'select') {
      let out = rows.filter((r) => this.match(r));
      for (const o of [...this.orders].reverse()) out.sort((a, b) => (a[o.k] < b[o.k] ? -1 : a[o.k] > b[o.k] ? 1 : 0) * (o.asc ? 1 : -1));
      const count = out.length;
      if (this.lim != null) out = out.slice(this.off, this.off + this.lim);
      if (this.opts.head) return { data: null, error: null, count };
      const data = out.map((r) => this.project(r));
      return this.finish(data, count);
    }
    if (this.op === 'insert' || this.op === 'upsert') {
      const list = (Array.isArray(this.payload) ? this.payload : [this.payload]).map((p: Row) => ({ id: uid(), created_at: nowIso(), ...p }));
      const fresh: Row[] = [];
      for (const p of list) {
        const keys = (this.opts.onConflict as string | undefined)?.split(',').map((s) => s.trim()) ?? naturalKeys(this.table);
        const hit = this.op === 'upsert' && keys.length ? rows.find((r) => keys.every((k) => r[k] === p[k])) : undefined;
        if (hit) { if (!this.opts.ignoreDuplicates) Object.assign(hit, p, { id: hit.id }); fresh.push(hit); }
        else { rows.push(p); fresh.push(p); }
      }
      log(fresh.length); persist();
      return this.finish(this.returning ? fresh : null, fresh.length);
    }
    if (this.op === 'update') {
      const hit = rows.filter((r) => this.match(r));
      hit.forEach((r) => Object.assign(r, this.payload));
      log(hit.length); persist();
      return this.finish(this.returning ? hit : null, hit.length);
    }
    const keep = rows.filter((r) => !this.match(r));
    const removed = rows.length - keep.length;
    tables[this.table] = keep;
    log(removed); persist();
    return { data: null, error: null, count: removed };
  }
  private finish(data: any, count: number) {
    if (this.mode === 'single') return data?.length === 1 ? { data: data[0], error: null, count } : { data: null, error: { message: `expected one row in ${this.table}, got ${data?.length ?? 0}` }, count };
    if (this.mode === 'maybe') return { data: data?.[0] ?? null, error: null, count };
    return { data, error: null, count };
  }
  then<R1 = any, R2 = never>(ok?: (v: any) => R1 | PromiseLike<R1>, bad?: (e: any) => R2 | PromiseLike<R2>) {
    return new Promise((res) => setTimeout(() => res(this.run()), 15)).then(ok, bad);
  }
}
function naturalKeys(table: string) {
  return ({ check_ins: ['user_id', 'date'], reviews: ['user_id', 'date'], workbook_entries: ['user_id', 'date', 'drill_key'], affirmation_favorites: ['user_id', 'affirmation_index'],
    push_subscriptions: ['endpoint'], risk_events: ['user_id', 'event_id'], profiles: ['id'], goal_checks: ['goal_id', 'date'] } as Record<string, string[]>)[table] ?? [];
}

// ------------------------------------------------------------------ rpc
const rpcs: Record<string, (a: any) => any> = {
  touch_last_seen: () => null,
  is_admin: () => scenario === 'user',
  outlook_status: () => ({ connected: false }),
  disconnect_outlook: () => null,
  fire_reach_out: () => ({ alerted: 1 }),
  invite_info: ({ code }) => (code === 'abc123' ? { sponsee: 'Casey', status: 'pending' } : null),
  accept_sponsor_invite: () => null,
  witness_milestone: () => null,
  admin_stats: () => ({ users: 14, onboarded: 11, sponsors: 3, active_links: 5, sponsors_with_many: 1, active_1d: 4, active_7d: 9, active_30d: 11, new_7d: 2, push_devices: 7,
    check_ins_7d: 31, reviews_7d: 22, urges_7d: 4, errors_7d: 1, events_7d: [{ name: 'app_open', n: 80 }, { name: 'pledge', n: 31 }, { name: 'field_brief', n: 12 }],
    signups_by_week: [{ week: '2026-09-07', n: 3 }, { week: '2026-09-14', n: 5 }, { week: '2026-09-21', n: 2 }, { week: '2026-09-28', n: 4 }], errors: [{ message: 'window: ResizeObserver loop', url: '/today', created_at: nowIso() }] }),
  sponsor_dashboard: () => {
    const links = t('sponsor_links').filter((l) => l.sponsor_id === ME && l.status === 'active');
    return links.map((l) => {
      const p = t('profiles').find((x) => x.id === l.user_id);
      return { link_id: l.id, user_id: l.user_id, name: p?.display_name ?? 'Sponsee', phone: p?.phone ?? null, permissions: l.permissions,
        sobrieties: [{ id: 's1', name: 'Alcohol', start_at: daysAgo(40, 6).toISOString(), is_primary: true }],
        check_ins: [1, 2, 3, 4, 6].map((i) => ({ date: dkey(daysAgo(i)), pledged: true, mood: 3, created_at: daysAgo(i, 7).toISOString(), notes: null })),
        reviews: [{ date: dkey(daysAgo(1)), outcome: 'held', difficulties: [], difficult_notes: null, went_right: 'Gym.' }],
        milestones: [{ id: 'm1', rank: 'Corporal', days: 30, reached_at: daysAgo(10).toISOString(), witnessed: false, sobriety_id: 's1' }],
        risk_events: [{ title: 'Happy hour w/ team', start_at: daysAgo(-1, 18).toISOString() }] };
    });
  },
};

// ------------------------------------------------------------------ auth + client
let session: any = scenario === 'signedout' ? null : { access_token: 'qa', user: { id: ME, email: 'caseyob24@gmail.com' } };
const listeners: ((e: string, s: any) => void)[] = [];
function setSession(s: any) { session = s; listeners.forEach((l) => l(s ? 'SIGNED_IN' : 'SIGNED_OUT', s)); }

export const configured = true;
export const supabase: any = {
  from: (table: string) => new Q(table),
  rpc: (name: string, args?: any) => {
    const fn = rpcs[name];
    const p = new Promise<any>((res) => setTimeout(() => res(fn ? { data: fn(args ?? {}), error: null } : { data: null, error: { message: `rpc ${name} not faked` } }), 15));
    return Object.assign(p, { then: p.then.bind(p) });
  },
  auth: {
    getSession: async () => ({ data: { session } }),
    onAuthStateChange: (cb: any) => { listeners.push(cb); return { data: { subscription: { unsubscribe: () => { const i = listeners.indexOf(cb); if (i >= 0) listeners.splice(i, 1); } } } }; },
    signOut: async () => { setSession(null); return { error: null }; },
    verifyOtp: async () => { setSession({ access_token: 'qa', user: { id: ME, email: 'caseyob24@gmail.com' } }); return { error: null }; },
    updateUser: async () => ({ error: null }),
    signInWithOtp: async () => ({ error: null }),
    signInWithPassword: async () => ({ error: null }),
  },
  channel: () => { const ch: any = { on: () => ch, subscribe: () => ch }; return ch; },
  removeChannel: () => undefined,
};

export function must<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data as T;
}

(window as any).__qa = { tables, scenario };
(window as any).__qaLog = [];
