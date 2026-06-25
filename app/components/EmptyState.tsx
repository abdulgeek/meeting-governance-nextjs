import { type ReactNode } from "react";
import { cn } from "../lib/cn";

export type EmptyStateProps = {
  title?: string;
  description?: ReactNode;
  icon?: ReactNode;
  action?: ReactNode;
  className?: string;
};

export function EmptyState({
  title,
  description,
  icon,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border bg-surface/40 px-6 py-10 text-center",
        className
      )}
    >
      {icon && <div className="text-fg-subtle">{icon}</div>}
      {title && <p className="text-sm font-medium text-fg">{title}</p>}
      {description && (
        <p className="max-w-sm text-[13px] text-fg-subtle">{description}</p>
      )}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
