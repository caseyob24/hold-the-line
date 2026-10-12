import all from '../data/quotes.json';
import affirmationList from '../data/affirmations.json';

export interface Quote {
  id: string;
  text: string;
  speaker: string;
  speakerTitle: string;
  battle: string;
  war: string;
  date: string;
  year: number;
  place: string;
  /** documented = recorded at the time; traditional = handed down, wording uncertain */
  record: 'documented' | 'traditional';
  source: string;
  moment: string;
  lesson: string;
  note?: string;
}

export const QUOTES = all as unknown as Quote[];
export const AUTHORS = [...new Set(QUOTES.map((q) => q.speaker))].sort();
export interface Affirmation {
  /** The line itself. */
  text: string;
  /** Why it's true — the mechanism behind it, so it reads as earned rather than decorative. */
  ground: string;
  /** One concrete thing to do with it today. */
  practice: string;
}
export const AFFIRMATIONS = affirmationList as Affirmation[];

// Deterministic shuffle so every device (and the push job) agrees on the day's pick.
function seeded(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

export const dayNumber = (day: string) => Math.floor(Date.parse(`${day}T12:00:00Z`) / 86_400_000);

/** Index into a list of `len` items for a YYYY-MM-DD day. Any `len` consecutive days never repeat. */
export function dailyIndex(day: string, len: number, salt = 0): number {
  const order = Array.from({ length: len }, (_, i) => i);
  const rnd = seeded(7919 + len + salt * 104729);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return order[((dayNumber(day) % len) + len) % len];
}

/** The quote for a YYYY-MM-DD day, optionally limited to some commanders. */
export function quoteFor(day: string, authors: string[] = []): Quote {
  const pool = authors.length ? QUOTES.filter((q) => authors.includes(q.speaker)) : QUOTES;
  const list = pool.length ? pool : QUOTES;
  return list[dailyIndex(day, list.length)];
}

/** The affirmation for a YYYY-MM-DD day, with its stable index (used for favorites). */
export function affirmationFor(day: string): Affirmation & { index: number } {
  const index = dailyIndex(day, AFFIRMATIONS.length, 1);
  return { index, ...AFFIRMATIONS[index] };
}

/** Year label: negative years are BC. */
export const yearLabel = (y: number) => (y < 0 ? `${-y} BC` : `${y}`);
