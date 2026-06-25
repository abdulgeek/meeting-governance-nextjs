import { type ReactNode } from "react";
import { LogOut } from "lucide-react";
import Link from "next/link";
import { cn } from "../lib/cn";
import { Logo } from "./Logo";
import { ThemeToggle } from "./ThemeToggle";
import { Button } from "./Button";

export type AppShellProps = {
  children: ReactNode;
  /** Optional nav slot rendered between the logo and the right cluster. */
  nav?: ReactNode;
  /** Called when the logout button is clicked. */
  onLogout?: () => void;
  /** Constrain main content width. Defaults to max-w-3xl. */
  maxWidthClassName?: string;
  className?: string;
};

export function AppShell({
  children,
  nav,
  onLogout,
  maxWidthClassName = "max-w-3xl",
  className,
}: AppShellProps) {
  return (
    <div className={cn("min-h-screen bg-bg text-fg", className)}>
      <header className="sticky top-0 z-40 border-b border-border bg-bg/80 backdrop-blur-md">
        <div
          className={cn(
            "mx-auto flex h-14 items-center justify-between gap-4 px-5 sm:px-6",
            maxWidthClassName
          )}
        >
          <Link
            href="/"
            className="flex items-center rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
          >
            <Logo />
          </Link>

          <nav className="flex items-center gap-1">
            <Link
              href="/dsar"
              className="rounded-lg px-3 py-1.5 text-sm font-medium text-fg-muted transition-colors hover:bg-elevated hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
            >
              Privacy &amp; DSAR
            </Link>
            {nav}
          </nav>

          <div className="flex items-center gap-2">
            <ThemeToggle />
            {onLogout && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onLogout}
                icon={<LogOut size={15} aria-hidden="true" />}
              >
                Logout
              </Button>
            )}
          </div>
        </div>
      </header>

      <main className={cn("mx-auto px-5 py-8 sm:px-6 sm:py-10", maxWidthClassName)}>
        {children}
      </main>
    </div>
  );
}
