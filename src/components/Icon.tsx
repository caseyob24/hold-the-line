const PATHS: Record<string, JSX.Element> = {
  home: <path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />,
  calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /></>,
  calendarAdd: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4M12 13v5M9.5 15.5h5" /></>,
  plusCircle: <><circle cx="12" cy="12" r="9" /><path d="M12 8v8M8 12h8" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  users: <><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c.8-3.6 3.4-5.5 6.5-5.5s5.7 1.9 6.5 5.5M16 4.5a3.5 3.5 0 0 1 0 7M18 14.8c1.8.7 3 2.4 3.5 5.2" /></>,
  more: <><circle cx="5" cy="12" r="1.5" /><circle cx="12" cy="12" r="1.5" /><circle cx="19" cy="12" r="1.5" /></>,
  bell: <><path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z" /><path d="M10 20.5a2 2 0 0 0 4 0" /></>,
  check: <path d="M5 12l4.5 4.5L19 7" />,
  flame: <path d="M12 3c1 4 5 5 5 10a5 5 0 0 1-10 0c0-2 1-3.5 2-4.5.5 2 1.5 3 2.5 3 0-3-1-5.5.5-8.5z" />,
  dumbbell: <path d="M3 9v6M6 6v12M18 6v12M21 9v6M6 12h12" />,
  phone: <path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2" />,
  chat: <path d="M4 5h16v11H9l-5 4z" />,
  pin: <><path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z" /><circle cx="12" cy="9.5" r="2.5" /></>,
  tv: <rect x="3" y="6" width="18" height="12" rx="2" />,
  chevrons: <path d="M5 9l7-4 7 4M5 13l7-4 7 4M5 17l7-4 7 4" />,
  medal: <><circle cx="12" cy="14" r="6" /><path d="M8 3l4 5 4-5" /></>,
  coin: <><circle cx="12" cy="12" r="9" /><path d="M14.5 9.5c-.5-1-1.5-1.5-2.5-1.5-1.5 0-2.5.8-2.5 2s1 1.7 2.5 2 2.5.8 2.5 2-1 2-2.5 2c-1.2 0-2.2-.5-2.7-1.5M12 6.5V8M12 16v1.5" /></>,
  gear: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></>,
  list: <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />,
  trophy: <path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0zM7 6H4a3 3 0 0 0 3 4M17 6h3a3 3 0 0 1-3 4" />,
  back: <path d="M15 18l-6-6 6-6" />,
  trash: <path d="M4 7h16M10 11v6M14 11v6M5 7l1 13h12l1-13M9 7V4h6v3" />,
  share: <><path d="M12 3v12M8 7l4-4 4 4" /><path d="M5 12v7a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-7" /></>,
  lock: <><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></>,
  x: <path d="M6 6l12 12M18 6L6 18" />,
};

export function Icon({ name, size = 20, stroke = 'currentColor', width = 1.8, title }: {
  name: keyof typeof PATHS | string;
  size?: number;
  stroke?: string;
  width?: number;
  title?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={stroke}
      strokeWidth={width}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={title ? undefined : true}
      role={title ? 'img' : undefined}
      aria-label={title}
    >
      {PATHS[name] ?? null}
    </svg>
  );
}

/** Rank insignia drawn per rank key, matching the milestones mockup. */
export function RankMark({ rank, size = 40 }: { rank: string; size?: number }) {
  const shapes: Record<string, JSX.Element> = {
    Recruit: <circle cx="12" cy="12" r="7" />,
    Private: <path d="M5 13l7-4 7 4" />,
    PFC: <path d="M5 11l7-4 7 4M5 15l7-4 7 4" />,
    Corporal: <path d="M5 9l7-4 7 4M5 13l7-4 7 4M5 17l7-4 7 4" />,
    Sergeant: <path d="M5 7l7-4 7 4M5 11l7-4 7 4M5 15l7-4 7 4M7 19h10" />,
    Lieutenant: <rect x="9" y="5" width="6" height="14" rx="1" />,
    Captain: <><rect x="5" y="5" width="5" height="14" rx="1" /><rect x="14" y="5" width="5" height="14" rx="1" /></>,
    Colonel: <path d="M12 4c3 3 5 4 8 4-1 3-4 4-8 4s-7-1-8-4c3 0 5-1 8-4zM12 12v8" />,
    General: <path d="M12 3l2.6 5.6 6 .7-4.5 4.1 1.2 6L12 16.4 6.7 19.4l1.2-6L3.4 9.3l6-.7z" />,
  };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {shapes[rank] ?? shapes.Recruit}
    </svg>
  );
}
