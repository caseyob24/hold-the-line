import type { Config } from '@netlify/functions';
import { flushAlerts } from '../lib/push';
import { db, handle, json, requireUser } from '../lib/util';

// Called right after a user logs an urge or taps Reach Out, so their sponsor hears now
// instead of at the next scheduled run.
export default handle(async (req) => {
  const userId = await requireUser(req);
  const { data } = await db().from('sponsor_links').select('id').eq('user_id', userId).eq('status', 'active');
  const ids = (data ?? []).map((l) => l.id as string);
  const sent = ids.length ? await flushAlerts(ids) : 0;
  return json({ sent });
});

export const config: Config = { path: '/api/push-flush', method: 'POST' };
