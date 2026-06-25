import { cn } from "../lib/cn";

export type HeroProps = {
  className?: string;
};

/**
 * Hero brand visual — concentric emerald/cyan arcs forming a shield with an
 * equalizer/waveform motif. Flat, layered opacity, and the single allowed
 * soft radial glow. Scales responsively to its container width.
 */
export function Hero({ className }: HeroProps) {
  return (
    <div
      className={cn("relative w-full select-none", className)}
      aria-hidden="true"
    >
      <svg
        viewBox="0 0 400 280"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="h-auto w-full"
        role="img"
        aria-label="Governance brand mark"
      >
        <defs>
          <radialGradient id="hero-glow" cx="50%" cy="42%" r="55%">
            <stop offset="0%" stopColor="var(--brand)" stopOpacity="0.30" />
            <stop offset="55%" stopColor="var(--brand)" stopOpacity="0.06" />
            <stop offset="100%" stopColor="var(--brand)" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* The one allowed soft glow */}
        <rect x="0" y="0" width="400" height="280" fill="url(#hero-glow)" />

        {/* Concentric shield arcs */}
        <g
          transform="translate(200 132)"
          fill="none"
          strokeLinecap="round"
        >
          {[58, 80, 102, 124].map((r, i) => (
            <path
              key={r}
              d={`M ${-r} ${-r * 0.55} A ${r} ${r} 0 0 1 ${r} ${-r * 0.55}`}
              stroke={i % 2 === 0 ? "var(--brand)" : "var(--accent)"}
              strokeWidth={2}
              strokeOpacity={0.85 - i * 0.16}
            />
          ))}
          {/* Shield base — converging V */}
          <path
            d="M -124 -68 L 0 96 L 124 -68"
            stroke="var(--brand)"
            strokeOpacity="0.22"
            strokeWidth="2"
          />
          <path
            d="M -80 -44 L 0 64 L 80 -44"
            stroke="var(--accent)"
            strokeOpacity="0.28"
            strokeWidth="2"
          />
        </g>

        {/* Equalizer / waveform bars across center */}
        <g transform="translate(200 132)" strokeLinecap="round" strokeWidth="4">
          {[
            { x: -44, h: 18, c: "var(--brand)", o: 0.5 },
            { x: -28, h: 34, c: "var(--brand)", o: 0.75 },
            { x: -12, h: 52, c: "var(--accent)", o: 0.95 },
            { x: 4, h: 38, c: "var(--brand)", o: 0.8 },
            { x: 20, h: 56, c: "var(--accent)", o: 0.95 },
            { x: 36, h: 24, c: "var(--brand)", o: 0.6 },
          ].map((b) => (
            <line
              key={b.x}
              x1={b.x}
              y1={-b.h / 2}
              x2={b.x}
              y2={b.h / 2}
              stroke={b.c}
              strokeOpacity={b.o}
            />
          ))}
        </g>
      </svg>
    </div>
  );
}
