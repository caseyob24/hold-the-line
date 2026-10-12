import { useState } from 'react';
import { useApp, useLoad } from '../lib/store';
import { supabase } from '../lib/supabase';
import { addDays, dateKey } from '../lib/time';
import { AFFIRMATIONS, affirmationFor, quoteFor } from '../lib/quotes';
import { Icon } from '../components/Icon';

const HISTORY_DAYS = 14;

export default function Motivation() {
  const { session, profile, toast } = useApp();
  const tz = profile?.timezone;
  const [tab, setTab] = useState<'affirmations' | 'orders'>('affirmations');
  const [favOnly, setFavOnly] = useState(false);
  const now = new Date();
  const today = dateKey(now, tz);

  const favs = useLoad(async () => {
    const { data } = await supabase.from('affirmation_favorites').select('affirmation_index');
    return new Set((data ?? []).map((r) => r.affirmation_index as number));
  }, []);

  const days = Array.from({ length: HISTORY_DAYS }, (_, i) => {
    const d = addDays(now, -(i + 1));
    return { k: dateKey(d, tz), label: d.toLocaleDateString('en-US', { weekday: 'short', day: '2-digit', timeZone: tz }).toUpperCase() };
  });
  const todayAff = affirmationFor(today);
  const todayQuote = quoteFor(today, profile?.quote_authors);
  const isFav = (i: number) => favs.data?.has(i) ?? false;

  async function toggleFav(index: number) {
    if (!session) return;
    const on = isFav(index);
    const q = on
      ? supabase.from('affirmation_favorites').delete().eq('affirmation_index', index)
      : supabase.from('affirmation_favorites').insert({ user_id: session.user.id, affirmation_index: index });
    const { error } = await q;
    if (error) return toast(error.message);
    favs.reload();
  }

  async function share(text: string) {
    if (navigator.share) {
      try { await navigator.share({ text }); return; } catch { return; }
    }
    await navigator.clipboard?.writeText(text);
    toast('Copied');
  }

  const favoriteList = [...(favs.data ?? [])].map((i) => AFFIRMATIONS[i]).filter(Boolean);

  return (
    <div className="screen">
      <h1 className="title">Motivation</h1>

      <div role="tablist" style={{ display: 'flex', gap: 4, background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 12, padding: 4 }}>
        {(['affirmations', 'orders'] as const).map((t) => (
          <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)}
            style={{ flex: 1, minHeight: 40, borderRadius: 10, border: 0, fontSize: 14, fontWeight: 600, background: tab === t ? 'var(--brass-soft)' : 'none', color: tab === t ? 'var(--brass-text)' : 'var(--muted)' }}>
            {t === 'affirmations' ? 'Affirmations' : 'Orders of the day'}
          </button>
        ))}
      </div>

      {tab === 'affirmations' ? (
        <>
          <div className="card hero stack" style={{ padding: '24px 20px', alignItems: 'center', textAlign: 'center', gap: 14, borderRadius: 16 }}>
            <span className="lbl brass">Today · {now.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: tz })}</span>
            <p className="display" style={{ fontWeight: 600, fontSize: 30, lineHeight: 1.1 }}>{todayAff.text}</p>
            <div className="row" style={{ gap: 10 }}>
              <button className="icon-btn" style={{ borderColor: 'var(--brass-line)', background: 'none' }} aria-pressed={isFav(todayAff.index)}
                aria-label={isFav(todayAff.index) ? 'Remove from favorites' : 'Save to favorites'} onClick={() => toggleFav(todayAff.index)}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill={isFav(todayAff.index) ? 'var(--brass)' : 'none'} stroke="var(--brass)" strokeWidth="1.6" strokeLinejoin="round" aria-hidden="true"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" /></svg>
              </button>
              <button className="icon-btn" style={{ borderColor: 'var(--brass-line)', background: 'none' }} aria-label="Share" onClick={() => share(todayAff.text)}>
                <Icon name="share" size={20} />
              </button>
            </div>
          </div>

          <div className="between">
            <span className="lbl">{favOnly ? 'Favorites' : 'Previous days'}</span>
            <button className={`chip${favOnly ? ' on' : ''}`} style={{ minHeight: 34, fontSize: 12 }} aria-pressed={favOnly} onClick={() => setFavOnly((v) => !v)}>♥ Favorites</button>
          </div>
          <div className="stack" style={{ gap: 8 }}>
            {favOnly
              ? (favoriteList.length ? favoriteList.map((t) => (
                <div key={t} className="card tight" style={{ fontSize: 15, lineHeight: 1.4 }}>{t}</div>
              )) : <span className="small muted">Tap the heart on an affirmation to save it here.</span>)
              : days.map((d) => {
                const a = affirmationFor(d.k);
                return (
                  <div key={d.k} className="card tight row" style={{ alignItems: 'flex-start' }}>
                    <span className="mono" style={{ fontSize: 11, color: 'var(--muted)', width: 48, flex: 'none', paddingTop: 2 }}>{d.label}</span>
                    <span style={{ flex: 1, fontSize: 15, lineHeight: 1.4 }}>{a.text}</span>
                    <button aria-label={isFav(a.index) ? 'Remove from favorites' : 'Save to favorites'} aria-pressed={isFav(a.index)} onClick={() => toggleFav(a.index)}
                      style={{ background: 'none', border: 0, color: isFav(a.index) ? 'var(--brass)' : '#555A4A', fontSize: 18, minWidth: 32, minHeight: 32 }}>♥</button>
                  </div>
                );
              })}
          </div>
        </>
      ) : (
        <>
          <div className="card hero stack" style={{ padding: '22px 20px', gap: 10, borderRadius: 16 }}>
            <span className="lbl brass">Today's order</span>
            <p className="display" style={{ fontWeight: 500, fontSize: 26, lineHeight: 1.15 }}>“{todayQuote.text}”</p>
            <span className="small muted">— {todayQuote.author}{todayQuote.title ? `, ${todayQuote.title}` : ''}</span>
            <button className="icon-btn" style={{ borderColor: 'var(--brass-line)', background: 'none', alignSelf: 'flex-start' }} aria-label="Share" onClick={() => share(`“${todayQuote.text}” — ${todayQuote.author}`)}>
              <Icon name="share" size={20} />
            </button>
          </div>
          <span className="lbl">Previous days</span>
          <div className="stack" style={{ gap: 8 }}>
            {days.map((d) => {
              const q = quoteFor(d.k, profile?.quote_authors);
              return (
                <div key={d.k} className="card tight row" style={{ alignItems: 'flex-start' }}>
                  <span className="mono" style={{ fontSize: 11, color: 'var(--muted)', width: 48, flex: 'none', paddingTop: 2 }}>{d.label}</span>
                  <span className="stack" style={{ flex: 1, gap: 4 }}>
                    <span style={{ fontSize: 15, lineHeight: 1.4 }}>“{q.text}”</span>
                    <span className="xs muted">— {q.author}</span>
                  </span>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
