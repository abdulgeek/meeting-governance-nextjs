import {
  forwardRef,
  useId,
  type InputHTMLAttributes,
  type TextareaHTMLAttributes,
  type ReactNode,
} from "react";
import { cn } from "../lib/cn";

const fieldBase =
  "w-full rounded-xl border border-border bg-elevated px-3.5 text-sm text-fg " +
  "placeholder:text-fg-subtle transition-colors duration-150 " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:border-brand " +
  "disabled:opacity-50 disabled:pointer-events-none";

export type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  invalid?: boolean;
};

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, invalid, ...props },
  ref
) {
  return (
    <input
      ref={ref}
      aria-invalid={invalid || undefined}
      className={cn(
        fieldBase,
        "h-10",
        invalid && "border-[#F87171] focus-visible:ring-[#F87171]",
        className
      )}
      {...props}
    />
  );
});

export type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  invalid?: boolean;
};

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  function Textarea({ className, invalid, ...props }, ref) {
    return (
      <textarea
        ref={ref}
        aria-invalid={invalid || undefined}
        className={cn(
          fieldBase,
          "min-h-[88px] py-2.5 leading-relaxed",
          invalid && "border-[#F87171] focus-visible:ring-[#F87171]",
          className
        )}
        {...props}
      />
    );
  }
);

export type FieldProps = {
  label: string;
  htmlFor?: string;
  error?: string;
  hint?: ReactNode;
  className?: string;
  children: ReactNode;
};

/**
 * Field — label + control + error/hint wrapper. Pass the control as children.
 * If a child input needs the generated id, render Field around a labelled
 * control or pass htmlFor explicitly.
 */
export function Field({
  label,
  htmlFor,
  error,
  hint,
  className,
  children,
}: FieldProps) {
  const generatedId = useId();
  const id = htmlFor ?? generatedId;
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={id} className="text-[13px] font-medium text-fg-muted">
        {label}
      </label>
      {children}
      {error ? (
        <p className="text-[13px] text-[#F87171]">{error}</p>
      ) : hint ? (
        <p className="text-[13px] text-fg-subtle">{hint}</p>
      ) : null}
    </div>
  );
}
