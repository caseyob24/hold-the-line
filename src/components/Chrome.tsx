import { useState, type ReactNode } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { Icon } from './Icon';
import { useApp } from '../lib/store';

export function TabBar() {
  const { profile } = useApp();
  const [logOpen, setLogOpen] = useState(false);
  const nav = useNavigate();
  const isSponsor = profile?.role === 'sponsor';
  const cls = ({ isActive }: { isActive: boolean }) => `tab${isActive ? ' active' : ''}`;
  return (
    <>
      <nav className="tabbar" aria-label="Main">
        <div className="tabbar-inner">
          <NavLink to="/" end className={cls}><Icon name="home" size={22} />Home</NavLink>
          {!isSponsor && <NavLink to="/today" className={cls}><Icon name="today" size={22} />Today</NavLink>}
          {!isSponsor && (
            <button className="tab" onClick={() => setLogOpen(true)} aria-haspopup="dialog">
              <Icon name="plusCircle" size={22} />Log
            </button>
          )}
          {!isSponsor && <NavLink to="/motivation" className={cls}><Icon name="star" size={22} />Motivation</NavLink>}
          {isSponsor && <NavLink to="/game-day" className={cls}><Icon name="tv" size={22} />Game Day</NavLink>}
          <NavLink to="/more" className={cls}><Icon name="more" size={22} />More</NavLink>
        </div>
      </nav>
      {logOpen && (
        <Sheet onClose={() => setLogOpen(false)} label="Log">
          <span className="lbl">Log</span>
          {[
            { to: '/check-in', icon: 'check', label: 'Morning check-in', color: 'var(--brass)' },
            { to: '/review', icon: 'moon', label: 'Evening debrief', color: 'var(--steel)' },
            { to: '/workbook', icon: 'book', label: 'Workbook drill', color: 'var(--olive)' },
            { to: '/urge', icon: 'flame', label: 'Log an urge', color: 'var(--urge)' },
            { to: '/workouts?new=1', icon: 'dumbbell', label: 'Workout', color: 'var(--steel)' },
            { to: '/reach-out', icon: 'phone', label: 'Reach out now', color: '#F08C6C' },
          ].map((a) => (
            <button key={a.to} className="btn ghost full" style={{ justifyContent: 'flex-start' }}
              onClick={() => { setLogOpen(false); nav(a.to); }}>
              <Icon name={a.icon} stroke={a.color} />{a.label}
            </button>
          ))}
        </Sheet>
      )}
    </>
  );
}

export function Sheet({ children, onClose, label }: { children: ReactNode; onClose: () => void; label: string }) {
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={label} onClick={(e) => e.stopPropagation()}>
        {children}
        <button className="btn dashed full" onClick={onClose}>Close</button>
      </div>
    </div>
  );
}

export function Header({ kicker, title, kickerClass, right, back }: {
  kicker?: string;
  title: string;
  kickerClass?: string;
  right?: ReactNode;
  back?: boolean;
}) {
  const nav = useNavigate();
  return (
    <div className="head-row">
      <div className="head">
        {back && (
          <button className="icon-btn" style={{ width: 36, height: 36, marginBottom: 6 }} aria-label="Back" onClick={() => nav(-1)}>
            <Icon name="back" size={18} />
          </button>
        )}
        {kicker && <span className={`lbl ${kickerClass ?? ''}`}>{kicker}</span>}
        <h1 className="title">{title}</h1>
      </div>
      {right}
    </div>
  );
}

export function Empty({ children, to, cta }: { children: ReactNode; to?: string; cta?: string }) {
  return (
    <div className="card dashed stack small muted">
      <p>{children}</p>
      {to && cta && <Link className="btn ghost" to={to}>{cta}</Link>}
    </div>
  );
}

export function ErrorNote({ msg }: { msg: string | null }) {
  if (!msg) return null;
  return <div className="banner warn" role="alert">{msg}</div>;
}
