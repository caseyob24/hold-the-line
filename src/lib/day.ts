import type { Review } from './types';

/** Where we are in the day's arc. Evening starts 3 hours before the debrief time (or 5 pm, whichever is earlier). */
export function phaseOf(now: Date, tz: string | undefined, reviewTime = '21:00'): 'morning' | 'day' | 'evening' {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(now);
  const h = Number(parts.find((p) => p.type === 'hour')?.value ?? 0);
  const m = Number(parts.find((p) => p.type === 'minute')?.value ?? 0);
  const minutes = h * 60 + m;
  const [rh, rm] = reviewTime.split(':').map(Number);
  const eveningAt = Math.min(17 * 60, rh * 60 + rm - 180);
  if (minutes >= eveningAt) return 'evening';
  if (minutes < 12 * 60) return 'morning';
  return 'day';
}

export const OUTCOME_LABEL: Record<Review['outcome'], string> = {
  held: 'Held the line',
  struggled: 'Held — hard day',
  slipped: 'Slipped',
};

export const OUTCOME_COLOR: Record<Review['outcome'], string> = {
  held: 'var(--olive)',
  struggled: 'var(--brass)',
  slipped: 'var(--urge)',
};

/** "9:00 PM" from "21:00". */
export function fmtClock(t: string) {
  const [h, m] = t.split(':').map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: m ? '2-digit' : undefined });
}
