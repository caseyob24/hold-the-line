import { useNavigate } from 'react-router-dom';
import { useApp, useLoad } from '../lib/store';
import { supabase } from '../lib/supabase';
import { dateKey, daysSince } from '../lib/time';
import { fmtClock, OUTCOME_COLOR, OUTCOME_LABEL, phaseOf } from '../lib/day';
import { Icon } from './Icon';
import { track } from '../lib/track';
import type { Review } from '../lib/types';

/**
 * The day's arc in one card: pledge in the morning, hold through the day, confirm at night.
 * Shared by Home and Today so the story is the same everywhere.
 */
export function DayArc({ onPledged, compact = false }: { onPledged?: () => void; compact?: boolean }) {
  const { profile, session, focus, toast } = useApp();
  const nav = useNavigate();
  const tz = profile?.timezone;
  const now = new Date();
  const today = dateKey(now, tz);
  const day = focus ? daysSince(focus.start_at) : null;
  const phase = phaseOf(now, tz, profile?.review_time ?? '21:00');

  const state = useLoad(async () => {
    const [c, r] = await Promise.all([
      supabase.from('check_ins').select('pledged, created_at').eq('date', today).maybeSingle(),
      supabase.from('reviews').select('*').eq('date', today).maybeSingle(),
    ]);
    return { pledged: Boolean(c.data?.pledged), pledgedAt: c.data?.created_at as string | undefined, review: (r.data as Review | null) ?? null };
  }, [today]);

  async function pledge() {
    if (!session) return;
    const { error } = await supabase.from('check_ins').upsert(
      { user_id: session.user.id, date: today, pledged: true, shared_with_sponsor: profile?.share_checkins_default ?? true },
      { onConflict: 'user_id,date' },
    );
    if (error) return toast(error.message);
    track('pledge');
    toast("Pledged. Tomorrow isn't your fight yet.");
    await state.reload();
    onPledged?.();
  }

  const s = state.data;
  const pledged = s?.pledged ?? false;
  const review = s?.review ?? null;
  const steps = [
    { k: 'pledge', icon: 'sun', label: 'Pledge', done: pledged, active: !pledged && phase === 'morning' },
    { k: 'hold', icon: 'shield', label: 'Hold', done: Boolean(review), active: pledged && !review && phase !== 'evening' },
    { k: 'confirm', icon: 'moon', label: 'Confirm', done: Boolean(review), active: !review && phase === 'evening' },
  ];

  return (
    <div className="card hero stack" style={{ gap: 12 }}>
      <div className="between">
        <span className="lbl brass">{day != null ? `Day ${day} · ` : ''}Today's line</span>
        {review && <span className="xs" style={{ color: OUTCOME_COLOR[review.outcome], fontWeight: 600 }}>Closed</span>}
      </div>

      <div className="arc" aria-label="Pledge, hold, confirm">
        {steps.map((st, i) => (
          <div key={st.k} className={`arc-step${st.done ? ' done' : ''}${st.active ? ' active' : ''}`}>
            {i > 0 && <span className="arc-line" aria-hidden="true" />}
            <span className="arc-dot"><Icon name={st.icon} size={16} width={2} /></span>
            <span className="arc-label">{st.label}</span>
          </div>
        ))}
      </div>

      {s && (review ? (
        <div className="stack" style={{ gap: 6 }}>
          <div className="row" style={{ gap: 10, alignItems: 'center' }}>
            <span style={{ width: 10, height: 10, borderRadius: 5, background: OUTCOME_COLOR[review.outcome], flex: 'none' }} />
            <span style={{ fontWeight: 600, fontSize: 16 }}>{OUTCOME_LABEL[review.outcome]}</span>
            <span className="xs muted" style={{ marginLeft: 'auto' }}>{pledged ? 'Pledged · confirmed' : 'Confirmed'}</span>
          </div>
          {!compact && <button className="btn dashed full" onClick={() => nav('/review')}>Edit tonight's debrief</button>}
        </div>
      ) : !pledged && phase !== 'evening' ? (
        <>
          <button className="btn primary full" onClick={pledge}>Make today's pledge</button>
          <span className="xs muted">One tap: "Today, I hold the line." Tonight you'll confirm you did.</span>
        </>
      ) : phase === 'evening' ? (
        <>
          <span style={{ fontWeight: 600, fontSize: 17, lineHeight: 1.2 }}>Did you hold the line today?</span>
          <div className="grid2">
            <button className="btn full arc-yes" onClick={() => nav('/review?outcome=held')}><Icon name="check" width={2.4} />Yes, I held</button>
            <button className="btn full arc-no" onClick={() => nav('/review?outcome=slipped')}>No, I slipped</button>
          </div>
          {!pledged && <button className="btn dashed full" onClick={pledge}>Late pledge for today</button>}
        </>
      ) : (
        <>
          <div className="row" style={{ gap: 10, alignItems: 'center' }}>
            <Icon name="check" width={2.4} stroke="var(--olive)" />
            <span style={{ fontWeight: 600 }}>Pledged{s.pledgedAt ? ` at ${new Date(s.pledgedAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}` : ''}</span>
            <span className="xs muted" style={{ marginLeft: 'auto' }}>Confirm tonight · {fmtClock(profile?.review_time ?? '21:00')}</span>
          </div>
          {!compact && <button className="btn dashed full" onClick={() => nav('/review')}>Close out the day early</button>}
        </>
      ))}
    </div>
  );
}
