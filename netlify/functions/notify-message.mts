import type { Config } from '@netlify/functions';
import { pushToUser } from '../lib/push';
import { db, handle, HttpError, json, requireUser } from '../lib/util';

// Pushes a new sponsor-thread note to the other person on the link.
export default handle(async (req) => {
  const userId = await requireUser(req);
  const { message_id } = (await req.json()) as { message_id?: string };
  if (!message_id) throw new HttpError(400, 'message_id is required');

  const { data: m } = await db().from('messages')
    .select('id, body, from_id, sponsor_links!inner(user_id, sponsor_id, status)')
    .eq('id', message_id).single();
  const link = m?.sponsor_links as unknown as { user_id: string; sponsor_id: string | null; status: string } | undefined;
  if (!m || !link || m.from_id !== userId || link.status !== 'active') throw new HttpError(404, 'Message not found');

  const to = link.user_id === userId ? link.sponsor_id : link.user_id;
  if (!to) return json({ sent: 0 });
  const { data: me } = await db().from('profiles').select('display_name').eq('id', userId).single();
  const body = String(m.body);
  const sent = await pushToUser(to, {
    title: `Note from ${me?.display_name || 'your sponsor'}`,
    body: body.length > 140 ? `${body.slice(0, 137)}…` : body,
    url: link.user_id === userId ? '/' : '/sponsor',
  });
  return json({ sent });
});

export const config: Config = { path: '/api/notify-message', method: 'POST' };
