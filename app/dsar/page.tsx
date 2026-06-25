"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, ShieldAlert, Download, FileSearch, Lock } from "lucide-react";
import {
  api,
  getToken,
  clearToken,
  downloadDsar,
  DsarLookupResponse,
} from "../lib/api";
import { cn } from "../lib/cn";
import {
  AppShell,
  Card,
  CardTitle,
  Input,
  Button,
  Badge,
  ActionPill,
  actionBorder,
  EmptyState,
  ConfirmDialog,
} from "../components";

// Self-service DSAR (feature 5). Owner-scoped: lookups and erasure span only the
// caller's own meetings. identity = email-when-known else name. Erasure is
// per-MEETING — it crypto-shreds whole meetings containing the person; true
// per-line/per-person erasure needs per-participant keys (future).
export default function DsarPage() {
  const router = useRouter();
  const [identity, setIdentity] = useState("");
  const [data, setData] = useState<DsarLookupResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [confirmErase, setConfirmErase] = useState(false);
  const [erasing, setErasing] = useState(false);
  const [erasedNote, setErasedNote] = useState("");

  useEffect(() => {
    if (!getToken()) router.replace("/login");
  }, [router]);

  function logout() {
    clearToken();
    router.replace("/login");
  }

  async function lookup(e?: React.FormEvent) {
    e?.preventDefault();
    const q = identity.trim();
    if (!q) return;
    setErr("");
    setErasedNote("");
    setLoading(true);
    try {
      setData(await api.dsarLookup(q));
    } catch (e: any) {
      setErr(e.message || "lookup failed");
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  async function erase() {
    const q = identity.trim();
    if (!q) return;
    setErr("");
    setErasing(true);
    try {
      const r = await api.dsarErase(q);
      setErasedNote(r.note);
      // Re-run the lookup so the (now-shredded) meetings reflect the change.
      await lookup();
    } catch (e: any) {
      setErr(e.message || "erase failed");
    } finally {
      setErasing(false);
    }
  }

  return (
    <AppShell onLogout={logout}>
      <header className="mb-8 flex flex-col gap-1.5">
        <h1 className="text-2xl font-semibold tracking-tight text-fg">
          Privacy &amp; data requests
        </h1>
        <p className="max-w-xl text-sm text-fg-muted">
          Look up everything stored about a person across your meetings, export it,
          or erase it. Identity is matched by email when known, otherwise by name.
        </p>
      </header>

      <div className="flex flex-col gap-8">
        {/* Lookup */}
        <section>
          <form
            onSubmit={lookup}
            className="flex flex-col gap-3 sm:flex-row sm:items-center"
          >
            <Input
              placeholder="Email or name (e.g. maya@acme.com or Maya)"
              value={identity}
              onChange={(e) => setIdentity(e.target.value)}
              aria-label="Identity to look up"
              className="sm:flex-1"
            />
            <Button
              type="submit"
              icon={<Search size={16} aria-hidden="true" />}
              loading={loading}
              disabled={loading || !identity.trim()}
            >
              Look up
            </Button>
          </form>
          <p className="mt-3 text-[13px] leading-relaxed text-fg-subtle">
            Scoped to your meetings only — org-wide DSAR needs identity resolution
            across owners (future). Erasure is per-meeting: it crypto-shreds whole
            meetings containing this person, not individual lines.
          </p>
          {err && (
            <p className="mt-3 text-[13px] text-danger" role="alert">
              {err}
            </p>
          )}
        </section>

        {/* Results */}
        {data && (
          <section className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2.5">
                <h2 className="text-sm font-semibold tracking-tight text-fg">
                  Results for{" "}
                  <span className="font-mono text-fg-muted">{data.identity}</span>
                </h2>
                <Badge variant="neutral">
                  {data.counts.meetings} meeting
                  {data.counts.meetings === 1 ? "" : "s"}
                </Badge>
                <Badge variant="neutral">
                  {data.counts.lines} line{data.counts.lines === 1 ? "" : "s"}
                </Badge>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  icon={<Download size={14} aria-hidden="true" />}
                  onClick={() => downloadDsar(data)}
                  disabled={data.meetings.length === 0}
                >
                  Export
                </Button>
                <Button
                  variant="danger"
                  size="sm"
                  icon={<ShieldAlert size={14} aria-hidden="true" />}
                  onClick={() => setConfirmErase(true)}
                  disabled={data.meetings.length === 0 || erasing}
                  loading={erasing}
                >
                  Erase (crypto-shred)
                </Button>
              </div>
            </div>

            {erasedNote && (
              <Card className="flex items-start gap-2 text-[13px] text-fg-muted">
                <Lock size={14} aria-hidden="true" className="mt-0.5 shrink-0" />
                {erasedNote}
              </Card>
            )}

            {data.meetings.length === 0 ? (
              <EmptyState
                icon={<FileSearch size={20} aria-hidden="true" />}
                title="Nothing found"
                description="No meetings of yours contain this person."
              />
            ) : (
              <div className="flex flex-col gap-4">
                {data.meetings.map((m) => (
                  <Card key={m.meetingId} className="flex flex-col gap-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <CardTitle className="text-[15px]">{m.title}</CardTitle>
                      <span
                        className={cn(
                          "text-[13px] font-medium",
                          m.consent ? "text-brand" : "text-danger"
                        )}
                      >
                        {m.consent ? "Consented" : "Declined"}
                      </span>
                    </div>
                    {m.lines.length === 0 ? (
                      <p className="text-[13px] text-fg-subtle">
                        No kept lines for this person in this meeting.
                      </p>
                    ) : (
                      <div className="flex flex-col gap-2">
                        {m.lines.map((l) => (
                          <div
                            key={l.idx}
                            className={cn(
                              "rounded-xl border border-l-4 border-border bg-elevated p-3",
                              actionBorder(l.action)
                            )}
                          >
                            <div className="mb-1 flex items-center gap-2 text-xs text-fg-subtle">
                              <span className="font-mono">#{l.idx}</span>
                              <ActionPill action={l.action} />
                            </div>
                            <div className="text-sm text-fg">{l.text ?? "—"}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </Card>
                ))}
              </div>
            )}
          </section>
        )}

        {!data && !loading && (
          <EmptyState
            icon={<FileSearch size={20} aria-hidden="true" />}
            title="No lookup yet"
            description="Enter an email or name above to find stored data."
          />
        )}
      </div>

      <ConfirmDialog
        open={confirmErase}
        title="Erase this person's data?"
        description={
          <>
            This crypto-shreds <strong>every meeting of yours containing</strong>{" "}
            <span className="font-mono">{identity.trim()}</span> — destroying each
            meeting&rsquo;s encryption key. All stored lines in those meetings become
            permanently unreadable for everyone, not just this person. This is
            irreversible, by design.
          </>
        }
        confirmLabel="Erase (irreversible)"
        cancelLabel="Cancel"
        confirmVariant="danger"
        onConfirm={() => {
          setConfirmErase(false);
          erase();
        }}
        onCancel={() => setConfirmErase(false)}
      />
    </AppShell>
  );
}
