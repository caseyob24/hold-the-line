const DAY = 86_400_000;

/** Whole days since `startIso` (floors; day 0 for the first 24 hours). */
export function daysSince(startIso: string, now = Date.now()): number {
  return Math.max(0, Math.floor((now - Date.parse(startIso)) / DAY));
}

/** "6 wk 5 d · 14 h 22 m" style breakdown of elapsed time. */
export function elapsedParts(startIso: string, now = Date.now()) {
  const ms = Math.max(0, now - Date.parse(startIso));
  const days = Math.floor(ms / DAY);
  const hours = Math.floor((ms % DAY) / 3_600_000);
  const mins = Math.floor((ms % 3_600_000) / 60_000);
  const secs = Math.floor((ms % 60_000) / 1000);
  return { days, weeks: Math.floor(days / 7), dayRem: days % 7, hours, mins, secs };
}

/** YYYY-MM-DD for a date in the given IANA time zone. */
export function dateKey(d: Date = new Date(), tz = Intl.DateTimeFormat().resolvedOptions().timeZone): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

export function fmtDate(iso: string, opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' }) {
  return new Date(iso).toLocaleDateString('en-US', opts);
}

export function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

export function fmtDayTime(iso: string) {
  const d = new Date(iso);
  const today = dateKey(new Date());
  const yest = dateKey(new Date(Date.now() - DAY));
  const k = dateKey(d);
  const day = k === today ? 'Today' : k === yest ? 'Yesterday' : d.toLocaleDateString('en-US', { weekday: 'short' });
  return `${day} ${fmtTime(iso)}`;
}

export function money(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
}

/** Date input value (YYYY-MM-DD) to an ISO timestamp at local midnight. */
export function inputDateToIso(v: string): string {
  const [y, m, d] = v.split('-').map(Number);
  return new Date(y, m - 1, d).toISOString();
}

export function isoToInputDate(iso: string): string {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function startOfWeek(d = new Date()): Date {
  const s = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  s.setDate(s.getDate() - s.getDay());
  return s;
}

export function addDays(d: Date, n: number): Date {
  const c = new Date(d);
  c.setDate(c.getDate() + n);
  return c;
}

export function greeting(d = new Date()) {
  const h = d.getHours();
  return h < 12 ? 'Morning' : h < 17 ? 'Afternoon' : 'Evening';
}
