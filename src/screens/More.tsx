import { Link } from 'react-router-dom';
import { useApp } from '../lib/store';
import { Header } from '../components/Chrome';
import { Icon } from '../components/Icon';

export default function More() {
  const { profile, sponsoring } = useApp();
  const isSponsor = profile?.role === 'sponsor';
  const items = [
    ...(!isSponsor ? [
      { to: '/sobrieties', icon: 'list', label: 'My sobrieties' },
      { to: '/milestones', icon: 'medal', label: 'Rank & decorations' },
      { to: '/savings', icon: 'coin', label: 'Savings & health' },
      { to: '/workouts', icon: 'dumbbell', label: 'Workout notes' },
      { to: '/reach-out', icon: 'phone', label: 'Reach out' },
    ] : []),
    ...(sponsoring && !isSponsor ? [{ to: '/sponsor-view', icon: 'users', label: 'Sponsor command' }] : []),
    { to: '/game-day', icon: 'tv', label: 'Game Day' },
    { to: '/settings', icon: 'gear', label: 'Settings' },
  ];
  return (
    <div className="screen">
      <Header title="More" />
      <div className="group">
        {items.map((i) => (
          <Link key={i.to} to={i.to} className="item" style={{ justifyContent: 'flex-start', gap: 14 }}>
            <Icon name={i.icon} stroke="var(--brass)" />
            <span style={{ flex: 1 }}>{i.label}</span>
            <span style={{ transform: 'scaleX(-1)', display: 'inline-flex', color: 'var(--muted)' }}><Icon name="back" size={16} /></span>
          </Link>
        ))}
      </div>
      {isSponsor && (
        <p className="small muted">
          You joined as a sponsor. Want to track your own sobriety too? <Link to="/onboarding">Set up your own tracker</Link> —
          sponsor command stays one tap away under More.
        </p>
      )}
    </div>
  );
}
