import type { Config } from '@netlify/functions';
import { verifyState } from '../lib/crypto';
import { exchangeCode, saveTokens } from '../lib/ms';
import { db, siteUrl } from '../lib/util';

// Microsoft redirects here after sign-in. Exchanges the code, stores encrypted tokens, sends the user back.
export default async (req: Request) => {
  const u = new URL(req.url);
  const site = siteUrl(req);
  const back = (status: 'connected' | 'error', reason?: string) => {
    const to = new URL('/settings', site);
    to.searchParams.set('outlook', status);
    if (reason) to.searchParams.set('reason', reason.slice(0, 200));
    return Response.redirect(to.toString(), 302);
  };

  if (u.searchParams.get('error')) return back('error', u.searchParams.get('error_description') ?? 'Sign-in was cancelled');
  const userId = verifyState(u.searchParams.get('state') ?? '');
  const code = u.searchParams.get('code');
  if (!userId || !code) return back('error', 'Sign-in link expired, try again');

  try {
    const tokens = await exchangeCode(code, `${site}/api/ms-auth-callback`);
    const me = await fetch('https://graph.microsoft.com/v1.0/me?$select=mail,userPrincipalName', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    }).then((r) => r.json() as Promise<{ mail?: string; userPrincipalName?: string }>).catch(() => ({} as { mail?: string; userPrincipalName?: string }));
    await saveTokens(userId, tokens, me.mail ?? me.userPrincipalName ?? null);
    // Onboarding sends people here mid-setup; finishing it is handled on the client.
    const { data } = await db().from('profiles').select('onboarded').eq('id', userId).single();
    if (data && !data.onboarded) return Response.redirect(`${site}/?outlook=connected`, 302);
    return back('connected');
  } catch (e) {
    return back('error', (e as Error).message);
  }
};

export const config: Config = { path: '/api/ms-auth-callback' };
