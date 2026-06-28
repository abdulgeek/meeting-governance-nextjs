"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ShieldCheck,
  Scissors,
  KeyRound,
  ArrowRight,
  Plus,
  CalendarDays,
} from "lucide-react";
import { api, getToken, clearToken, Meeting } from "./lib/api";
import {
  AppShell,
  Hero,
  Logo,
  Button,
  Card,
  CardTitle,
  Input,
  Badge,
  EmptyState,
  Spinner,
  ThemeToggle,
  StatusDot,
  useToast,
} from "./components";

export default function Home() {
  const router = useRouter();
  const toast = useToast();
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [title, setTitle] = useState("");
  const [err, setErr] = useState("");
  const [ready, setReady] = useState(false);
  const [creating, setCreating] = useState(false);
  const [authed, setAuthed] = useState<boolean | null>(null);

  useEffect(() => {
    if (!getToken()) {
      setAuthed(false);
      return;
    }
    setAuthed(true);
    api
      .listMeetings()
      .then((m) => {
        setMeetings(m);
        setReady(true);
      })
      .catch((e) => setErr(e.message));
  }, []);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    setCreating(true);
    try {
      const m = await api.createMeeting(title.trim() || "Untitled meeting");
      toast.success("Meeting created");
      router.push(`/meeting/${m._id}`);
    } catch (e: any) {
      setErr(e.message);
      toast.error(e.message || "Couldn't create meeting");
      setCreating(false);
    }
  }

  function logout() {
    clearToken();
    router.replace("/login");
  }

  // ---- Logged out: marketing landing ----
  if (authed === false) {
    return <Landing />;
  }

  // ---- Auth state still resolving (or logged-in initial fetch) ----
  if (authed === null || !ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg text-fg">
        <Spinner size={20} label="Loading your meetings" />
      </div>
    );
  }

  // ---- Logged in: dashboard ----
  return (
    <AppShell onLogout={logout}>
      <div className="flex flex-col gap-8">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex flex-col gap-1.5">
            <h1 className="text-2xl font-semibold tracking-tight text-fg">
              Your meetings
            </h1>
            <p className="max-w-xl text-sm text-fg-muted">
              Start a governed meeting - decisions are made live, and only
              governed output is stored.
            </p>
          </div>
        </header>

        <form
          onSubmit={create}
          className="flex flex-col gap-3 sm:flex-row sm:items-center"
        >
          <Input
            placeholder="New meeting title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            aria-label="New meeting title"
            className="sm:flex-1"
          />
          <Button
            type="submit"
            icon={<Plus size={16} aria-hidden="true" />}
            loading={creating}
            disabled={creating}
          >
            Start meeting
          </Button>
        </form>

        {err && (
          <p className="text-sm text-danger" role="alert">
            {err}
          </p>
        )}

        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-medium tracking-tight text-fg-muted">
            Recent
          </h2>

          {meetings.length === 0 ? (
            <EmptyState
              icon={<CalendarDays size={22} aria-hidden="true" />}
              title="No meetings yet"
              description="Start one above to begin governing what gets recorded."
            />
          ) : (
            <ul className="flex flex-col gap-3">
              {meetings.map((m) => (
                <li key={m._id}>
                  <Link
                    href={`/meeting/${m._id}`}
                    className="group block rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                  >
                    <Card className="flex items-center justify-between gap-4 transition-colors group-hover:border-border-strong">
                      <div className="flex min-w-0 flex-col gap-1">
                        <CardTitle className="truncate text-[15px]">
                          {m.title}
                        </CardTitle>
                        {m.createdAt && (
                          <span className="text-xs text-fg-subtle">
                            {formatCreated(m.createdAt)}
                          </span>
                        )}
                      </div>
                      <div className="flex shrink-0 items-center gap-3">
                        <Badge variant={statusVariant(m.status)}>
                          {m.status}
                        </Badge>
                        <ArrowRight
                          size={16}
                          aria-hidden="true"
                          className="text-fg-subtle transition-transform group-hover:translate-x-0.5 group-hover:text-fg-muted"
                        />
                      </div>
                    </Card>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </AppShell>
  );
}

function statusVariant(status: string): "neutral" | "brand" | "danger" {
  const s = (status || "").toLowerCase();
  if (s === "live" || s === "active" || s === "recording") return "brand";
  if (s === "shredded" || s === "stopped") return "danger";
  return "neutral";
}

function formatCreated(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

// ---------------------------------------------------------------------------
// Marketing landing (logged out)
// ---------------------------------------------------------------------------

function Landing() {
  return (
    <div className="min-h-screen bg-bg text-fg">
      <header className="sticky top-0 z-40 border-b border-border bg-bg/80 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-4 px-5 sm:px-6">
          <Logo />
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Link href="/login">
              <Button size="sm">Sign in</Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-5 sm:px-6">
        {/* Hero */}
        <section className="grid items-center gap-10 py-16 sm:py-24 lg:grid-cols-2 lg:gap-12">
          <div className="flex flex-col items-start gap-6">
            <Badge variant="brand" className="gap-1.5">
              <StatusDot tone="brand" pulse />
              Consent-first governance
            </Badge>
            <h1 className="text-4xl font-semibold leading-[1.08] tracking-tight text-fg sm:text-5xl">
              Decide what gets recorded
              <br className="hidden sm:block" /> before it&apos;s written down.
            </h1>
            <p className="max-w-xl text-base leading-relaxed text-fg-muted">
              A bot joins your real Zoom, Meet, or Teams call and records only
              the people who consent. Sensitive content is redacted or dropped
              live - and when a meeting is over, one crypto-shred makes its
              transcript permanently unreadable.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <Link href="/login">
                <Button
                  size="md"
                  icon={<ArrowRight size={16} aria-hidden="true" />}
                >
                  Sign in to get started
                </Button>
              </Link>
              <span className="text-[13px] text-fg-subtle">
                Per-speaker consent. Nothing stored without it.
              </span>
            </div>
          </div>

          <div className="relative">
            <Hero className="mx-auto max-w-md" />
          </div>
        </section>

        {/* Feature cards */}
        <section className="grid gap-4 pb-20 sm:grid-cols-3 sm:gap-5">
          <FeatureCard
            icon={<ShieldCheck size={20} aria-hidden="true" />}
            title="Per-speaker consent"
            description="Only consented participants are ever transcribed. The consent gate declines everyone else, line by line."
          />
          <FeatureCard
            icon={<Scissors size={20} aria-hidden="true" />}
            title="Live redaction"
            description="Sensitive content is redacted or dropped the moment it's said - before a single word reaches storage."
          />
          <FeatureCard
            icon={<KeyRound size={20} aria-hidden="true" />}
            title="Crypto-shred"
            description="Destroy a meeting's key and every stored line becomes permanently unreadable. No recovery, by design."
          />
        </section>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-3 px-5 py-8 text-[13px] text-fg-subtle sm:flex-row sm:px-6">
          <Logo size={22} />
          <span>Real-time meeting governance.</span>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <Card className="flex flex-col gap-3">
      <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-elevated text-brand">
        {icon}
      </span>
      <CardTitle className="text-[15px]">{title}</CardTitle>
      <p className="text-[13px] leading-relaxed text-fg-muted">{description}</p>
    </Card>
  );
}
