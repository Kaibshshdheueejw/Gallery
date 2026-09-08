/**
 * NavIcons — the four capsule-tab icons, each with its OWN tap animation (§17).
 *
 *   For You  → the sparkle star blooms and throws two tiny glints
 *   Timeline → the clock hand sweeps 360° with a spring settle
 *   Albums   → the folder opens and two photo cards pop out, then settle
 *   Search   → the lens swells, the handle sways, a glint crosses the glass
 *
 * Restarting an animation = remounting the SVG subtree (keyed by a tap
 * counter), so CSS keyframes replay from frame 0. All animations run on
 * transform/opacity only → compositor-thread, no layout thrash.
 */

interface NavIconProps {
  size?: number;
  /** increments on every tap — remounts the art so the animation replays */
  pulse: number;
  active: boolean;
}

function Svg({ size, children }: { size: number; children: React.ReactNode }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  );
}

/* ── For You: sparkle bloom + glints ──────────────────────────────────── */
export function SparkleNavIcon({ size = 21, pulse }: NavIconProps) {
  return (
    <Svg size={size}>
      <g key={pulse} className="navanim-sparkle">
        <path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z" />
        <path className="sparkle-mini" d="M18.5 15.5l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z" />
        <circle className="glint g1" cx="6.5" cy="5" r="0.9" fill="currentColor" stroke="none" />
        <circle className="glint g2" cx="19.5" cy="6.5" r="0.7" fill="currentColor" stroke="none" />
        <circle className="glint g3" cx="5" cy="15.5" r="0.6" fill="currentColor" stroke="none" />
      </g>
    </Svg>
  );
}

/* ── Timeline: clock hand sweep with spring settle ────────────────────── */
export function ClockNavIcon({ size = 21, pulse }: NavIconProps) {
  return (
    <Svg size={size}>
      <circle cx="12" cy="12" r="8.5" />
      <g key={pulse} className="navanim-clock-hands">
        <path d="M12 7.5V12l3 2" />
      </g>
    </Svg>
  );
}

/* ── Albums: folder opens, photo cards pop out and settle ─────────────── */
export function AlbumsNavIcon({ size = 21, pulse }: NavIconProps) {
  return (
    <Svg size={size}>
      <g key={pulse}>
        {/* photo cards behind the folder, rising out */}
        <g className="navanim-photo p1">
          <rect x="8.6" y="4.2" width="6.4" height="5.2" rx="0.9" fill="currentColor" stroke="none" opacity="0.9" />
        </g>
        <g className="navanim-photo p2">
          <rect x="11.2" y="5" width="5.6" height="4.6" rx="0.9" fill="currentColor" stroke="none" opacity="0.55" />
        </g>
        {/* folder body */}
        <path className="navanim-folder" d="M3.5 6.5a2 2 0 0 1 2-2h4l2 2.5h7a2 2 0 0 1 2 2v8.5a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z" />
      </g>
    </Svg>
  );
}

/* ── Search: lens swell + handle sway + glass glint ───────────────────── */
export function SearchNavIcon({ size = 21, pulse }: NavIconProps) {
  return (
    <Svg size={size}>
      <g key={pulse}>
        <g className="navanim-lens">
          <circle cx="10.5" cy="10.5" r="6.5" />
          <path className="navanim-glint" d="M7.4 8.2a4.2 4.2 0 0 1 2.6-1.6" strokeWidth={1.4} />
        </g>
        <path className="navanim-handle" d="M15.5 15.5L21 21" />
      </g>
    </Svg>
  );
}
