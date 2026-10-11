import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useApp, useLoad } from '../lib/store';
import { supabase } from '../lib/supabase';
import { quoteFor } from '../lib/quotes';
import { currentRank, nextRank, progressToNext } from '../lib/ranks';
import { dateKey, elapsedParts, greeting } from '../lib/time';
import { Icon } from '../components/Icon';
import { Empty } from '../components/Chrome';
import type { Message } from '../lib/types';

export default function Home() {
  const { profile, sobrieties, links, sponsoring } = useApp();
  const nav = useNavigate();
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(t);
  }, []);

  const tz = profile?.timezone;
  const today = dateKey(new Date(now), tz);
  const quote = quoteFor(today, profile?.quote_authors);
  const primary = sobrieties.find((s) => s.is_primary) ?? sobrieties[0];
  const sponsor = links.find((l) => l.status === 'active');

  const checkin = useLoad(async () => {
    const { data } = await supabase.from('check_ins').select('id').eq('date', today).maybeSingle();
    return Boolean(data);
  }, [today]);

  const note = useLoad(async () => {
    if (!sponsor) return null;
    const { data } = await supabase.from('messages').select('*').eq('link_id', sponsor.id)
      .neq('from_id', profile?.id ?? '').order('created_at', { ascending: false }).limit(1).maybeSingle();
    return data as Message | null;
  }, [sponsor?.id]);

  const p = primary ? elapsedParts(primary.start_at, now) : null;
  const next = p ? nextRank(p.days) : null;
  const rank = p ? currentRank(p.days) : null;
  const dateLabel = new Date(now).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', timeZone: tz });

  return (
    <div className="screen">
      <div className="between">
        <div className="head" style={{ gap: 2 }}>
          <span className="lbl">{dateLabel}</span>
          <span className="display" style={{ fontWeight: 700, fontSize: 26, letterSpacing: '.02em' }}>
            {greeting(new Date(now))}, {profile?.display_name || 'soldier'}
          </span>
        </div>
        <Link to={sponsoring ? '/sponsor-view' : '/sponsor'} className="icon-btn" aria-label={sponsoring ? 'Sponsor command' : 'Sponsor messages'}>
          <Icon name={sponsoring ? 'users' : 'bell'} />
        </Link>
      </div>

      {primary && p ? (
        <Link to="/milestones" className="card hero" style={{ textDecoration: 'none', color: 'inherit', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: '22px 20px' }}>
          <span className="lbl brass">{primary.name} · holding the line</span>
          <div className="big-num" style={{ fontSize: 112 }}>{p.days}</div>
          <span className="display" style={{ fontWeight: 600, fontSize: 20, letterSpacing: '.12em', textTransform: 'uppercase' }}>
            {p.days === 1 ? 'day' : 'days'} sober
          </span>
          <span className="mono small muted">{p.weeks} wk {p.dayRem} d · {p.hours} h {p.mins} m</span>
          <div style={{ width: '100%', marginTop: 12 }} className="stack">
            <div className="between xs muted">
              <span>{rank ? `Rank: ${rank.name}` : 'First 24 hours'}{next ? ` · Next: ${next.name}` : ''}</span>
              <span>{next ? `${next.days - p.days} to go` : 'Highest rank'}</span>
            </div>
            <div className="bar"><div style={{ width: `${progressToNext(p.days) * 100}%` }} /></div>
          </div>
        </Link>
      ) : (
        <Empty to="/sobrieties" cta="Add one">Nothing tracked yet.</Empty>
      )}

      <div className="card stack">
        <span className="lbl">Order of the day</span>
        <p className="display" style={{ fontWeight: 500, fontSize: 24, lineHeight: 1.15 }}>“{quote.text}”</p>
        <span className="small muted">— {quote.author}{quote.title ? `, ${quote.title}` : ''}</span>
      </div>

      <div className="grid2">
        <button className="btn" style={{ background: checkin.data ? 'var(--card)' : 'var(--brass)', color: checkin.data ? 'var(--olive)' : 'var(--bg)', border: checkin.data ? '1px solid var(--line)' : 0, justifyContent: 'flex-start', minHeight: 56 }}
          onClick={() => nav('/check-in')}>
          <Icon name="check" width={2} />{checkin.data ? 'Checked in' : 'Check in'}
        </button>
        <button className="btn ghost" style={{ justifyContent: 'flex-start', minHeight: 56 }} onClick={() => nav('/urge')}>
          <Icon name="flame" stroke="var(--urge)" />Log urge
        </button>
        <button className="btn ghost" style={{ justifyContent: 'flex-start', minHeight: 56 }} onClick={() => nav('/workouts?new=1')}>
          <Icon name="dumbbell" stroke="var(--steel)" />Workout
        </button>
        <button className="btn ghost" style={{ justifyContent: 'flex-start', minHeight: 56, borderColor: 'var(--urge-line)' }} onClick={() => nav('/reach-out')}>
          <Icon name="phone" stroke="#F08C6C" />{sponsor ? `Call ${sponsor.sponsor_name}` : 'Reach out'}
        </button>
      </div>

      {sponsor && note.data && (
        <Link to="/sponsor" className="card tight row" style={{ textDecoration: 'none', color: 'inherit' }}>
          <div className="avatar">{sponsor.sponsor_name.slice(0, 1).toUpperCase()}</div>
          <div style={{ flex: 1, minWidth: 0 }} className="stack" >
            <span className="small muted">Note from {sponsor.sponsor_name} · sponsor</span>
            <span style={{ fontSize: 14, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{note.data.body}</span>
          </div>
        </Link>
      )}
      {!sponsor && links.length === 0 && (
        <Empty to="/sponsor" cta="Invite a sponsor">No sponsor on the line yet.</Empty>
      )}
    </div>
  );
}
