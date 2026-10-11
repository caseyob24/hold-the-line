import all from '../data/quotes.json';

export interface Quote {
  text: string;
  author: string;
  title: string;
  era: string;
  source?: string;
  verified: boolean;
}

export const QUOTES = all as Quote[];
export const AUTHORS = [...new Set(QUOTES.map((q) => q.author))].sort();

// Deterministic shuffle so every device (and the push job) agrees on the day's quote.
function seeded(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

/** The quote for a YYYY-MM-DD day. Cycles through the whole pool before repeating. */
export function quoteFor(day: string, authors: string[] = []): Quote {
  const pool = authors.length ? QUOTES.filter((q) => authors.includes(q.author)) : QUOTES;
  const list = pool.length ? pool : QUOTES;
  const dayNum = Math.floor(Date.parse(`${day}T12:00:00Z`) / 86_400_000);
  // One fixed shuffle per pool size: any run of `list.length` consecutive days has no repeats.
  const order = list.map((_, i) => i);
  const rnd = seeded(7919 + list.length);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return list[order[dayNum % list.length]];
}
