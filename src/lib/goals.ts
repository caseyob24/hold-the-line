import { addDays, dateKey } from './time';

export type Cadence = 'daily' | 'weekdays' | 'weekly' | 'once';

export interface Goal {
  id: string;
  user_id: string;
  title: string;
  cadence: Cadence;
  target: number;
  remind: boolean;
  position: number;
  created_week: string;
  carried_over: boolean;
  paused_at: string | null;
  archived_at: string | null;
}

export interface GoalCheck { goal_id: string; date: string }

/** Monday of the week containing `d` (weeks close Sunday night). */
export function mondayOf(d: Date): Date {
  const m = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const dow = (m.getDay() + 6) % 7; // Mon=0 … Sun=6
  m.setDate(m.getDate() - dow);
  return m;
}

/** The seven YYYY-MM-DD keys of the week starting `monday`. */
export const weekKeys = (monday: Date, tz?: string) => Array.from({ length: 7 }, (_, i) => dateKey(addDays(monday, i), tz));

/** How many times this goal asks for in a week. */
export function weeklyTarget(g: Goal): number {
  return g.cadence === 'daily' ? 7 : g.cadence === 'weekdays' ? 5 : g.cadence === 'once' ? 1 : g.target;
}

/** Whether the goal expects a check on a given day key (Mon=0..Sun=6 index into the week). */
export function dueOn(g: Goal, dayIndex: number): boolean {
  if (g.cadence === 'weekdays') return dayIndex < 5;
  return true;
}

export function cadenceLabel(g: Goal): string {
  switch (g.cadence) {
    case 'daily': return 'Every day';
    case 'weekdays': return 'Weekdays';
    case 'once': return g.carried_over ? 'Once · carried over' : 'Once this week';
    default: return `${g.target}× a week`;
  }
}

/** Consecutive days checked ending today (or yesterday if today isn't done yet). */
export function runLength(done: Set<string>, today: string, tz?: string): number {
  let n = 0;
  const start = done.has(today) ? 0 : 1;
  for (let i = start; i < 400; i++) {
    const k = dateKey(addDays(new Date(`${today}T12:00:00`), -i), tz);
    if (done.has(k)) n++; else break;
  }
  return n;
}

/** Visible this week: active, not paused, and (for one-offs) created this week or carried over once. */
export function visibleThisWeek(g: Goal, monday: string): boolean {
  if (g.archived_at || g.paused_at) return false;
  if (g.cadence !== 'once') return true;
  return g.created_week === monday || (g.carried_over && g.created_week < monday);
}
