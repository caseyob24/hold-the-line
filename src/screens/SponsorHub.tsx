import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../lib/store';
import { must, supabase } from '../lib/supabase';
import { Header, Sheet, ErrorNote } from '../components/Chrome';
import { Icon } from '../components/Icon';
import { Thread } from '../components/Thread';
import { fmtDate } from '../lib/time';
import type { Permissions, SponsorLink } from '../lib/types';

export function inviteUrl(code: string) {
  return `${window.location.origin}/join/${code}`;
}

/** Shares the join link through the native share sheet, a prefilled text, or the clipboard. */
export async function shareInvite(code: string, fromName: string, phone?: string | null) {
  const url = inviteUrl(code);
  const text = `${fromName} asked you to be their sponsor on Hold the Line. Join here: ${url}`;
  if (navigator.share) {
    try { await navigator.share({ title: 'Hold the Line sponsor invite', text, url }); return 'shared'; } catch { /* cancelled */ }
  }
  if (phone) {
    const sep = /iPad|iPhone|iPod/.test(navigator.userAgent) ? '&' : '?';
    window.location.href = `sms:${phone.replace(/[^\d+]/g, '')}${sep}body=${encodeURIComponent(text)}`;
    return 'sms';
  }
  await navigator.clipboard?.writeText(text);
  return 'copied';
}

const PERMS: { key: keyof Permissions; label: string }[] = [
  { key: 'streaks', label: 'Streaks & milestones' },
  { key: 'checkins', label: 'Daily check-ins & mood' },
  { key: 'urge_alerts', label: 'Alert on urge logged' },
  { key: 'missed_checkin_alerts', label: 'Alert on missed check-in' },
  { key: 'witness', label: 'Witness milestones' },
  { key: 'journal', label: 'Field notes / journal' },
  { key: 'risk_events', label: 'High-risk calendar events' },
];

export default function SponsorHub() {
  const { links, session, profile, refresh, toast, sponsoring } = useApp();
  const [inviting, setInviting] = useState<'primary' | 'backup' | null>(null);
  const [editing, setEditing] = useState<SponsorLink | null>(null);
  const primary = links.find((l) => l.is_primary) ?? links[0];
  const others = links.filter((l) => l.id !== primary?.id);
  const me = session?.user.id ?? '';

  async function setPerm(link: SponsorLink, key: keyof Permissions, value: boolean) {
    const permissions = { ...link.permissions, [key]: value };
    const { error } = await supabase.from('sponsor_links').update({ permissions }).eq('id', link.id);
    if (error) toast(error.message);
    else await refresh();
  }

  return (
    <div className="screen">
      <Header kicker="Chain of command" title={primary ? 'Your sponsor' : 'Get a sponsor'} />

      {sponsoring > 0 && (
        <Link to="/sponsor-view" className="banner info" style={{ textDecoration: 'none' }}>You're also sponsoring {sponsoring} {sponsoring === 1 ? 'person' : 'people'} — open sponsor command →</Link>
      )}

      {!primary && (
        <div className="card stack">
          <p>A sponsor sees your progress, gets an alert when you need backup, sends you notes and signs off on your milestones. You decide exactly what they see.</p>
          <button className="btn primary full" onClick={() => setInviting('primary')}>Invite your sponsor</button>
        </div>
      )}

      {primary && (
        <>
          <div className="card steel row" style={{ gap: 14 }}>
            <div className="avatar" style={{ width: 52, height: 52, borderRadius: 26, fontFamily: 'var(--display)', fontSize: 22, fontWeight: 700 }}>{primary.sponsor_name.slice(0, 1).toUpperCase()}</div>
            <div className="stack" style={{ flex: 1, gap: 2 }}>
              <span style={{ fontSize: 17, fontWeight: 600 }}>{primary.sponsor_name}</span>
              <span className="small muted">
                {primary.status === 'active' ? `Sponsor since ${fmtDate(primary.accepted_at ?? primary.invited_at, { month: 'short', day: 'numeric' })}` : 'Invite sent — waiting for them to join'}
              </span>
            </div>
            <button className="icon-btn" aria-label="Edit sponsor" onClick={() => setEditing(primary)}><Icon name="gear" size={18} /></button>
          </div>

          {primary.status === 'pending' && (
            <button className="btn ghost full" onClick={async () => { const r = await shareInvite(primary.invite_code, profile?.display_name || 'I', primary.sponsor_phone); if (r === 'copied') toast('Invite link copied'); }}>
              <Icon name="share" size={18} />Resend invite link
            </button>
          )}

          {primary.status === 'active' && (
            <div className="card stack">
              <span className="lbl">Notes with {primary.sponsor_name}</span>
              <Thread linkId={primary.id} meId={me} otherName={primary.sponsor_name} />
            </div>
          )}

          <div className="group" style={{ padding: '8px 16px 4px' }}>
            <span className="lbl" style={{ display: 'block', padding: '6px 0 8px' }}>What {primary.sponsor_name} can see &amp; do</span>
            {PERMS.map((p) => (
              <label key={p.key} className="toggle">
                {p.label}
                <input type="checkbox" checked={Boolean(primary.permissions[p.key])} onChange={(e) => setPerm(primary, p.key, e.target.checked)} />
              </label>
            ))}
          </div>
        </>
      )}

      {others.map((l) => (
        <button key={l.id} className="card tight between" onClick={() => setEditing(l)}>
          <span>{l.sponsor_name} · backup</span>
          <span className="xs muted">{l.status === 'active' ? 'Active' : 'Invite pending'}</span>
        </button>
      ))}

      <div className="spacer" />
      {primary && <button className="btn dashed full" onClick={() => setInviting('backup')}>Invite a backup sponsor or accountability partner</button>}

      {inviting && session && (
        <InviteSheet userId={session.user.id} isPrimary={inviting === 'primary'} fromName={profile?.display_name || 'I'}
          onClose={() => setInviting(null)} onDone={async (m) => { setInviting(null); await refresh(); toast(m); }} />
      )}
      {editing && (
        <EditSheet link={editing} onClose={() => setEditing(null)} onDone={async (m) => { setEditing(null); await refresh(); toast(m); }} />
      )}
    </div>
  );
}

function InviteSheet({ userId, isPrimary, fromName, onClose, onDone }: {
  userId: string; isPrimary: boolean; fromName: string; onClose: () => void; onDone: (m: string) => void;
}) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <Sheet onClose={onClose} label="Invite sponsor">
      <span className="lbl">{isPrimary ? 'Invite your sponsor' : 'Invite a backup'}</span>
      <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" aria-label="Name" />
      <input className="input" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Mobile number" aria-label="Mobile number" />
      <ErrorNote msg={err} />
      <button className="btn primary full" disabled={busy || !name.trim()} onClick={async () => {
        setBusy(true);
        try {
          const link = must(await supabase.from('sponsor_links').insert({
            user_id: userId, sponsor_name: name.trim(), sponsor_phone: phone.trim() || null, is_primary: isPrimary,
          }).select().single()) as SponsorLink;
          const r = await shareInvite(link.invite_code, fromName, link.sponsor_phone);
          onDone(r === 'copied' ? 'Invite link copied — send it to them' : 'Invite ready');
        } catch (e) { setErr((e as Error).message); setBusy(false); }
      }}>Create invite link</button>
    </Sheet>
  );
}

function EditSheet({ link, onClose, onDone }: { link: SponsorLink; onClose: () => void; onDone: (m: string) => void }) {
  const [name, setName] = useState(link.sponsor_name);
  const [phone, setPhone] = useState(link.sponsor_phone ?? '');
  const [confirm, setConfirm] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  return (
    <Sheet onClose={onClose} label="Edit sponsor">
      <span className="lbl">Edit {link.sponsor_name}</span>
      <input className="input" value={name} onChange={(e) => setName(e.target.value)} aria-label="Name" />
      <input className="input" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Mobile number" aria-label="Mobile number" />
      <ErrorNote msg={err} />
      <button className="btn primary full" onClick={async () => {
        const { error } = await supabase.from('sponsor_links').update({ sponsor_name: name.trim(), sponsor_phone: phone.trim() || null }).eq('id', link.id);
        if (error) setErr(error.message); else onDone('Saved');
      }}>Save</button>
      {!confirm ? (
        <button className="btn ghost full" onClick={() => setConfirm(true)}>Remove sponsor</button>
      ) : (
        <button className="btn alarm full" onClick={async () => {
          const { error } = await supabase.from('sponsor_links').update({ status: 'revoked' }).eq('id', link.id);
          if (error) setErr(error.message); else onDone(`${link.sponsor_name} no longer has access`);
        }}>Confirm — end their access now</button>
      )}
    </Sheet>
  );
}
