import { useState, type ReactNode } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { configured } from './lib/supabase';
import { useApp } from './lib/store';
import { lockEnabled } from './lib/lock';
import { TabBar } from './components/Chrome';
import Login from './screens/Login';
import Join from './screens/Join';
import Onboarding from './screens/Onboarding';
import Home from './screens/Home';
import Sobrieties from './screens/Sobrieties';
import CheckIn from './screens/CheckIn';
import UrgeLog from './screens/UrgeLog';
import Milestones from './screens/Milestones';
import Savings from './screens/Savings';
import Workouts from './screens/Workouts';
import Calendar from './screens/Calendar';
import ReachOut from './screens/ReachOut';
import SponsorHub from './screens/SponsorHub';
import SponsorView from './screens/SponsorView';
import Settings from './screens/Settings';
import GameDay from './screens/GameDay';
import More from './screens/More';
import Lock from './screens/Lock';
import Setup from './screens/Setup';

export default function App() {
  const { ready, session, profile } = useApp();
  const loc = useLocation();
  const [unlocked, setUnlocked] = useState(() => !lockEnabled());

  if (!configured) return <Setup />;
  if (!ready) return <div className="lock-screen"><span className="lbl">Mustering…</span></div>;

  // Join links work signed in or out.
  if (loc.pathname.startsWith('/join/')) {
    return <Routes><Route path="/join/:code" element={<Join />} /></Routes>;
  }
  if (!session) return <Login />;
  if (!unlocked) return <Lock onUnlock={() => setUnlocked(true)} />;
  if (!profile) return <div className="lock-screen"><span className="lbl">Loading your file…</span></div>;
  if (!profile.onboarded && profile.role === 'user') {
    return <Routes><Route path="*" element={<Onboarding />} /></Routes>;
  }

  const isSponsor = profile.role === 'sponsor';
  const withTabs = (el: ReactNode) => (<>{el}<TabBar /></>);

  return (
    <div className="app">
      <Routes>
        <Route path="/" element={withTabs(isSponsor ? <SponsorView /> : <Home />)} />
        <Route path="/sobrieties" element={withTabs(<Sobrieties />)} />
        <Route path="/check-in" element={withTabs(<CheckIn />)} />
        <Route path="/urge" element={withTabs(<UrgeLog />)} />
        <Route path="/milestones" element={withTabs(<Milestones />)} />
        <Route path="/savings" element={withTabs(<Savings />)} />
        <Route path="/workouts" element={withTabs(<Workouts />)} />
        <Route path="/calendar" element={withTabs(<Calendar />)} />
        <Route path="/reach-out" element={withTabs(<ReachOut />)} />
        <Route path="/sponsor" element={withTabs(<SponsorHub />)} />
        <Route path="/sponsor-view" element={withTabs(<SponsorView />)} />
        <Route path="/settings" element={withTabs(<Settings />)} />
        <Route path="/game-day" element={withTabs(<GameDay />)} />
        <Route path="/more" element={withTabs(<More />)} />
        <Route path="/onboarding" element={<Onboarding />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}
