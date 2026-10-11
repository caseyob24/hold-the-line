import type { Config } from '@netlify/functions';
import { signState } from '../lib/crypto';
import { authorizeUrl, SCOPES } from '../lib/ms';
import { env, handle, json, requireUser, siteUrl } from '../lib/util';

// Returns the Microsoft sign-in URL; the signed state ties the callback back to this user.
export default handle(async (req) => {
  const userId = await requireUser(req);
  const url = new URL(authorizeUrl());
  url.searchParams.set('client_id', env('MS_CLIENT_ID'));
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('redirect_uri', `${siteUrl(req)}/api/ms-auth-callback`);
  url.searchParams.set('response_mode', 'query');
  url.searchParams.set('scope', SCOPES);
  url.searchParams.set('prompt', 'select_account');
  url.searchParams.set('state', signState(userId));
  return json({ url: url.toString() });
});

export const config: Config = { path: '/api/ms-auth-start', method: 'POST' };
