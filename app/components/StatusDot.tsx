import { cn } from "../lib/cn";

export type StatusTone = "brand" | "neutral" | "danger" | "accent" | "muted";

export type StatusDotProps = {
  tone?: StatusTone;
  pulse?: boolean;
  className?: string;
  label?: string;
};

const tones: Record<StatusTone, string> = {
  brand: "bg-brand",
  neutral: "bg-fg-muted",
  danger: "bg-danger",
  accent: "bg-accent",
  muted: "bg-fg-subtle",
};

export function StatusDot({
  tone = "neutral",
  pulse = false,
  className,
  label,
}: StatusDotProps) {
  return (
    <span
      role={label ? "status" : undefined}
      aria-label={label}
      className={cn("relative inline-flex h-2 w-2", className)}
    >
      {pulse && (
        <span
          className={cn(
            "absolute inline-flex h-full w-full animate-ping rounded-full opacity-60",
            tones[tone]
          )}
          aria-hidden="true"
        />
      )}
      <span
        className={cn("relative inline-flex h-2 w-2 rounded-full", tones[tone])}
        aria-hidden="true"
      />
    </span>
  );
}
