import type { Config } from '@netlify/functions';
import { quoteFor } from '../../src/lib/quotes';
import { flushAlerts, pushToUser } from '../lib/push';
import { db, localNow, toMinutes } from '../lib/util';

// Runs every 15 minutes. Each job fires when a user's local time falls inside the current
// 15-minute window, so everything lands at the user's own clock time.
const WINDOW = 15;
const RANKS = [
  { name: 'Recruit', days: 1 }, { name: 'Private', days: 7 }, { name: 'PFC', days: 14 }, { name: 'Corporal', days: 30 },
  { name: 'Sergeant', days: 60 }, { name: 'Lieutenant', days: 90 }, { name: 'Captain', days: 180 },
  { name: 'Colonel', days: 365 }, { name: 'General', days: 730 },
];
const MISSED_CHECKIN_AT = 11 * 60; // 11:00 local
const UPCOMING_AT = 9 * 60; // 09:00 local

const inWindow = (now: number, target: number) => now >= target && now < target + WINDOW;

interface Profile {
  id: string;
  display_name: string;
  role: string;
  timezone: string;
  onboarded: boolean;
  quote_time: string;
  quote_authors: string[];
  quote_last_sent: string | null;
  checkin_reminder_time: string;
  notify_checkin: boolean;
  notify_review: boolean;
  review_time: string;
}

export default async () => {
  const started = Date.now();
  // Only profiles with something due in this 15-minute window of their own local time.
  let { data: profiles, error } = await db().rpc('due_profiles', { window_minutes: WINDOW });
  if (error) {
    // Migration 0003 not applied yet: fall back to scanning every onboarded profile.
    ({ data: profiles, error } = await db().from('profiles').select('*').eq('onboarded', true));
  }
  if (error) {
    console.error(error.message);
    return;
  }

  for (const p of (profiles ?? []) as Profile[]) {
    try {
      const { date, minutes } = localNow(p.timezone);

      const isUser = p.role === 'user';
      const pledgedToday = async () => {
        const { data } = await db().from('check_ins').select('pledged').eq('user_id', p.id).eq('date', date).maybeSingle();
        return Boolean(data?.pledged);
      };
      const checkedIn = async () => {
        const { count } = await db().from('check_ins').select('id', { count: 'exact', head: true }).eq('user_id', p.id).eq('date', date);
        return (count ?? 0) > 0;
      };

      // 1. Morning pledge, carrying the day's war quote (users with the pledge reminder on).
      if (isUser && p.notify_checkin && inWindow(minutes, toMinutes(p.checkin_reminder_time)) && p.quote_last_sent !== date) {
        await db().from('profiles').update({ quote_last_sent: date }).eq('id', p.id);
        if (!(await pledgedToday())) {
          const q = quoteFor(date, p.quote_authors);
          const { data: sob } = await db().from('sobrieties').select('start_at').eq('user_id', p.id).is('archived_at', null)
            .order('is_primary', { ascending: false }).limit(1).maybeSingle();
          const day = sob ? Math.floor((Date.now() - Date.parse(sob.start_at)) / 86_400_000) : null;
          await pushToUser(p.id, {
            title: `${day !== null ? `Day ${day} · ` : ''}Make today's pledge`,
            body: `“${q.text}” — ${q.speaker}. Tap to pledge.`,
            url: '/today',
          });
        }
      }

      // 2. Quote-only push (sponsors, or users who turned the pledge reminder off).
      if ((!isUser || !p.notify_checkin) && inWindow(minutes, toMinutes(p.quote_time)) && p.quote_last_sent !== date) {
        const q = quoteFor(date, p.quote_authors);
        await pushToUser(p.id, { title: 'Order of the day', body: `“${q.text}” — ${q.speaker}`, url: '/motivation' });
        await db().from('profiles').update({ quote_last_sent: date }).eq('id', p.id);
      }
      if (!isUser) continue;

      // 3. Missed check-in -> sponsor alert
      if (inWindow(minutes, MISSED_CHECKIN_AT) && !(await checkedIn())) {
        const { data: links } = await db().from('sponsor_links').select('id, permissions').eq('user_id', p.id).eq('status', 'active');
        const rows = (links ?? [])
          .filter((l) => (l.permissions as Record<string, boolean>).missed_checkin_alerts)
          .map((l) => ({ link_id: l.id, kind: 'missed_checkin', payload: { date }, dedupe_key: `missed:${l.id}:${date}` }));
        if (rows.length) await db().from('alerts').upsert(rows, { onConflict: 'dedupe_key', ignoreDuplicates: true });
      }

      // 4. Rank coming up in 3 days -> sponsor alert
      if (inWindow(minutes, UPCOMING_AT)) {
        const { data: sobs } = await db().from('sobrieties').select('id, name, start_at').eq('user_id', p.id).is('archived_at', null);
        const { data: links } = await db().from('sponsor_links').select('id, permissions').eq('user_id', p.id).eq('status', 'active');
        const able = (links ?? []).filter((l) => (l.permissions as Record<string, boolean>).streaks);
        for (const s of sobs ?? []) {
          const days = Math.floor((Date.now() - Date.parse(s.start_at)) / 86_400_000);
          const r = RANKS.find((k) => k.days - days === 3);
          if (!r) continue;
          const when = new Date(Date.parse(s.start_at) + r.days * 86_400_000).toISOString();
          const rows = able.map((l) => ({
            link_id: l.id, kind: 'milestone_upcoming',
            payload: { rank: r.name, days: r.days, sobriety: s.name, date: when },
            dedupe_key: `upcoming:${l.id}:${s.id}:${r.name}:${s.start_at}`,
          }));
          if (rows.length) await db().from('alerts').upsert(rows, { onConflict: 'dedupe_key', ignoreDuplicates: true });
        }
      }

      // 5. Evening debrief
      if (p.notify_review && inWindow(minutes, toMinutes(p.review_time))) {
        const { count: reviewed } = await db().from('reviews').select('id', { count: 'exact', head: true }).eq('user_id', p.id).eq('date', date);
        if (!reviewed) {
          const { count: drills } = await db().from('workbook_entries').select('id', { count: 'exact', head: true }).eq('user_id', p.id).eq('date', date);
          const d = Math.min(drills ?? 0, 3);
          await pushToUser(p.id, {
            title: 'Debrief · How did today go?',
            body: `Two minutes: what was hard, what held.${d < 3 ? ` ${d} of 3 workbook drills done.` : ' Workbook done — nice work.'}`,
            url: '/review',
          });
        }
      }
    } catch (e) {
      console.error(`cron failed for ${p.id}`, (e as Error).message);
    }
  }

  // 6. Push anything still waiting (alerts written by triggers, RPCs and the jobs above).
  const sent = await flushAlerts().catch((e) => { console.error(e); return 0; });
  console.log(`cron: ${profiles?.length ?? 0} profiles, ${sent} alert pushes, ${Date.now() - started} ms`);
};

export const config: Config = { schedule: '*/15 * * * *' };
