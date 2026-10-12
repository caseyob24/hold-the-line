import type { Config } from '@netlify/functions';
import { db, handle, HttpError, json } from '../lib/util';

// Email-only sign-in (no password, no email sent). The server finds or creates the account,
// then hands back a one-time token the app trades for a normal session. Owner's choice for now:
// anyone who knows an email can open that account.
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function findUser(email: string) {
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await db().auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw new HttpError(500, error.message);
    const hit = data.users.find((u) => u.email?.toLowerCase() === email);
    if (hit) return hit;
    if (data.users.length < 1000) return null;
  }
  return null;
}

export default handle(async (req) => {
  const body = (await req.json().catch(() => ({}))) as { email?: string; create?: boolean };
  const email = (body.email ?? '').trim().toLowerCase();
  if (!EMAIL.test(email)) throw new HttpError(400, 'Enter a valid email.');

  const existing = await findUser(email);
  if (!existing && !body.create) throw new HttpError(404, 'No account with that email yet. Tap “Create account”.');
  if (existing && body.create) {
    // Already enlisted: just sign them in.
  } else if (!existing) {
    const { error } = await db().auth.admin.createUser({ email, email_confirm: true });
    if (error) throw new HttpError(500, error.message);
  }

  const { data, error } = await db().auth.admin.generateLink({ type: 'magiclink', email });
  if (error || !data.properties?.hashed_token) throw new HttpError(500, error?.message ?? 'Could not sign in.');
  return json({ token_hash: data.properties.hashed_token, created: !existing });
});

export const config: Config = { path: '/api/email-login', method: 'POST' };
