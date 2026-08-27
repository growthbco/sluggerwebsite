// Shared line-icon set for the admin (replaces emoji). Pure SVG, no hooks, so
// it renders in both server and client components. 24x24, currentColor stroke.
import type { CSSProperties } from "react";

const PATHS: Record<string, React.ReactNode> = {
  grid: (<><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></>),
  chat: <path d="M4 5h16v11H8l-4 3z" />,
  users: (<><circle cx="9" cy="7" r="3" /><path d="M2 21v-2a5 5 0 015-5h4a5 5 0 015 5v2M16 3a3 3 0 010 6M22 21v-2a5 5 0 00-3-4.5" /></>),
  pen: (<><path d="M12 19l7-7 3 3-7 7-3-3z" /><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18z" /><path d="M2 2l7.6 7.6" /><circle cx="11" cy="11" r="1.5" /></>),
  box: (<><path d="M21 8l-9-5-9 5 9 5 9-5z" /><path d="M3 8v8l9 5 9-5V8M12 13v8" /></>),
  flask: (<><path d="M9 3h6M10 3v6l-5 9a2 2 0 002 3h10a2 2 0 002-3l-5-9V3" /><path d="M7.5 14h9" /></>),
  store: (<><path d="M3 9l1-4h16l1 4M4 9v11h16V9" /><path d="M3 9a3 3 0 006 0 3 3 0 006 0 3 3 0 006 0" /></>),
  cart: (<><circle cx="9" cy="20" r="1.5" /><circle cx="18" cy="20" r="1.5" /><path d="M2 3h3l2.5 13h11l2-8H6" /></>),
  truck: (<><path d="M3 6h11v9H3zM14 9h4l3 3v3h-7z" /><circle cx="7" cy="18" r="1.6" /><circle cx="17" cy="18" r="1.6" /></>),
  invoice: <path d="M5 3v18l3-2 2 2 2-2 2 2 2-2 3 2V3l-3 2-2-2-2 2-2-2-2 2z" />,
  receipt: (<><path d="M6 3v18l2-1.5L10 21l2-1.5L14 21l2-1.5L18 21V3l-2 1.5L14 3l-2 1.5L10 3 8 4.5z" /><path d="M9 8h6M9 12h6" /></>),
  clock: (<><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>),
  swap: (<><path d="M7 10l-4 4 4 4M3 14h13M17 14l4-4-4-4M21 10H8" /></>),
  sparkle: <path d="M12 3l2 5 5 2-5 2-2 5-2-5-5-2 5-2z" />,
  gear: (<><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1" /></>),
  card: (<><rect x="2" y="5" width="20" height="14" rx="2" /><path d="M2 10h20" /></>),
  arrowUpRight: <path d="M7 17L17 7M9 7h8v8" />,
  phone: <path d="M5 3h4l2 5-2.5 1.5a11 11 0 005 5L15 13l5 2v4a2 2 0 01-2 2A16 16 0 013 5a2 2 0 012-2z" />,
  check: <path d="M4 12l5 5L20 6" />,
  warn: (<><path d="M12 3l9 16H3z" /><path d="M12 10v4M12 17.5v.01" /></>),
};

export function AdminIcon({ name, className = "", style }: { name: string; className?: string; style?: CSSProperties }) {
  return (
    <svg viewBox="0 0 24 24" className={className} style={style} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {PATHS[name] ?? PATHS.grid}
    </svg>
  );
}
