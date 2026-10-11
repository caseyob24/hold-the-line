export interface Rank {
  key: string;
  name: string;
  days: number;
  label: string;
}

export const RANKS: Rank[] = [
  { key: 'recruit', name: 'Recruit', days: 1, label: '24 hours' },
  { key: 'private', name: 'Private', days: 7, label: '7 days' },
  { key: 'pfc', name: 'PFC', days: 14, label: '14 days' },
  { key: 'corporal', name: 'Corporal', days: 30, label: '30 days' },
  { key: 'sergeant', name: 'Sergeant', days: 60, label: '60 days' },
  { key: 'lieutenant', name: 'Lieutenant', days: 90, label: '90 days' },
  { key: 'captain', name: 'Captain', days: 180, label: '6 months' },
  { key: 'colonel', name: 'Colonel', days: 365, label: '1 year' },
  { key: 'general', name: 'General', days: 730, label: '2 years' },
];

/** Highest rank reached at `days`, or null before 24 hours. */
export function currentRank(days: number): Rank | null {
  let r: Rank | null = null;
  for (const k of RANKS) if (days >= k.days) r = k;
  return r;
}

export function nextRank(days: number): Rank | null {
  return RANKS.find((k) => days < k.days) ?? null;
}

/** 0..1 progress from the previous rank (or day 0) to the next one. */
export function progressToNext(days: number): number {
  const next = nextRank(days);
  if (!next) return 1;
  const prev = currentRank(days)?.days ?? 0;
  return Math.max(0, Math.min(1, (days - prev) / (next.days - prev)));
}
