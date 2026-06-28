import { Check, Ban, EyeOff, Flag, X, type LucideIcon } from "lucide-react";
import { cn } from "../lib/cn";

export type GovernanceAction =
  | "COMMIT"
  | "DROP"
  | "REDACT"
  | "FLAG"
  | "DECLINE";

type ActionStyle = {
  /** Tailwind classes for the pill (text + bg, theme-aware via .light). */
  pill: string;
  /** Left-border accent class for cards keyed on this action. */
  border: string;
  icon: LucideIcon;
};

/**
 * actionStyles - maps a governance action to its color treatment + icon.
 * Colors follow the Vault action-color map; light-mode overrides applied
 * via the `.light` arbitrary variants. Unknown actions fall back to slate.
 */
export const actionStyles: Record<GovernanceAction, ActionStyle> = {
  COMMIT: {
    pill: "text-[#34D399] bg-[rgba(16,185,129,0.14)] [.light_&]:text-[#047857] [.light_&]:bg-[#D1FAE5]",
    border: "border-l-[#34D399] [.light_&]:border-l-[#047857]",
    icon: Check,
  },
  REDACT: {
    pill: "text-[#FBBF24] bg-[rgba(251,191,36,0.14)] [.light_&]:text-[#B45309] [.light_&]:bg-[#FEF3C7]",
    border: "border-l-[#FBBF24] [.light_&]:border-l-[#B45309]",
    icon: EyeOff,
  },
  DROP: {
    pill: "text-danger bg-danger/[0.14] [.light_&]:text-[#B91C1C] [.light_&]:bg-[#FEE2E2]",
    border: "border-l-danger [.light_&]:border-l-[#B91C1C]",
    icon: Ban,
  },
  FLAG: {
    pill: "text-[#38BDF8] bg-[rgba(56,189,248,0.14)] [.light_&]:text-[#0369A1] [.light_&]:bg-[#E0F2FE]",
    border: "border-l-[#38BDF8] [.light_&]:border-l-[#0369A1]",
    icon: Flag,
  },
  DECLINE: {
    pill: "text-[#94A3B8] bg-[rgba(148,163,184,0.12)] [.light_&]:text-[#475569] [.light_&]:bg-[#E2E8F0]",
    border: "border-l-[#94A3B8] [.light_&]:border-l-[#475569]",
    icon: X,
  },
};

/** Normalize an arbitrary action string to a known GovernanceAction. */
export function normalizeAction(action: string): GovernanceAction {
  const key = action?.toUpperCase() as GovernanceAction;
  return key in actionStyles ? key : "DECLINE";
}

/** Border accent class for a card keyed on an action (any case). */
export function actionBorder(action: string): string {
  return actionStyles[normalizeAction(action)].border;
}

export type ActionPillProps = {
  action: string;
  className?: string;
  showIcon?: boolean;
};

export function ActionPill({ action, className, showIcon = true }: ActionPillProps) {
  const key = normalizeAction(action);
  const style = actionStyles[key];
  const Icon = style.icon;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium uppercase tracking-wide",
        style.pill,
        className
      )}
    >
      {showIcon && <Icon size={12} strokeWidth={2.5} aria-hidden="true" />}
      {key}
    </span>
  );
}
