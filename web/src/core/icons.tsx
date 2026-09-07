import type { JSX } from 'react';

/** Hand-drawn 24px stroke icon set (Material-ish). */
const P: Record<string, JSX.Element> = {
  sparkle: (<><path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z" /><path d="M18.5 15.5l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z" /></>),
  clock: (<><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></>),
  folder: (<path d="M3.5 6.5a2 2 0 0 1 2-2h4l2 2.5h7a2 2 0 0 1 2 2v8.5a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z" />),
  search: (<><circle cx="10.5" cy="10.5" r="6.5" /><path d="M15.5 15.5L21 21" /></>),
  settings: (<><circle cx="12" cy="12" r="3.2" /><path d="M12 2.8l1.2 2.6 2.8-.6 1 2.6 2.7 1-.6 2.8 2 2-2 2 .6 2.8-2.7 1-1 2.6-2.8-.6L12 21.2l-1.2-2.6-2.8.6-1-2.6-2.7-1 .6-2.8-2-2 2-2-.6-2.8 2.7-1 1-2.6 2.8.6z" /></>),
  share: (<><circle cx="6" cy="12" r="2.6" /><circle cx="17.5" cy="5.5" r="2.6" /><circle cx="17.5" cy="18.5" r="2.6" /><path d="M8.4 10.7l6.8-4M8.4 13.3l6.8 4" /></>),
  edit: (<><path d="M4 20h4l11-11a2.4 2.4 0 0 0-3.4-3.4L4.6 16.6z" /><path d="M13.5 6.5l3.4 3.4" /></>),
  trash: (<><path d="M4.5 6.5h15M9.5 6.5V4.8a1.3 1.3 0 0 1 1.3-1.3h2.4a1.3 1.3 0 0 1 1.3 1.3v1.7" /><path d="M6.5 6.5l.9 12.2a2 2 0 0 0 2 1.8h5.2a2 2 0 0 0 2-1.8l.9-12.2" /><path d="M10 10.5v6M14 10.5v6" /></>),
  heart: (<path d="M12 20.5s-7.5-4.7-7.5-10A4.4 4.4 0 0 1 12 7.6a4.4 4.4 0 0 1 7.5 2.9c0 5.3-7.5 10-7.5 10z" />),
  info: (<><circle cx="12" cy="12" r="8.5" /><path d="M12 11v5.5M12 7.6v.2" /></>),
  lock: (<><rect x="4.8" y="10.5" width="14.4" height="9.5" rx="2.2" /><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" /></>),
  lockOpen: (<><rect x="4.8" y="10.5" width="14.4" height="9.5" rx="2.2" /><path d="M8 10.5V8a4 4 0 0 1 7.6-1.7" /></>),
  back: (<path d="M19 12H5.5M11 5.5L4.5 12l6.5 6.5" />),
  close: (<path d="M6 6l12 12M18 6L6 18" />),
  more: (<><circle cx="12" cy="5.5" r="1.4" /><circle cx="12" cy="12" r="1.4" /><circle cx="12" cy="18.5" r="1.4" /></>),
  check: (<path d="M4.5 12.5l5 5 10-11" />),
  chevronRight: (<path d="M9 5l7 7-7 7" />),
  chevronDown: (<path d="M5 9l7 7 7-7" />),
  plus: (<path d="M12 5v14M5 12h14" />),
  grid: (<><rect x="3.5" y="3.5" width="7" height="7" rx="1.5" /><rect x="13.5" y="3.5" width="7" height="7" rx="1.5" /><rect x="3.5" y="13.5" width="7" height="7" rx="1.5" /><rect x="13.5" y="13.5" width="7" height="7" rx="1.5" /></>),
  play: (<path d="M8 5.2v13.6L19 12z" />),
  pause: (<><path d="M9 5.5v13M15 5.5v13" /></>),
  volume: (<><path d="M4 9.5v5h3.5L12 19V5L7.5 9.5z" /><path d="M15.5 9a4.5 4.5 0 0 1 0 6M18 6.5a8 8 0 0 1 0 11" /></>),
  volumeOff: (<><path d="M4 9.5v5h3.5L12 19V5L7.5 9.5z" /><path d="M16 9.5l5 5M21 9.5l-5 5" /></>),
  speed: (<><path d="M4 14a8 8 0 0 1 16 0" /><path d="M12 14l4-4" /></>),
  scissors: (<><circle cx="6" cy="6.5" r="2.5" /><circle cx="6" cy="17.5" r="2.5" /><path d="M8.2 7.8L20 17M8.2 16.2L20 7" /></>),
  crop: (<><path d="M6.5 2.5v15h15" /><path d="M2.5 6.5h15v15" /></>),
  rotate: (<><path d="M20 12a8 8 0 1 1-2.6-5.9" /><path d="M20 3.5V7h-3.5" /></>),
  wand: (<><path d="M4 20L15 9" /><path d="M14.5 4.5l1 2.4 2.4 1-2.4 1-1 2.4-1-2.4-2.4-1 2.4-1z" /><path d="M19.5 12.5l.6 1.5 1.5.6-1.5.6-.6 1.5-.6-1.5-1.5-.6 1.5-.6z" /></>),
  brush: (<><path d="M14 4l6 6-8.5 8.5a3 3 0 0 1-4.2 0l-1.8-1.8a3 3 0 0 1 0-4.2z" /><path d="M6 15l3 3" /></>),
  pen: (<path d="M3.5 20.5l1-4L16 5a2.1 2.1 0 0 1 3 3L7.5 19.5z" />),
  text: (<path d="M5 6.5V4.5h14v2M12 4.5v15M9 19.5h6" />),
  shapes: (<><circle cx="8" cy="8" r="4.5" /><rect x="12.5" y="12.5" width="8" height="8" rx="1.5" /></>),
  eraser: (<><path d="M8 20h12" /><path d="M13.5 4.5l6 6-8 8H6l-2.5-2.5a2 2 0 0 1 0-2.8z" /><path d="M9 9l6 6" /></>),
  download: (<><path d="M12 3.5v11M7.5 10L12 14.5 16.5 10" /><path d="M4.5 17v2a1.5 1.5 0 0 0 1.5 1.5h12a1.5 1.5 0 0 0 1.5-1.5v-2" /></>),
  cloud: (<path d="M7 18.5a4.5 4.5 0 0 1-.4-9A6 6 0 0 1 18.3 11a3.8 3.8 0 0 1-.8 7.5z" />),
  cloudOff: (<><path d="M7 18.5a4.5 4.5 0 0 1-.4-9 6 6 0 0 1 3-3.6M14 6.2A6 6 0 0 1 18.3 11a3.8 3.8 0 0 1-.8 7.5H9" /><path d="M3.5 3.5l17 17" /></>),
  person: (<><circle cx="12" cy="8" r="3.8" /><path d="M4.5 20a7.5 7.5 0 0 1 15 0" /></>),
  people: (<><circle cx="9" cy="8.5" r="3.3" /><path d="M3 19.5a6 6 0 0 1 12 0" /><path d="M15.5 5.6a3.3 3.3 0 0 1 0 5.8M17 13.6a6 6 0 0 1 4 5.9" /></>),
  image: (<><rect x="3.5" y="4.5" width="17" height="15" rx="2.5" /><circle cx="9" cy="10" r="1.8" /><path d="M4.5 17l5-5 4 4 3-3 4 4" /></>),
  video: (<><rect x="3" y="6" width="13" height="12" rx="2.5" /><path d="M16 10.5l5-3v9l-5-3z" /></>),
  doc: (<><path d="M6 3.5h8l4 4v13H6z" /><path d="M14 3.5v4h4M9 12h6M9 15.5h6" /></>),
  mapPin: (<><path d="M12 21s7-6.1 7-11a7 7 0 1 0-14 0c0 4.9 7 11 7 11z" /><circle cx="12" cy="10" r="2.6" /></>),
  calendar: (<><rect x="3.5" y="5" width="17" height="15.5" rx="2.5" /><path d="M3.5 9.5h17M8 3v4M16 3v4" /></>),
  camera: (<><path d="M3.5 8.5a2 2 0 0 1 2-2h2l1.5-2.5h6L16.5 6.5h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z" /><circle cx="12" cy="13" r="3.6" /></>),
  sun: (<><circle cx="12" cy="12" r="4" /><path d="M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M5 5l1.8 1.8M17.2 17.2L19 19M19 5l-1.8 1.8M6.8 17.2L5 19" /></>),
  moon: (<path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z" />),
  monitor: (<><rect x="3" y="4.5" width="18" height="12" rx="2" /><path d="M9 20.5h6M12 16.5v4" /></>),
  palette: (<><path d="M12 3.5a8.5 8.5 0 1 0 0 17c1.7 0 2.2-1 1.6-2.1-.8-1.5.2-3 1.9-3h1.6a3.4 3.4 0 0 0 3.4-3.4A8.6 8.6 0 0 0 12 3.5z" /><circle cx="8" cy="9" r="1.2" /><circle cx="12.5" cy="7.5" r="1.2" /><circle cx="7.5" cy="13.5" r="1.2" /></>),
  globe: (<><circle cx="12" cy="12" r="8.5" /><path d="M3.5 12h17M12 3.5c2.5 2.4 3.8 5.3 3.8 8.5s-1.3 6.1-3.8 8.5c-2.5-2.4-3.8-5.3-3.8-8.5S9.5 5.9 12 3.5z" /></>),
  shield: (<path d="M12 3l7.5 3v6c0 4.6-3.2 7.8-7.5 9-4.3-1.2-7.5-4.4-7.5-9V6z" />),
  broom: (<><path d="M14 3l-4 7" /><path d="M10 10c-3 0-6 3-6.5 8 5 .5 9-1 10.5-4" /><path d="M10 10l4 4M7.5 13l3 3" /></>),
  zoomIn: (<><circle cx="10.5" cy="10.5" r="6.5" /><path d="M15.5 15.5L21 21M10.5 8v5M8 10.5h5" /></>),
  zoomOut: (<><circle cx="10.5" cy="10.5" r="6.5" /><path d="M15.5 15.5L21 21M8 10.5h5" /></>),
  drag: (<><circle cx="9" cy="6" r="1.3" /><circle cx="15" cy="6" r="1.3" /><circle cx="9" cy="12" r="1.3" /><circle cx="15" cy="12" r="1.3" /><circle cx="9" cy="18" r="1.3" /><circle cx="15" cy="18" r="1.3" /></>),
  copy: (<><rect x="8.5" y="8.5" width="12" height="12" rx="2" /><path d="M15.5 5.5v-1a1 1 0 0 0-1-1h-10a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h1" /></>),
  eye: (<><path d="M2.5 12S6 5.8 12 5.8 21.5 12 21.5 12 18 18.2 12 18.2 2.5 12 2.5 12z" /><circle cx="12" cy="12" r="3" /></>),
  fingerprint: (<><path d="M12 11a2.5 2.5 0 0 0-2.5 2.5c0 2 .3 4-.5 6" /><path d="M12 11a2.5 2.5 0 0 1 2.5 2.5c0 1.5.1 3 .4 4.5" /><path d="M12 7.5A6 6 0 0 0 6 13.5c0 1.6-.1 3.2-.6 4.7" /><path d="M12 7.5a6 6 0 0 1 6 6c0 1 .1 2 .2 3" /><path d="M12 4a9.5 9.5 0 0 0-9.3 7.5M12 4a9.5 9.5 0 0 1 9.3 7.5" /></>),
  restore: (<><path d="M4 12a8 8 0 1 0 2.6-5.9" /><path d="M4 3.5V7h3.5" /></>),
  storage: (<><ellipse cx="12" cy="6" rx="8" ry="3" /><path d="M4 6v12c0 1.7 3.6 3 8 3s8-1.3 8-3V6" /><path d="M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3" /></>),
  tag: (<><path d="M3.5 11V4.5a1 1 0 0 1 1-1H11l9.5 9.5-7.5 7.5z" /><circle cx="7.8" cy="7.8" r="1.4" /></>),
  scanText: (<><path d="M4 8V5.5A1.5 1.5 0 0 1 5.5 4H8M16 4h2.5A1.5 1.5 0 0 1 20 5.5V8M20 16v2.5a1.5 1.5 0 0 1-1.5 1.5H16M8 20H5.5A1.5 1.5 0 0 1 4 18.5V16" /><path d="M8 9.5h8M8 13h8M8 16.5h4" /></>),
  scanFace: (<><path d="M4 8V5.5A1.5 1.5 0 0 1 5.5 4H8M16 4h2.5A1.5 1.5 0 0 1 20 5.5V8M20 16v2.5a1.5 1.5 0 0 1-1.5 1.5H16M8 20H5.5A1.5 1.5 0 0 1 4 18.5V16" /><circle cx="9.5" cy="10.5" r=".9" /><circle cx="14.5" cy="10.5" r=".9" /><path d="M9.5 14.5c.7.8 1.6 1.2 2.5 1.2s1.8-.4 2.5-1.2" /></>),
  fullscreen: (<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />),
  arrowUp: (<path d="M12 19V5M6 11l6-6 6 6" />),
  arrowDown: (<path d="M12 5v14M6 13l6 6 6-6" />),
  list: (<><path d="M8 6h12M8 12h12M8 18h12" /><circle cx="4.5" cy="6" r="1" /><circle cx="4.5" cy="12" r="1" /><circle cx="4.5" cy="18" r="1" /></>),
  memories: (<><rect x="3.5" y="5" width="17" height="14" rx="2.5" /><path d="M3.5 9h17M7 5v4M17 5v4" /><circle cx="12" cy="14" r="2.6" /></>),
  bluetooth: (<path d="M7 7.5l10 9-5 4v-17l5 4-10 9" />),
  message: (<path d="M4 5.5h16v10.5H9l-5 4z" />),
  send: (<path d="M3.5 11.5L20.5 4l-6 16.5-3-7z" />),
  film: (<><rect x="3.5" y="4.5" width="17" height="15" rx="2" /><path d="M7.5 4.5v15M16.5 4.5v15M3.5 9.5h4M3.5 14.5h4M16.5 9.5h4M16.5 14.5h4" /></>),
  pie: (<><path d="M12 3.5a8.5 8.5 0 1 1-8.5 8.5H12z" /><path d="M12 3.5V12h8.5A8.5 8.5 0 0 0 12 3.5z" /></>),
  location: (<><circle cx="12" cy="12" r="3" /><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M18.7 5.3l-2.1 2.1M7.4 16.6l-2.1 2.1" /></>),
  flash: (<path d="M13 2.5L5 13.5h5.5L10 21.5l8-11h-5.5z" />),
  keypad: (<><circle cx="7" cy="6" r="1.6" /><circle cx="12" cy="6" r="1.6" /><circle cx="17" cy="6" r="1.6" /><circle cx="7" cy="12" r="1.6" /><circle cx="12" cy="12" r="1.6" /><circle cx="17" cy="12" r="1.6" /><circle cx="7" cy="18" r="1.6" /><circle cx="12" cy="18" r="1.6" /><circle cx="17" cy="18" r="1.6" /></>),
  history: (<><path d="M4 12a8 8 0 1 0 3-6.2" /><path d="M4 4v4h4" /><path d="M12 8v4.5l3 2" /></>),
  wifi: (<><path d="M3 9a14 14 0 0 1 18 0M6.2 12.4a9.5 9.5 0 0 1 11.6 0M9.4 15.8a5 5 0 0 1 5.2 0" /><circle cx="12" cy="19" r="1.2" /></>),
  star: (<path d="M12 3.8l2.5 5.2 5.7.8-4.1 4 1 5.7-5.1-2.7-5.1 2.7 1-5.7-4.1-4 5.7-.8z" />),
  layers: (<><path d="M12 3.5l9 5-9 5-9-5z" /><path d="M3.5 13l8.5 4.7L20.5 13" /></>),
};

export type IconName = keyof typeof P;

export function Icon({ name, size = 22, filled = false, strokeWidth = 1.8, className }: {
  name: string;
  size?: number;
  filled?: boolean;
  strokeWidth?: number;
  className?: string;
}) {
  const body = P[name] ?? P.image;
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth={filled ? 0.6 : strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {body}
    </svg>
  );
}
