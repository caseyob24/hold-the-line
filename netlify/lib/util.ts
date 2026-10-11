import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export function env(name: string): string {
  const v = process.env[name];
  if (!v) throw new HttpError(500, `Server is missing ${name}. Add it in Netlify environment variables.`);
  return v;
}

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export function json(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...headers } });
}

/** Wraps a handler so thrown HttpErrors become JSON responses. */
export function handle(fn: (req: Request) => Promise<Response>) {
  return async (req: Request) => {
    try {
      return await fn(req);
    } catch (e) {
      const status = e instanceof HttpError ? e.status : 500;
      if (status === 500) console.error(e);
      return json({ error: (e as Error).message }, status);
    }
  };
}

let admin: SupabaseClient | null = null;
/** Service-role client: bypasses RLS, server only. */
export function db(): SupabaseClient {
  if (!admin) {
    admin = createClient(process.env.SUPABASE_URL || env('VITE_SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return admin;
}

/** Verifies the Supabase access token on the request and returns the user id. */
export async function requireUser(req: Request): Promise<string> {
  const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) throw new HttpError(401, 'Sign in first.');
  const { data, error } = await db().auth.getUser(token);
  if (error || !data.user) throw new HttpError(401, 'Your session expired. Sign in again.');
  return data.user.id;
}

export function siteUrl(req: Request): string {
  return process.env.URL && process.env.CONTEXT === 'production' ? process.env.URL : new URL(req.url).origin;
}

/** Local wall-clock parts for an IANA zone. */
export function localNow(tz: string, now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '00';
  return { date: `${get('year')}-${get('month')}-${get('day')}`, minutes: Number(get('hour')) * 60 + Number(get('minute')) };
}

/** "HH:MM[:SS]" to minutes after midnight. */
export const toMinutes = (t: string) => {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
};
