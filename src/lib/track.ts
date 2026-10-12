import { supabase } from './supabase';

let userId: string | null = null;
let lastError = '';

/** Fire-and-forget usage event. Never throws, never blocks the UI. */
export function track(name: string, props: Record<string, unknown> = {}) {
  if (!userId) return;
  void supabase.from('app_events').insert({ user_id: userId, name, props }).then(() => undefined, () => undefined);
}

/** Records an error so it shows up on the owner dashboard. */
export function logError(err: unknown, where = '') {
  if (!userId) return;
  const e = err instanceof Error ? err : new Error(String(err));
  const message = `${where ? `${where}: ` : ''}${e.message}`.slice(0, 500);
  if (message === lastError) return; // don't flood on loops
  lastError = message;
  void supabase.from('client_errors').insert({
    user_id: userId, message, stack: e.stack?.slice(0, 2000) ?? null,
    url: location.pathname, user_agent: navigator.userAgent.slice(0, 200),
  }).then(() => undefined, () => undefined);
}

/** Called when a session is known: marks the user active and logs the app open once per launch. */
export function startTracking(id: string | null) {
  const first = id && id !== userId;
  userId = id;
  if (!first) return;
  void supabase.rpc('touch_last_seen').then(() => undefined, () => undefined);
  const standalone = window.matchMedia?.('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone;
  track('app_open', { standalone: Boolean(standalone) });
}

window.addEventListener('error', (e) => logError(e.error ?? e.message, 'window'));
window.addEventListener('unhandledrejection', (e) => logError(e.reason, 'promise'));
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && userId) void supabase.rpc('touch_last_seen').then(() => undefined, () => undefined);
});
