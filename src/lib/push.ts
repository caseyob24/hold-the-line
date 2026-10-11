import { supabase } from './supabase';

const VAPID = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;

export function pushSupported() {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window && Boolean(VAPID);
}

function urlB64ToUint8(base64: string) {
  const pad = '='.repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

export async function registerSW() {
  if (!('serviceWorker' in navigator)) return null;
  try {
    return await navigator.serviceWorker.register('/sw.js', { scope: '/' });
  } catch {
    return null;
  }
}

/** Asks permission (must follow a tap) and stores the subscription for this user. */
export async function enablePush(userId: string): Promise<'on' | 'denied' | 'unsupported'> {
  if (!pushSupported()) return 'unsupported';
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') return 'denied';
  const reg = (await navigator.serviceWorker.getRegistration()) ?? (await registerSW());
  if (!reg) return 'unsupported';
  const sub = (await reg.pushManager.getSubscription())
    ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlB64ToUint8(VAPID!) }));
  const json = sub.toJSON();
  await supabase.from('push_subscriptions').upsert(
    { user_id: userId, endpoint: sub.endpoint, p256dh: json.keys?.p256dh ?? '', auth: json.keys?.auth ?? '' },
    { onConflict: 'endpoint' },
  );
  return 'on';
}

export async function pushState(): Promise<'on' | 'off' | 'unsupported'> {
  if (!pushSupported()) return 'unsupported';
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = await reg?.pushManager.getSubscription();
  return sub && Notification.permission === 'granted' ? 'on' : 'off';
}
