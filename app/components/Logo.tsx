import { cn } from "../lib/cn";

export type LogoProps = {
  className?: string;
  /** Hide the wordmark, show just the mark. */
  markOnly?: boolean;
  size?: number;
};

export function Logo({ className, markOnly = false, size = 28 }: LogoProps) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <LogoMark size={size} />
      {!markOnly && (
        <span className="text-[15px] font-semibold tracking-tight text-fg">
          Governance
        </span>
      )}
    </span>
  );
}

export function LogoMark({ size = 28 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 28 28"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      {/* Shield outline */}
      <path
        d="M14 2.5 24 6v7c0 6.2-4.1 10.4-10 12.5C8.1 23.4 4 19.2 4 13V6l10-3.5Z"
        fill="var(--brand)"
        fillOpacity="0.12"
        stroke="var(--brand)"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      {/* Waveform / equalizer bars */}
      <g
        stroke="var(--brand)"
        strokeWidth="1.8"
        strokeLinecap="round"
      >
        <line x1="9.5" y1="13" x2="9.5" y2="16" />
        <line x1="12" y1="10.5" x2="12" y2="18.5" stroke="var(--accent)" />
        <line x1="14.5" y1="12" x2="14.5" y2="17" />
        <line x1="17" y1="9.5" x2="17" y2="19.5" stroke="var(--accent)" />
        <line x1="19.5" y1="13" x2="19.5" y2="16" opacity="0.7" />
      </g>
    </svg>
  );
}
