import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/** False until the Supabase env vars are set in Netlify (or .env.local). */
export const configured = Boolean(url && anon);

export const supabase: SupabaseClient = configured
  ? createClient(url!, anon!, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } })
  : (null as unknown as SupabaseClient);

/** Throws the Supabase error so screens can show it; returns data otherwise. */
export function must<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data as T;
}
