import map from '../data/directv-lv-channels.json';

const BASE = map.channels as Record<string, string>;
const STREAMING = new Set(map.streaming.map((s) => s.toUpperCase()));

/** Turns ESPN broadcast names into the best DirecTV Las Vegas channel to show. */
export function resolveTv(networks: string[], overrides: Record<string, string> = {}) {
  const table: Record<string, string> = {};
  for (const [k, v] of Object.entries({ ...BASE, ...overrides })) table[k.toUpperCase()] = v;
  const clean = networks.map((n) => n.trim()).filter(Boolean);
  // Prefer a network with a known channel number, then any TV network, then streaming.
  for (const n of clean) {
    const ch = table[n.toUpperCase()];
    if (ch) return { label: n, channel: ch, streaming: false };
  }
  for (const n of clean) {
    if (!STREAMING.has(n.toUpperCase())) return { label: n, channel: table[n.toUpperCase()] || null, streaming: false };
  }
  if (clean.length) return { label: clean[0], channel: null, streaming: true };
  return null;
}
