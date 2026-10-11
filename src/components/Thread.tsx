import { useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { api } from '../lib/api';
import type { Message } from '../lib/types';
import { fmtDayTime } from '../lib/time';

/** Realtime two-way note thread for one sponsor link. */
export function Thread({ linkId, meId, otherName, limit = 30, compact = false, tone = 'brass' }: {
  linkId: string; meId: string; otherName: string; limit?: number; compact?: boolean; tone?: 'brass' | 'steel';
}) {
  const [msgs, setMsgs] = useState<Message[]>([]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let alive = true;
    supabase.from('messages').select('*').eq('link_id', linkId).order('created_at', { ascending: false }).limit(limit)
      .then(({ data }) => {
        if (!alive) return;
        const rows = ((data ?? []) as Message[]).reverse();
        setMsgs(rows);
        const unread = rows.filter((m) => m.from_id !== meId && !m.read_at).map((m) => m.id);
        if (unread.length) supabase.from('messages').update({ read_at: new Date().toISOString() }).in('id', unread).then(() => undefined);
      });
    const ch = supabase.channel(`messages:${linkId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `link_id=eq.${linkId}` }, (p) => {
        setMsgs((m) => (m.some((x) => x.id === (p.new as Message).id) ? m : [...m, p.new as Message]));
      })
      .subscribe();
    return () => { alive = false; supabase.removeChannel(ch); };
  }, [linkId, meId, limit]);

  useEffect(() => { if (!compact) endRef.current?.scrollIntoView({ block: 'nearest' }); }, [msgs.length, compact]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const body = draft.trim();
    if (!body) return;
    setBusy(true);
    const { data, error } = await supabase.from('messages').insert({ link_id: linkId, from_id: meId, body }).select().single();
    setBusy(false);
    if (!error && data) {
      setDraft('');
      setMsgs((m) => (m.some((x) => x.id === data.id) ? m : [...m, data as Message]));
      api('notify-message', { method: 'POST', body: JSON.stringify({ message_id: data.id }) }).catch(() => undefined);
    }
  }

  const shown = compact ? msgs.slice(-2) : msgs;
  return (
    <div className="stack">
      {shown.length === 0 && <span className="small muted">No notes yet. Say hello.</span>}
      {shown.map((m) => (
        <div key={m.id} className={`bubble ${m.from_id === meId ? 'me' : 'them'}`} title={fmtDayTime(m.created_at)}>
          {m.body}
        </div>
      ))}
      <div ref={endRef} />
      <form className="row" onSubmit={send} style={{ gap: 8 }}>
        <input className="input" value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={`Note to ${otherName}`} aria-label={`Note to ${otherName}`} maxLength={2000} />
        <button className={`btn ${tone === 'steel' ? 'steel' : 'primary'}`} style={{ minHeight: 48, fontSize: 15 }} disabled={busy || !draft.trim()}>Send</button>
      </form>
    </div>
  );
}
