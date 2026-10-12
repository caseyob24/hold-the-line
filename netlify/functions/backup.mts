import type { Config } from '@netlify/functions';
import { getStore } from '@netlify/blobs';
import { db } from '../lib/util';

// Nightly snapshot of every app table into Netlify Blobs (private to this site).
// Keeps the last 30 nights. OAuth tokens and push endpoints are left out: they are
// device/session secrets that can simply be re-created.
const TABLES = [
  'profiles', 'sobrieties', 'streak_history', 'check_ins', 'urges', 'workouts', 'workout_sets', 'milestones',
  'backup_contacts', 'risk_events', 'sponsor_links', 'messages', 'alerts', 'reviews', 'workbook_entries',
  'affirmation_favorites', 'admins', 'app_events', 'client_errors',
];
const KEEP = 30;
const PAGE = 1000;

export default async () => {
  const snapshot: Record<string, unknown[]> = {};
  const errors: string[] = [];
  for (const table of TABLES) {
    const rows: unknown[] = [];
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await db().from(table).select('*').range(from, from + PAGE - 1);
      if (error) { errors.push(`${table}: ${error.message}`); break; }
      rows.push(...(data ?? []));
      if (!data || data.length < PAGE) break;
    }
    snapshot[table] = rows;
  }

  const store = getStore('backups');
  const key = `${new Date().toISOString().slice(0, 10)}.json`;
  await store.setJSON(key, { taken_at: new Date().toISOString(), errors, tables: snapshot });

  const { blobs } = await store.list();
  const old = blobs.map((b) => b.key).sort().slice(0, -KEEP);
  for (const k of old) await store.delete(k);

  const counts = Object.fromEntries(Object.entries(snapshot).map(([t, r]) => [t, r.length]));
  console.log('backup', key, counts, errors.length ? errors : 'ok');
};

// 10:30 UTC ≈ 3:30 am in Las Vegas.
export const config: Config = { schedule: '30 10 * * *' };
