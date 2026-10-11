import { decrypt, encrypt } from './crypto';
import { db, env, HttpError } from './util';

export const SCOPES = 'offline_access User.Read Calendars.ReadWrite';
const tenant = () => process.env.MS_TENANT || 'common';
export const authorizeUrl = () => `https://login.microsoftonline.com/${tenant()}/oauth2/v2.0/authorize`;
const tokenUrl = () => `https://login.microsoftonline.com/${tenant()}/oauth2/v2.0/token`;

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  error?: string;
  error_description?: string;
}

export async function exchangeCode(code: string, redirectUri: string): Promise<TokenResponse> {
  const res = await fetch(tokenUrl(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: env('MS_CLIENT_ID'),
      client_secret: env('MS_CLIENT_SECRET'),
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      scope: SCOPES,
    }),
  });
  const body = (await res.json()) as TokenResponse;
  if (!res.ok) throw new HttpError(400, body.error_description || body.error || 'Microsoft sign-in failed');
  return body;
}

export async function saveTokens(userId: string, t: TokenResponse, email: string | null) {
  const { error } = await db().from('oauth_tokens').upsert({
    user_id: userId,
    provider: 'microsoft',
    refresh_token_enc: encrypt(t.refresh_token ?? ''),
    access_token_enc: encrypt(t.access_token),
    expires_at: new Date(Date.now() + (t.expires_in - 120) * 1000).toISOString(),
    account_email: email,
    updated_at: new Date().toISOString(),
  });
  if (error) throw new Error(error.message);
}

/** Returns a valid Graph access token for the user, refreshing it when needed. */
export async function accessToken(userId: string): Promise<string> {
  const { data } = await db().from('oauth_tokens').select('*').eq('user_id', userId).eq('provider', 'microsoft').maybeSingle();
  if (!data) throw new HttpError(409, 'Outlook is not connected.');
  if (data.access_token_enc && data.expires_at && Date.parse(data.expires_at) > Date.now()) return decrypt(data.access_token_enc);

  const res = await fetch(tokenUrl(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: env('MS_CLIENT_ID'),
      client_secret: env('MS_CLIENT_SECRET'),
      grant_type: 'refresh_token',
      refresh_token: decrypt(data.refresh_token_enc),
      scope: SCOPES,
    }),
  });
  const body = (await res.json()) as TokenResponse;
  if (!res.ok) {
    // Revoked or expired consent: drop the tokens so the app shows "Connect" again.
    await db().from('oauth_tokens').delete().eq('user_id', userId).eq('provider', 'microsoft');
    throw new HttpError(409, 'Outlook access expired. Connect Outlook again in Settings.');
  }
  await saveTokens(userId, { ...body, refresh_token: body.refresh_token ?? decrypt(data.refresh_token_enc) }, data.account_email);
  return body.access_token;
}

export async function graph<T>(userId: string, path: string, init: RequestInit = {}): Promise<T> {
  const token = await accessToken(userId);
  const res = await fetch(`https://graph.microsoft.com/v1.0${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(init.headers ?? {}) },
  });
  const text = await res.text();
  const body = text ? JSON.parse(text) : {};
  if (!res.ok) throw new HttpError(res.status === 401 ? 409 : 502, body?.error?.message ?? `Outlook request failed (${res.status})`);
  return body as T;
}
