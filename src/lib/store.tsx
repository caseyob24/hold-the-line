import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { configured, must, supabase } from './supabase';
import type { Profile, Sobriety, SponsorLink } from './types';
import { RANKS } from './ranks';
import { daysSince } from './time';
import { startTracking } from './track';

interface AppState {
  ready: boolean;
  session: Session | null;
  profile: Profile | null;
  sobrieties: Sobriety[];
  links: SponsorLink[]; // links where I am the user (my sponsors)
  sponsoring: number; // active links where I am the sponsor
  refresh: () => Promise<void>;
  updateProfile: (patch: Partial<Profile>) => Promise<void>;
  toast: (msg: string) => void;
  celebrate: () => void;
}

const Ctx = createContext<AppState | null>(null);

export function useApp() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useApp outside provider');
  return v;
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(!configured);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [sobrieties, setSobrieties] = useState<Sobriety[]>([]);
  const [links, setLinks] = useState<SponsorLink[]>([]);
  const [sponsoring, setSponsoring] = useState(0);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [party, setParty] = useState(0);
  const toastTimer = useRef<number>();

  const toast = useCallback((msg: string) => {
    setToastMsg(msg);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToastMsg(null), 2800);
  }, []);
  const celebrate = useCallback(() => setParty((n) => n + 1), []);

  const load = useCallback(async (uid: string) => {
    const [p, s, l, sp] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', uid).single(),
      supabase.from('sobrieties').select('*').eq('user_id', uid).is('archived_at', null).order('is_primary', { ascending: false }).order('start_at'),
      supabase.from('sponsor_links').select('*').eq('user_id', uid).neq('status', 'revoked').order('invited_at'),
      supabase.from('sponsor_links').select('id', { count: 'exact', head: true }).eq('sponsor_id', uid).eq('status', 'active'),
    ]);
    const prof = must(p) as Profile;
    const sobs = (must(s) ?? []) as Sobriety[];
    setProfile(prof);
    setSobrieties(sobs);
    setLinks((must(l) ?? []) as SponsorLink[]);
    setSponsoring(sp.count ?? 0);
    // Record any ranks reached since the last visit; newly inserted rows trigger a celebration.
    const rows = sobs.flatMap((sob) =>
      RANKS.filter((r) => daysSince(sob.start_at) >= r.days).map((r) => ({
        sobriety_id: sob.id,
        user_id: uid,
        rank: r.name,
        days: r.days,
        streak_started_at: sob.start_at,
        reached_at: new Date(Date.parse(sob.start_at) + r.days * 86_400_000).toISOString(),
      })),
    );
    if (rows.length) {
      const { data: fresh } = await supabase
        .from('milestones')
        .upsert(rows, { onConflict: 'sobriety_id,rank,streak_started_at', ignoreDuplicates: true })
        .select('id, reached_at');
      // Only celebrate ranks reached in the last 2 days, not a backfill at onboarding.
      if (fresh?.some((m) => Date.now() - Date.parse(m.reached_at) < 2 * 86_400_000) && prof.notify_milestones) {
        setParty((n) => n + 1);
      }
    }
  }, []);

  useEffect(() => {
    if (!configured) return;
    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session);
      startTracking(data.session?.user.id ?? null);
      if (data.session) await load(data.session.user.id).catch(() => undefined);
      setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      startTracking(s?.user.id ?? null);
      if (s) load(s.user.id).catch(() => undefined);
      else {
        setProfile(null);
        setSobrieties([]);
        setLinks([]);
      }
    });
    return () => sub.subscription.unsubscribe();
  }, [load]);

  const refresh = useCallback(async () => {
    if (session) await load(session.user.id);
  }, [session, load]);

  const updateProfile = useCallback(async (patch: Partial<Profile>) => {
    if (!session) return;
    const { data, error } = await supabase.from('profiles').update(patch).eq('id', session.user.id).select().single();
    if (error) throw new Error(error.message);
    setProfile(data as Profile);
  }, [session]);

  const value = useMemo<AppState>(
    () => ({ ready, session, profile, sobrieties, links, sponsoring, refresh, updateProfile, toast, celebrate }),
    [ready, session, profile, sobrieties, links, sponsoring, refresh, updateProfile, toast, celebrate],
  );

  return (
    <Ctx.Provider value={value}>
      {children}
      {toastMsg && <div className="toast" role="status">{toastMsg}</div>}
      {party > 0 && <Confetti key={party} />}
    </Ctx.Provider>
  );
}

function Confetti() {
  const colors = ['#D4AE52', '#B8C27A', '#8FB3D9', '#E08A4F', '#EDE9DC'];
  const bits = Array.from({ length: 60 }, (_, i) => ({
    left: `${(i * 37) % 100}%`,
    delay: `${(i % 12) * 0.08}s`,
    color: colors[i % colors.length],
  }));
  return (
    <div className="confetti" aria-hidden="true">
      {bits.map((b, i) => (
        <i key={i} style={{ left: b.left, animationDelay: b.delay, background: b.color }} />
      ))}
    </div>
  );
}

/** Small async-data helper: runs `fn` on mount and when deps change. */
export function useLoad<T>(fn: () => Promise<T>, deps: unknown[]) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const run = useCallback(async () => {
    setLoading(true);
    try {
      setData(await fn());
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  useEffect(() => { run(); }, [run]);
  return { data, error, loading, reload: run, setData };
}
