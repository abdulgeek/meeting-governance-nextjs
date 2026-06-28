"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Bell,
  CircleAlert,
  CircleCheck,
  Info,
  TriangleAlert,
  X,
  type LucideIcon,
} from "lucide-react";
import { cn } from "../lib/cn";

export type ToastVariant = "success" | "error" | "warning" | "info" | "neutral";

export type ToastOptions = {
  title: string;
  description?: string;
  variant?: ToastVariant;
};

type ToastRecord = ToastOptions & { id: number };

type ToastFn = ((opts: ToastOptions) => void) & {
  success: (title: string, description?: string) => void;
  error: (title: string, description?: string) => void;
  info: (title: string, description?: string) => void;
  warning: (title: string, description?: string) => void;
};

type ToastContextValue = {
  toasts: ToastRecord[];
  push: (opts: ToastOptions) => void;
  dismiss: (id: number) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

const MAX_VISIBLE = 4;
const AUTO_DISMISS_MS = 3500;

// Variant treatment - mirrors the ActionPill / Vault action-color map.
// success=emerald/brand, error=danger/red, warning=amber, info=cyan/accent,
// neutral=fg-muted. Each has a leading icon + a left accent stripe.
const variantStyles: Record<
  ToastVariant,
  { icon: LucideIcon; iconColor: string; stripe: string }
> = {
  success: {
    icon: CircleCheck,
    iconColor: "text-[#34D399] [.light_&]:text-[#047857]",
    stripe: "bg-[#34D399] [.light_&]:bg-[#047857]",
  },
  error: {
    icon: CircleAlert,
    iconColor: "text-danger [.light_&]:text-[#B91C1C]",
    stripe: "bg-danger [.light_&]:bg-[#B91C1C]",
  },
  warning: {
    icon: TriangleAlert,
    iconColor: "text-[#FBBF24] [.light_&]:text-[#B45309]",
    stripe: "bg-[#FBBF24] [.light_&]:bg-[#B45309]",
  },
  info: {
    icon: Info,
    iconColor: "text-[#38BDF8] [.light_&]:text-[#0369A1]",
    stripe: "bg-[#38BDF8] [.light_&]:bg-[#0369A1]",
  },
  neutral: {
    icon: Bell,
    iconColor: "text-fg-muted",
    stripe: "bg-fg-muted",
  },
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastRecord[]>([]);
  const nextId = useRef(0);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const push = useCallback((opts: ToastOptions) => {
    setToasts((prev) => {
      const next: ToastRecord = { ...opts, id: nextId.current++ };
      const stack = [...prev, next];
      // Keep at most MAX_VISIBLE - drop the oldest.
      return stack.slice(-MAX_VISIBLE);
    });
  }, []);

  const value = useMemo<ToastContextValue>(
    () => ({ toasts, push, dismiss }),
    [toasts, push, dismiss]
  );

  return (
    <ToastContext.Provider value={value}>{children}</ToastContext.Provider>
  );
}

export function useToast(): ToastFn {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  const { push } = ctx;

  return useMemo<ToastFn>(() => {
    const fn = ((opts: ToastOptions) => push(opts)) as ToastFn;
    fn.success = (title, description) =>
      push({ title, description, variant: "success" });
    fn.error = (title, description) =>
      push({ title, description, variant: "error" });
    fn.info = (title, description) =>
      push({ title, description, variant: "info" });
    fn.warning = (title, description) =>
      push({ title, description, variant: "warning" });
    return fn;
  }, [push]);
}

export function Toaster() {
  const ctx = useContext(ToastContext);
  if (!ctx) return null;
  const { toasts, dismiss } = ctx;

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed bottom-4 right-4 z-50 flex w-[min(22rem,calc(100vw-2rem))] flex-col gap-2.5"
    >
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} onDismiss={() => dismiss(t.id)} />
      ))}
    </div>
  );
}

function ToastItem({
  toast,
  onDismiss,
}: {
  toast: ToastRecord;
  onDismiss: () => void;
}) {
  const [shown, setShown] = useState(false);
  const variant = toast.variant ?? "neutral";
  const style = variantStyles[variant];
  const Icon = style.icon;

  useEffect(() => {
    // Enter on next frame so the transition can play.
    const raf = requestAnimationFrame(() => setShown(true));
    const timer = setTimeout(onDismiss, AUTO_DISMISS_MS);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(timer);
    };
  }, [onDismiss]);

  return (
    <div
      className={cn(
        "pointer-events-auto relative flex items-start gap-3 overflow-hidden rounded-xl border border-border bg-elevated p-3 pl-4 shadow-lg",
        "transition-all duration-200 ease-out motion-reduce:transition-none",
        shown ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0"
      )}
    >
      <span
        aria-hidden="true"
        className={cn("absolute inset-y-0 left-0 w-1", style.stripe)}
      />
      <Icon
        size={16}
        strokeWidth={2.25}
        aria-hidden="true"
        className={cn("mt-0.5 shrink-0", style.iconColor)}
      />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-fg">{toast.title}</p>
        {toast.description && (
          <p className="mt-0.5 break-words text-[13px] leading-snug text-fg-muted">
            {toast.description}
          </p>
        )}
      </div>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss notification"
        className="-mr-0.5 -mt-0.5 shrink-0 rounded-md p-1 text-fg-subtle transition-colors hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
      >
        <X size={14} aria-hidden="true" />
      </button>
    </div>
  );
}
