import { type HTMLAttributes } from "react";
import { cn } from "../lib/cn";

export type BadgeVariant =
  | "neutral"
  | "brand"
  | "accent"
  | "violet"
  | "danger";

export type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  variant?: BadgeVariant;
};

const variants: Record<BadgeVariant, string> = {
  neutral: "bg-elevated text-fg-muted border border-border",
  brand: "bg-[rgba(16,185,129,0.14)] text-brand border border-transparent",
  accent: "bg-[rgba(34,211,238,0.14)] text-accent border border-transparent",
  violet: "bg-[rgba(167,139,250,0.14)] text-violet border border-transparent",
  danger: "bg-danger/[0.14] text-danger border border-transparent",
};

export function Badge({
  variant = "neutral",
  className,
  children,
  ...props
}: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium leading-5",
        variants[variant],
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}
