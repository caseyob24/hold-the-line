export type Role = 'user' | 'sponsor';

export interface Profile {
  id: string;
  display_name: string;
  phone: string | null;
  role: Role;
  timezone: string;
  onboarded: boolean;
  quote_time: string;
  quote_authors: string[];
  checkin_reminder_time: string;
  notify_checkin: boolean;
  notify_milestones: boolean;
  notify_evening: boolean;
  share_checkins_default: boolean;
  risk_flagging: boolean;
  risk_keywords: string[];
  risk_after: string;
  leagues: string[];
  follow_teams: string[];
  channel_overrides: Record<string, string>;
  war_chest_label: string | null;
  war_chest_goal_usd: number | null;
}

export interface Sobriety {
  id: string;
  user_id: string;
  name: string;
  start_at: string;
  daily_cost_usd: number;
  daily_hours: number;
  is_primary: boolean;
  archived_at: string | null;
}

export interface CheckIn {
  id: string;
  date: string;
  pledged: boolean;
  mood: number | null;
  notes: string | null;
  shared_with_sponsor: boolean;
  created_at: string;
}

export interface Urge {
  id: string;
  sobriety_id: string | null;
  at: string;
  intensity: number;
  triggers: string[];
  coping: string[];
  notes: string | null;
}

export interface WorkoutSet {
  id?: string;
  position: number;
  exercise: string;
  sets: number | null;
  reps: number | null;
  weight: string | null;
}

export interface Workout {
  id: string;
  at: string;
  title: string;
  duration_min: number | null;
  notes: string | null;
  outlook_event_id: string | null;
  workout_sets?: WorkoutSet[];
}

export interface Milestone {
  id: string;
  sobriety_id: string;
  rank: string;
  days: number;
  streak_started_at: string;
  reached_at: string;
  witnessed_by: string | null;
  witness_note: string | null;
  witnessed_at: string | null;
}

export interface Permissions {
  streaks: boolean;
  checkins: boolean;
  urge_alerts: boolean;
  missed_checkin_alerts: boolean;
  witness: boolean;
  journal: boolean;
  risk_events: boolean;
}

export interface SponsorLink {
  id: string;
  user_id: string;
  sponsor_id: string | null;
  sponsor_name: string;
  sponsor_phone: string | null;
  status: 'pending' | 'active' | 'revoked';
  is_primary: boolean;
  invite_code: string;
  permissions: Permissions;
  invited_at: string;
  accepted_at: string | null;
}

export interface Message {
  id: string;
  link_id: string;
  from_id: string;
  body: string;
  created_at: string;
  read_at: string | null;
}

export interface Alert {
  id: string;
  link_id: string;
  kind: 'urge' | 'missed_checkin' | 'milestone_upcoming' | 'milestone_reached' | 'reach_out';
  payload: Record<string, unknown>;
  created_at: string;
  seen_at: string | null;
}

export interface BackupContact {
  id: string;
  name: string;
  phone: string;
  relation: string | null;
}

export interface CalendarEvent {
  id: string;
  subject: string;
  start: string; // ISO, local wall time from Graph (Prefer: outlook.timezone)
  end: string;
  location: string | null;
  isAllDay: boolean;
  fromApp: boolean;
  appKind: string | null;
}

export interface Game {
  league: string;
  id: string;
  state: 'pre' | 'in' | 'post';
  detail: string;
  start: string;
  home: { name: string; abbr: string; score: string | null; rank: number | null };
  away: { name: string; abbr: string; score: string | null; rank: number | null };
  networks: string[];
  tv: { label: string; channel: string | null; streaming: boolean } | null;
}

export interface SponseeDashboard {
  link_id: string;
  user_id: string;
  name: string;
  phone: string | null;
  permissions: Permissions;
  sobrieties: { id: string; name: string; start_at: string; is_primary: boolean }[] | null;
  check_ins: { date: string; pledged: boolean; mood: number | null; created_at: string; notes: string | null }[] | null;
  milestones: { id: string; rank: string; days: number; reached_at: string; witnessed: boolean; sobriety_id: string }[] | null;
  risk_events: { title: string; start_at: string }[] | null;
}
