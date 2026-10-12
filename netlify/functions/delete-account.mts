import type { Config } from '@netlify/functions';
import { db, handle, HttpError, json, requireUser } from '../lib/util';

// Permanently deletes the signed-in user's account. Every table cascades from auth.users,
// so this removes their streaks, journals, links and push devices in one step.
export default handle(async (req) => {
  const userId = await requireUser(req);
  const body = (await req.json().catch(() => ({}))) as { confirm?: string };
  if (body.confirm !== 'DELETE') throw new HttpError(400, 'Type DELETE to confirm.');
  const { error } = await db().auth.admin.deleteUser(userId);
  if (error) throw new HttpError(500, error.message);
  return json({ deleted: true });
});

export const config: Config = { path: '/api/delete-account', method: 'POST' };
