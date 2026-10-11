import { api } from './api';
import type { CalendarEvent, Profile } from './types';
import { supabase } from './supabase';

export async function outlookStatus(): Promise<{ connected: boolean; email: string | null }> {
  const { data } = await supabase.rpc('outlook_status');
  return (data as { connected: boolean; email: string | null }) ?? { connected: false, email: null };
}

export async function connectOutlook() {
  const { url } = await api<{ url: string }>('ms-auth-start', { method: 'POST' });
  window.location.href = url;
}

export async function disconnectOutlook() {
  await supabase.rpc('disconnect_outlook');
}

export async function getEvents(start: Date, end: Date): Promise<CalendarEvent[]> {
  const q = new URLSearchParams({ start: start.toISOString(), end: end.toISOString() });
  const { events } = await api<{ events: CalendarEvent[] }>(`calendar?${q}`);
  return events;
}

export interface NewEvent {
  subject: string;
  start: Date;
  end: Date;
  kind: 'checkin' | 'workout' | 'sponsor_call' | 'game' | 'custom';
  body?: string;
  location?: string;
  recurrence?: 'daily' | 'weekly';
}

export async function createEvent(e: NewEvent): Promise<{ id: string }> {
  return api<{ id: string }>('calendar', {
    method: 'POST',
    body: JSON.stringify({ ...e, start: e.start.toISOString(), end: e.end.toISOString() }),
  });
}

/** An event is high-risk when its title/location matches a keyword or it starts after the cutoff. */
export function isHighRisk(ev: CalendarEvent, p: Pick<Profile, 'risk_flagging' | 'risk_keywords' | 'risk_after'>): boolean {
  if (!p.risk_flagging || ev.fromApp || ev.isAllDay) return false;
  const hay = `${ev.subject} ${ev.location ?? ''}`.toLowerCase();
  if (p.risk_keywords.some((k) => k && hay.includes(k.toLowerCase()))) return true;
  const [h, m] = p.risk_after.split(':').map(Number);
  const d = new Date(ev.start);
  return d.getHours() * 60 + d.getMinutes() >= h * 60 + m;
}

/** Mirror upcoming high-risk events (title + time only) so a permitted sponsor can see them. */
export async function syncRiskEvents(userId: string, events: CalendarEvent[]) {
  if (!events.length) return;
  await supabase.from('risk_events').upsert(
    events.map((e) => ({ user_id: userId, event_id: e.id, title: e.subject, start_at: new Date(e.start).toISOString() })),
    { onConflict: 'user_id,event_id' },
  );
}
