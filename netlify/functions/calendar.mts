import type { Config } from '@netlify/functions';
import { graph } from '../lib/ms';
import { db, handle, HttpError, json, requireUser } from '../lib/util';

// Named extended property used to tag events the app creates (and what kind they are).
const KIND_PROP = 'String {7f3c2a91-4d6b-4e1f-9a8c-5b2d6e0f1a33} Name HoldTheLineKind';

interface GraphEvent {
  id: string;
  subject: string;
  isAllDay: boolean;
  start: { dateTime: string };
  end: { dateTime: string };
  location?: { displayName?: string };
  singleValueExtendedProperties?: { id: string; value: string }[];
}

const utc = (dt: string) => (dt.endsWith('Z') ? dt : `${dt.replace(/\.\d+$/, '')}Z`);

export default handle(async (req) => {
  const userId = await requireUser(req);

  if (req.method === 'GET') {
    const u = new URL(req.url);
    const start = u.searchParams.get('start');
    const end = u.searchParams.get('end');
    if (!start || !end) throw new HttpError(400, 'start and end are required');
    const q = new URLSearchParams({
      startDateTime: start,
      endDateTime: end,
      $select: 'id,subject,start,end,location,isAllDay',
      $top: '250',
      $orderby: 'start/dateTime',
      $expand: `singleValueExtendedProperties($filter=id eq '${KIND_PROP}')`,
    });
    const body = await graph<{ value: GraphEvent[] }>(userId, `/me/calendarView?${q}`, {
      headers: { Prefer: 'outlook.timezone="UTC"' },
    });
    const events = body.value.map((e) => {
      const kind = e.singleValueExtendedProperties?.[0]?.value ?? null;
      return {
        id: e.id,
        subject: e.subject || '(No title)',
        start: utc(e.start.dateTime),
        end: utc(e.end.dateTime),
        location: e.location?.displayName || null,
        isAllDay: e.isAllDay,
        fromApp: Boolean(kind),
        appKind: kind,
      };
    });
    return json({ events });
  }

  if (req.method === 'POST') {
    const b = (await req.json()) as {
      subject: string; start: string; end: string; kind: string; body?: string; location?: string; recurrence?: 'daily' | 'weekly';
    };
    if (!b.subject || !b.start || !b.end) throw new HttpError(400, 'subject, start and end are required');
    const start = new Date(b.start);
    const event: Record<string, unknown> = {
      subject: b.subject,
      start: { dateTime: start.toISOString().replace('Z', ''), timeZone: 'UTC' },
      end: { dateTime: new Date(b.end).toISOString().replace('Z', ''), timeZone: 'UTC' },
      isReminderOn: true,
      reminderMinutesBeforeStart: b.kind === 'checkin' ? 0 : 15,
      singleValueExtendedProperties: [{ id: KIND_PROP, value: b.kind || 'custom' }],
    };
    if (b.body) event.body = { contentType: 'text', content: b.body };
    if (b.location) event.location = { displayName: b.location };
    if (b.recurrence) {
      // Recurring events are written in the user's own zone so they don't drift across DST changes.
      const { data: p } = await db().from('profiles').select('timezone').eq('id', userId).single();
      const timeZone = p?.timezone ?? 'America/Los_Angeles';
      const wall = (d: Date) => d.toLocaleString('sv-SE', { timeZone }).replace(' ', 'T');
      event.start = { dateTime: wall(start), timeZone };
      event.end = { dateTime: wall(new Date(b.end)), timeZone };
      event.recurrence = {
        pattern: b.recurrence === 'daily'
          ? { type: 'daily', interval: 1 }
          : { type: 'weekly', interval: 1, daysOfWeek: [start.toLocaleDateString('en-US', { weekday: 'long', timeZone }).toLowerCase()] },
        range: { type: 'noEnd', startDate: start.toLocaleDateString('en-CA', { timeZone }) },
      };
    }
    const created = await graph<{ id: string }>(userId, '/me/events', { method: 'POST', body: JSON.stringify(event) });
    return json({ id: created.id }, 201);
  }

  throw new HttpError(405, 'Method not allowed');
});

export const config: Config = { path: '/api/calendar' };
