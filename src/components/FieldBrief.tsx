import { useEffect, useState } from 'react';
import { quoteFor, yearLabel } from '../lib/quotes';
import { Sheet } from './Chrome';
import { track } from '../lib/track';

const shortDay = (k: string) => new Date(`${k}T12:00:00`).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });

function shift(k: string, n: number) {
  const d = new Date(`${k}T12:00:00`);
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** The history behind a day's quote: who, where, what was happening, and what it means for today. */
export function FieldBrief({ day, today, authors, onClose }: { day: string; today: string; authors?: string[]; onClose: () => void }) {
  const [k, setK] = useState(day);
  const q = quoteFor(k, authors ?? []);
  const short = q.battle.replace(/^(First |Second )?(Battle|Siege|Raid) of (the )?/, '');
  const place = q.place.split(',')[0];
  useEffect(() => { track('field_brief', { quote: q.id }); }, [q.id]);

  async function share() {
    const text = `“${q.text}” — ${q.speaker}, ${q.battle} (${yearLabel(q.year)})\n\n${q.lesson}`;
    if (navigator.share) { try { await navigator.share({ text }); } catch { /* cancelled */ } return; }
    await navigator.clipboard?.writeText(text);
  }

  return (
    <Sheet onClose={onClose} label={`Field brief: ${q.battle}`}>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <span className="lbl brass" style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Field brief · {short}</span>
        <span className={`brief-tag ${q.record}`}>{q.record.toUpperCase()}</span>
      </div>
      {k !== today && <span className="xs muted">Order for {shortDay(k)}</span>}

      <p className="display" style={{ fontWeight: 600, fontSize: 28, lineHeight: 1.08, margin: 0 }}>“{q.text}”</p>
      <span className="small muted">— {q.speaker}{q.speakerTitle ? `, ${q.speakerTitle}` : ''}</span>

      <div className="brief-facts">
        <div><span>Date</span><b>{q.date}</b></div>
        <div><span>Place</span><b>{place}</b></div>
        <div><span>War</span><b>{q.war.replace(/ Wars?$/, '')}</b></div>
      </div>

      <span className="lbl" style={{ marginTop: 4 }}>The moment</span>
      <p style={{ margin: 0, fontSize: 15, lineHeight: 1.5 }}>{q.moment}</p>

      <div className="brief-lesson">
        <span className="lbl brass">For your line today</span>
        <p style={{ margin: 0, fontSize: 15, lineHeight: 1.45 }}>{q.lesson}</p>
      </div>

      <span className="xs muted" style={{ lineHeight: 1.4 }}>Source: {q.source.replace(/\.$/, '')}.{q.note ? ` ${q.note}` : ''}</span>

      <div className="grid2">
        <button className="btn ghost" onClick={() => setK(shift(k, -1))}>‹ Previous day</button>
        {k < today
          ? <button className="btn ghost" onClick={() => setK(shift(k, 1))}>Next day ›</button>
          : <button className="btn ghost" onClick={share}>Share</button>}
      </div>
    </Sheet>
  );
}
