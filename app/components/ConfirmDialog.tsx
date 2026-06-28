"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { cn } from "../lib/cn";
import { Button, type ButtonVariant } from "./Button";

export type ConfirmDialogProps = {
  open: boolean;
  title: string;
  /** Body copy - keep it explicit about consequences. */
  description?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmVariant?: ButtonVariant;
  onConfirm: () => void;
  onCancel: () => void;
};

/**
 * Accessible confirm modal. Renders into document.body so it sits above the
 * page without inheriting a transformed/stacking ancestor. Esc closes it,
 * the backdrop is clickable, and focus moves to the dialog on open.
 */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  confirmVariant = "danger",
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const panelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    document.addEventListener("keydown", onKey);
    // Move focus into the dialog so keyboard users land here.
    panelRef.current?.focus();
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onCancel]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-5"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
    >
      {/* Backdrop */}
      <button
        type="button"
        aria-label="Dismiss dialog"
        onClick={onCancel}
        className="absolute inset-0 bg-bg/70 backdrop-blur-sm"
      />
      <div
        ref={panelRef}
        tabIndex={-1}
        className={cn(
          "relative w-full max-w-md rounded-2xl border border-border bg-surface p-5 shadow-xl",
          "focus-visible:outline-none"
        )}
      >
        <h2
          id="confirm-dialog-title"
          className="text-base font-semibold tracking-tight text-fg"
        >
          {title}
        </h2>
        {description && (
          <div className="mt-2 text-[13px] leading-relaxed text-fg-muted">
            {description}
          </div>
        )}
        <div className="mt-5 flex flex-wrap items-center justify-end gap-2.5">
          <Button variant="ghost" size="sm" onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button variant={confirmVariant} size="sm" onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>,
    document.body
  );
}
