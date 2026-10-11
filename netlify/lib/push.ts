import webpush from 'web-push';
import { db } from './util';

let ready = false;
function setup() {
  if (ready) return true;
  const pub = process.env.VAPID_PUBLIC_KEY || process.env.VITE_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) return false;
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:admin@example.com', pub, priv);
  ready = true;
  return true;
}

export interface PushMessage {
  title: string;
  body: string;
  url?: string;
}

/** Sends to every device the user has subscribed; prunes dead subscriptions. Returns devices reached. */
export async function pushToUser(userId: string, msg: PushMessage): Promise<number> {
  if (!setup()) return 0;
  const { data: subs } = await db().from('push_subscriptions').select('*').eq('user_id', userId);
  let sent = 0;
  for (const s of subs ?? []) {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(msg), { TTL: 3600 });
      sent++;
    } catch (e) {
      const code = (e as { statusCode?: number }).statusCode;
      if (code === 404 || code === 410) await db().from('push_subscriptions').delete().eq('id', s.id);
      else console.error('push failed', code, (e as Error).message);
    }
  }
  return sent;
}

interface AlertRow {
  id: string;
  link_id: string;
  kind: string;
  payload: Record<string, unknown>;
  sponsor_links: { sponsor_id: string | null; user_id: string; profiles: { display_name: string } | null } | null;
}

function alertMessage(a: AlertRow): PushMessage {
  const name = a.sponsor_links?.profiles?.display_name || 'Your sponsee';
  const p = a.payload;
  switch (a.kind) {
    case 'reach_out': return { title: `${name} needs backup`, body: 'They tapped Reach Out. Call them now.', url: '/' };
    case 'urge': {
      const coping = (p.coping as string[]) ?? [];
      return {
        title: `${name} logged an urge (${p.intensity}/10)`,
        body: coping.includes('Still in it') ? "They're still in it. A call would help." : coping.length ? `Held by: ${coping.join(', ')}` : 'Check in with them.',
        url: '/',
      };
    }
    case 'missed_checkin': return { title: `${name} hasn't checked in today`, body: 'Might be worth a quick text.', url: '/' };
    case 'milestone_upcoming': return { title: `${name} hits ${p.rank} in 3 days`, body: `${p.days} days on ${p.sobriety}. You can witness it.`, url: '/' };
    case 'milestone_reached': return { title: `${name} reached ${p.rank}`, body: `${p.days} days on ${p.sobriety}. Sign off on it in the app.`, url: '/' };
    default: return { title: 'Hold the Line', body: 'New alert', url: '/' };
  }
}

/** Pushes unsent alerts to their sponsors and stamps pushed_at. Optionally limited to some links. */
export async function flushAlerts(linkIds?: string[]): Promise<number> {
  let q = db().from('alerts')
    .select('id, link_id, kind, payload, sponsor_links!inner(sponsor_id, user_id, status, profiles!sponsor_links_user_id_fkey(display_name))')
    .is('pushed_at', null)
    .eq('sponsor_links.status', 'active')
    .gt('created_at', new Date(Date.now() - 86_400_000).toISOString())
    .limit(200);
  if (linkIds?.length) q = q.in('link_id', linkIds);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  let n = 0;
  for (const a of (data ?? []) as unknown as AlertRow[]) {
    const sponsor = a.sponsor_links?.sponsor_id;
    if (sponsor) n += await pushToUser(sponsor, alertMessage(a));
    await db().from('alerts').update({ pushed_at: new Date().toISOString() }).eq('id', a.id);
  }
  return n;
}
