import { cn } from "../lib/cn";

export type SkeletonProps = {
  /** Width of the bar. Tailwind class string defaults to full width. */
  className?: string;
  /** Render as a circle (e.g. an avatar placeholder). */
  circle?: boolean;
};

/**
 * Skeleton - an animated shimmer placeholder bar.
 *
 * Tokenized: base fill uses `bg-elevated` with a `border-border` outline so it
 * reads as a loading surface in both themes. The shimmer is a moving gradient
 * highlight; it honours `prefers-reduced-motion` (the global media query in
 * globals.css zeroes animation duration, and `motion-reduce:animate-none`
 * makes the bar a calm static placeholder rather than a frozen gradient).
 */
export function Skeleton({ className, circle }: SkeletonProps) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "block animate-shimmer bg-elevated [background-image:linear-gradient(90deg,transparent_0%,var(--border-strong)_50%,transparent_100%)] [background-size:200%_100%] motion-reduce:animate-none",
        circle ? "rounded-full" : "rounded-md",
        className
      )}
    />
  );
}

/**
 * SkeletonRow - a card-shaped pending row matching the live/saved decision
 * cards: a meta line (speaker + status) above a wider text bar. Used to stand
 * in for an utterance that is still being transcribed & governed.
 */
export function SkeletonRow({
  label,
  className,
}: {
  /** Status text shown next to the shimmer, e.g. "you · transcribing…". */
  label: string;
  className?: string;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={label}
      className={cn(
        "rounded-2xl border border-l-4 border-border bg-surface p-4",
        className
      )}
    >
      <div className="mb-2.5 flex items-center gap-2 text-xs text-fg-subtle">
        <Skeleton circle className="h-2 w-2" />
        <span className="truncate font-medium text-fg-muted">{label}</span>
      </div>
      <div className="flex flex-col gap-2">
        <Skeleton className="h-3.5 w-full max-w-[28rem]" />
        <Skeleton className="h-3.5 w-2/3 max-w-[18rem]" />
      </div>
    </div>
  );
}
