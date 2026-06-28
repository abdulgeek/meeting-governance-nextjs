"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Mic,
  RadioTower,
  Users,
  ListChecks,
  Database,
  Lock,
  FileText,
  ClipboardCheck,
  Download,
} from "lucide-react";
import {
  api,
  getToken,
  WS_URL,
  Line,
  Participant,
  downloadAudit,
  AuditResponse,
  ActionCounts,
} from "../../lib/api";
import { cn } from "../../lib/cn";
import {
  AppShell,
  Card,
  CardHeader,
  CardTitle,
  Input,
  Switch,
  Button,
  Badge,
  ActionPill,
  actionBorder,
  StatusDot,
  EmptyState,
  ConfirmDialog,
  useToast,
} from "../../components";
import type { ToastVariant } from "../../components";

type Decision = {
  idx: number; speaker: string; action: string;
  policy_id: string; confidence: number; shown: string;
};

function downsample(buf: Float32Array, inRate: number): Float32Array {
  if (inRate === 16000) return buf;
  const r = inRate / 16000, n = Math.floor(buf.length / r), o = new Float32Array(n);
  for (let i = 0; i < n; i++) o[i] = buf[Math.floor(i * r)];
  return o;
}
function f2i(buf: Float32Array): Int16Array {
  const o = new Int16Array(buf.length);
  for (let i = 0; i < buf.length; i++) {
    const s = Math.max(-1, Math.min(1, buf[i]));
    o[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return o;
}

export default function MeetingPage({ params }: { params: { id: string } }) {
  const id = params.id;
  const router = useRouter();
  const toast = useToast();
  const [title, setTitle] = useState("");
  const [badge, setBadge] = useState("connecting…");
  const [ready, setReady] = useState(false);
  const [speaker, setSpeaker] = useState("you");
  const [talking, setTalking] = useState(false);
  const [live, setLive] = useState<Decision[]>([]);
  const [saved, setSaved] = useState<Line[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);

  const [meetingUrl, setMeetingUrl] = useState("");
  const [separate, setSeparate] = useState(true);
  const [botStatus, setBotStatus] = useState("");
  const [botErr, setBotErr] = useState("");
  const [botLaunched, setBotLaunched] = useState(false);
  const [joining, setJoining] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [confirmShred, setConfirmShred] = useState(false);

  // Governed summary (feature 1) - only kept lines feed it (enforced server-side).
  const [summary, setSummary] = useState<string | null>(null);
  const [summaryShredded, setSummaryShredded] = useState(false);
  const [summaryAt, setSummaryAt] = useState<string | null>(null);
  const [summarizing, setSummarizing] = useState(false);
  const [summaryErr, setSummaryErr] = useState("");

  // Audit & compliance (feature 2) - content-free counts only.
  const [audit, setAudit] = useState<AuditResponse | null>(null);
  const [auditErr, setAuditErr] = useState("");
  const [exporting, setExporting] = useState<"json" | "csv" | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const recRef = useRef(false);
  const spkRef = useRef("you");
  useEffect(() => { spkRef.current = speaker; }, [speaker]);

  // Keep the latest toast fn in a ref so the WS effect (deps: [id]) can fire
  // toasts without re-subscribing on every render.
  const toastRef = useRef(toast);
  useEffect(() => { toastRef.current = toast; }, [toast]);
  // WS lifecycle flags for distinguishing an unexpected drop from a normal
  // page-unmount close, and for seeding participant-change toasts.
  const wsReadyRef = useRef(false);
  const wsUnmountingRef = useRef(false);
  const seenPartsRef = useRef<Map<string, boolean> | null>(null);

  // Per-utterance toast for the mic path so the speaker gets confirmation
  // their speech was governed. Title = the action; description = the shown
  // text (truncated), omitted for DROP / DECLINE.
  function toastDecision(d: Decision) {
    const meta = decisionToast(d.action);
    const desc =
      meta.showText && d.shown ? truncate(d.shown, 60) : undefined;
    toastRef.current({
      title: meta.title,
      description: desc,
      variant: meta.variant,
    });
  }

  // Toast on participant changes only (not on every 2.5s poll). On first load
  // we seed the ref so existing participants don't all toast at once.
  function diffParticipants(parts: Participant[]) {
    const prev = seenPartsRef.current;
    if (prev === null) {
      seenPartsRef.current = new Map(parts.map((p) => [p.name, p.consent]));
      return;
    }
    for (const p of parts) {
      if (!prev.has(p.name)) {
        toastRef.current.info(`${p.name} joined`);
      } else if (prev.get(p.name) === false && p.consent === true) {
        toastRef.current.success(`${p.name} consented`);
      }
    }
    seenPartsRef.current = new Map(parts.map((p) => [p.name, p.consent]));
  }

  async function refreshSaved() {
    try {
      const [lines, parts] = await Promise.all([api.getLines(id), api.participants(id)]);
      setSaved(lines);
      setParticipants(parts);
      diffParticipants(parts);
    } catch { }
    refreshAudit();
  }
  async function refreshAudit() {
    try {
      setAudit(await api.getAudit(id));
      setAuditErr("");
    } catch (err: any) {
      setAuditErr(err.message || "audit unavailable");
    }
  }
  async function loadSummary() {
    try {
      const s = await api.getSummary(id);
      setSummary(s.summary);
      setSummaryShredded(s.shredded);
      setSummaryAt(s.generatedAt);
    } catch { }
  }
  async function generateSummary() {
    setSummaryErr("");
    setSummarizing(true);
    try {
      const r = await api.generateSummary(id);
      setSummary(r.summary);
      setSummaryShredded(false);
      setSummaryAt(new Date().toISOString());
    } catch (err: any) {
      setSummaryErr(err.message || "summary failed");
    } finally {
      setSummarizing(false);
    }
  }
  async function exportAudit(format: "json" | "csv") {
    setExporting(format);
    try {
      await downloadAudit(id, format);
    } catch (err: any) {
      setAuditErr(err.message || "export failed");
    } finally {
      setExporting(null);
    }
  }
  async function shred() {
    // Shredding destroys the key: the stored summary becomes unreadable too.
    try {
      await api.shred(id);
      await refreshSaved();
      await loadSummary();
    } catch { }
  }
  async function joinBot() {
    const url = meetingUrl.trim();
    if (!url) return;
    setBotErr("");
    setJoining(true);
    toast.info("Launching the bot…");
    try {
      const r = await api.joinMeeting(id, url, separate);
      setBotStatus(r.status);
      setBotLaunched(true);
      toast.success("Bot launched - admit “Governance Bot” in the call");
    } catch (err: any) {
      setBotErr(err.message || "join failed");
      toast.error(err.message || "Couldn't launch the bot");
    } finally {
      setJoining(false);
    }
  }
  async function stopBot() {
    setBotErr("");
    setStopping(true);
    try {
      await api.stopMeeting(id);
      setBotStatus("stopped");
      setBotLaunched(false);
      toast.success("Bot removed from the call");
    } catch (err: any) {
      setBotErr(err.message || "stop failed");
      toast.error(err.message || "Couldn't remove the bot");
    } finally {
      setStopping(false);
    }
  }

  useEffect(() => {
    if (!getToken()) { router.replace("/login"); return; }
    api.getMeeting(id).then((m) => {
      setTitle(m.title);
      if (m.meetingUrl) setMeetingUrl(m.meetingUrl);
      if (m.botStatus && m.botStatus !== "idle") {
        setBotStatus(m.botStatus);
        if (m.botStatus !== "stopped") setBotLaunched(true);
      }
    }).catch(() => { });
    refreshSaved();
    loadSummary();

    const ws = new WebSocket(WS_URL);
    ws.binaryType = "arraybuffer";
    wsRef.current = ws;
    ws.onopen = () =>
      ws.send(JSON.stringify({
        type: "config", consent: { you: true, guest: false },
        meetingId: id, token: getToken(),
      }));
    ws.onmessage = (e) => {
      const m = JSON.parse(e.data);
      if (m.type === "ready") {
        setBadge(`${m.engine} · ${String(m.model).split(".").pop()}`);
        setReady(true);
        wsReadyRef.current = true;
        toastRef.current.success("Live engine connected");
      } else if (m.type === "decision") {
        const d = m as Decision;
        setLive((p) => [d, ...p]);
        // Per-utterance confirmation for the mic / hold-to-talk path.
        toastDecision(d);
      }
    };
    ws.onclose = () => {
      setBadge("disconnected");
      setReady(false);
      // Only surface an error for an unexpected drop after we'd connected -
      // not for the normal page-unmount close.
      if (wsReadyRef.current && !wsUnmountingRef.current) {
        toastRef.current.error("Disconnected from the engine");
      }
      wsReadyRef.current = false;
    };

    let cleanup = () => { };
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const src = ctx.createMediaStreamSource(stream);
        const proc = ctx.createScriptProcessor(4096, 1, 1);
        proc.onaudioprocess = (ev) => {
          if (!recRef.current || ws.readyState !== 1) return;
          const inp = ev.inputBuffer.getChannelData(0);
          ws.send(f2i(downsample(inp, ctx.sampleRate)).buffer);
        };
        src.connect(proc);
        proc.connect(ctx.destination);
        cleanup = () => {
          proc.disconnect(); src.disconnect();
          stream.getTracks().forEach((t) => t.stop()); ctx.close();
        };
      } catch (err) {
        setBadge("mic blocked"); console.error(err);
      }
    })();

    return () => { wsUnmountingRef.current = true; cleanup(); ws.close(); };
  }, [id]);

  // Once a bot is in the call, audio arrives via Recall (not the mic), so poll the
  // persisted lines + consent so the decision/participant panels fill in live.
  useEffect(() => {
    if (!botLaunched) return;
    const t = setInterval(refreshSaved, 2500);
    return () => clearInterval(t);
  }, [botLaunched, id]);

  const start = () => {
    if (!ready) return;
    recRef.current = true; setTalking(true);
    wsRef.current?.send(JSON.stringify({ type: "speaker", id: spkRef.current }));
  };
  const stop = () => {
    if (!recRef.current) return;
    recRef.current = false; setTalking(false);
    wsRef.current?.send(JSON.stringify({ type: "eou" }));
    setTimeout(refreshSaved, 1500); // pull the persisted line(s) after the decision lands
  };
  // Keyboard parity for hold-to-talk: Space/Enter holds while pressed.
  const onTalkKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === " " || e.key === "Enter") {
      e.preventDefault();
      if (!e.repeat) start();
    }
  };
  const onTalkKeyUp = (e: React.KeyboardEvent) => {
    if (e.key === " " || e.key === "Enter") {
      e.preventDefault();
      stop();
    }
  };

  // Map the connection badge to a status tone for the live indicator.
  const connected = ready;
  const dotTone = connected ? "brand" : badge === "disconnected" || badge === "mic blocked" ? "danger" : "muted";

  return (
    <AppShell>
      {/* Header */}
      <header className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight text-fg">
              {title || "Meeting"}
            </h1>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-elevated px-2.5 py-0.5 text-xs font-medium text-fg-muted">
              <StatusDot tone={dotTone} pulse={connected} label={badge} />
              {badge}
            </span>
          </div>
          <p className="mt-1.5 max-w-xl text-sm text-fg-muted">
            Hold talk and speak. Decisions are made live; only governed output is saved.
          </p>
        </div>
      </header>

      <div className="flex flex-col gap-8">
        {/* Join a live meeting */}
        <section>
          <SectionTitle icon={<RadioTower size={16} aria-hidden="true" />}>
            Join a live meeting
          </SectionTitle>
          <Card className="flex flex-col gap-4">
            <Input
              placeholder="Paste a Zoom / Google Meet / Teams URL"
              value={meetingUrl}
              onChange={(e) => setMeetingUrl(e.target.value)}
              aria-label="Meeting URL"
            />
            <label className="flex items-center gap-2.5 text-sm text-fg-muted">
              <Switch
                checked={separate}
                onCheckedChange={setSeparate}
                label="Record each participant separately"
              />
              Record each participant separately (per-speaker consent)
            </label>
            <div className="flex flex-wrap items-center gap-2.5">
              <Button
                onClick={joinBot}
                disabled={!meetingUrl.trim() || joining}
                loading={joining}
              >
                Join bot
              </Button>
              <Button
                variant="ghost"
                onClick={stopBot}
                disabled={!botLaunched || stopping}
                loading={stopping}
              >
                Stop bot
              </Button>
              {botStatus && <Badge variant="neutral">{botStatus}</Badge>}
            </div>

            <div className="rounded-2xl border border-border bg-elevated p-4">
              <p className="mb-2.5 text-[13px] font-medium text-fg-muted">
                How recording consent works
              </p>
              <ol className="flex flex-col gap-2 text-[13px] leading-relaxed text-fg-subtle">
                <li className="flex gap-2.5">
                  <ConsentStep>1</ConsentStep>
                  The bot joins your call - admit &ldquo;Governance Bot&rdquo; like any guest.
                </li>
                <li className="flex gap-2.5">
                  <ConsentStep>2</ConsentStep>
                  It pins a chat message asking each person to reply with &ldquo;+&rdquo;.
                </li>
                <li className="flex gap-2.5">
                  <ConsentStep>3</ConsentStep>
                  Only people who reply are recorded - no reply means they are never transcribed.
                </li>
                <li className="flex gap-2.5">
                  <ConsentStep>4</ConsentStep>
                  Sensitive content is still redacted or dropped live, before it reaches storage.
                </li>
              </ol>
            </div>
            {botErr && <p className="text-[13px] text-danger">{botErr}</p>}
          </Card>
        </section>

        {/* Mic controls */}
        <section>
          <Card className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center">
            <label className="flex items-center gap-2 text-sm text-fg-muted">
              Speaker
              <select
                value={speaker}
                onChange={(e) => setSpeaker(e.target.value)}
                className="h-10 rounded-xl border border-border bg-elevated px-3 text-sm text-fg transition-colors duration-150 hover:border-border-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:border-brand"
              >
                <option value="you">You (consented)</option>
                <option value="guest">Guest (NOT consented)</option>
              </select>
            </label>
            <Button
              variant={talking ? "danger" : "primary"}
              disabled={!ready}
              icon={<Mic size={16} aria-hidden="true" />}
              aria-label="Hold to talk - press and hold, or hold Space, to record"
              aria-pressed={talking}
              className={cn("select-none", talking && "bg-danger/[0.12] border-danger")}
              onMouseDown={start}
              onMouseUp={stop}
              onMouseLeave={stop}
              onKeyDown={onTalkKeyDown}
              onKeyUp={onTalkKeyUp}
              onTouchStart={(e) => { e.preventDefault(); start(); }}
              onTouchEnd={(e) => { e.preventDefault(); stop(); }}
            >
              {talking ? "Listening…" : "Hold to talk"}
            </Button>
            <span className="text-[13px] text-fg-subtle">
              Switch to &ldquo;Guest&rdquo; to see the consent gate decline it. Press and hold, or
              hold Space while focused, to record.
            </span>
          </Card>
        </section>

        {/* Participants & consent */}
        <section>
          <SectionTitle icon={<Users size={16} aria-hidden="true" />}>
            Participants &amp; consent
          </SectionTitle>
          <p className="mb-3 text-[13px] leading-relaxed text-fg-subtle">
            These toggles are read-only - consent is set in-meeting when each person replies
            &ldquo;+&rdquo;, not from here.
          </p>
          {participants.length === 0 ? (
            <EmptyState
              icon={<Users size={20} aria-hidden="true" />}
              title="No participants yet"
              description="Opt-ins appear here as people consent."
            />
          ) : (
            <div className="flex flex-col gap-2">
              {participants.map((p) => (
                <div
                  key={p.name}
                  className="flex items-center justify-between rounded-2xl border border-border bg-surface px-4 py-3"
                >
                  <span className="flex items-center gap-2.5 text-sm text-fg">
                    <StatusDot tone={p.consent ? "brand" : "danger"} />
                    {p.name}
                  </span>
                  <span className="flex items-center gap-2.5">
                    <span
                      className={cn(
                        "text-[13px] font-medium",
                        p.consent ? "text-brand" : "text-danger"
                      )}
                    >
                      {p.consent ? "Consented" : "Declined"}
                    </span>
                    <Switch checked={p.consent} disabled label={`${p.name} consent`} />
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Live decisions */}
        <section>
          <SectionTitle icon={<ListChecks size={16} aria-hidden="true" />}>
            Live decisions
          </SectionTitle>
          {live.length === 0 ? (
            <EmptyState
              icon={<ListChecks size={20} aria-hidden="true" />}
              title="Nothing yet"
              description="Hold talk and say a sentence."
            />
          ) : (
            <div className="flex flex-col gap-2.5">
              {live.map((d) => (
                <div
                  key={d.idx}
                  className={cn(
                    "rounded-2xl border border-l-4 border-border bg-surface p-4",
                    actionBorder(d.action)
                  )}
                >
                  <div className="mb-1.5 flex flex-wrap items-center gap-2 text-xs text-fg-subtle">
                    <span className="font-mono">#{d.idx}</span>
                    <span className="text-fg-muted">{d.speaker}</span>
                    <ActionPill action={d.action} />
                    <Badge variant="neutral" className="font-mono tracking-tight">{d.policy_id}</Badge>
                    <span>conf {d.confidence.toFixed(2)}</span>
                  </div>
                  <div className={cn("text-sm text-fg", isMonoAction(d.action) && "font-mono")}>
                    {d.shown}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Saved transcript */}
        <section>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <SectionTitle icon={<Database size={16} aria-hidden="true" />} className="mb-0">
              Saved transcript (in MongoDB)
            </SectionTitle>
            <div className="flex items-center gap-2">
              <Button variant="secondary" size="sm" onClick={refreshSaved}>
                Refresh
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={() => setConfirmShred(true)}
                icon={<Lock size={14} aria-hidden="true" />}
              >
                Crypto-shred
              </Button>
            </div>
          </div>
          <p className="mb-3 text-[13px] leading-relaxed text-fg-subtle">
            Kept text is stored encrypted per meeting; dropped/declined lines hold no text
            (&ldquo;-&rdquo;). Crypto-shred destroys the meeting key - stored text becomes
            permanently unreadable.
          </p>
          {saved.length === 0 ? (
            <EmptyState
              icon={<Database size={20} aria-hidden="true" />}
              title="No saved lines yet"
            />
          ) : (
            <div className="flex flex-col gap-2.5">
              {saved.map((l) => (
                <div
                  key={l.idx}
                  className={cn(
                    "rounded-2xl border border-l-4 border-border bg-surface p-4",
                    actionBorder(l.action)
                  )}
                >
                  <div className="mb-1.5 flex flex-wrap items-center gap-2 text-xs text-fg-subtle">
                    <span className="font-mono">#{l.idx}</span>
                    <span className="text-fg-muted">{l.speaker}</span>
                    <ActionPill action={l.action} />
                    <Badge variant="neutral" className="font-mono tracking-tight">{l.policyId || "-"}</Badge>
                  </div>
                  <div
                    className={cn(
                      "text-sm",
                      l.shredded
                        ? "flex items-center gap-1.5 font-mono text-fg-subtle"
                        : "font-mono text-fg"
                    )}
                  >
                    {l.shredded ? (
                      <>
                        <Lock size={13} aria-hidden="true" />
                        unreadable - key destroyed
                      </>
                    ) : (
                      l.text ?? "-"
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Governed summary - only kept lines feed it (enforced server-side). */}
        <section>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <SectionTitle icon={<FileText size={16} aria-hidden="true" />} className="mb-0">
              Summary
            </SectionTitle>
            <Button
              variant="secondary"
              size="sm"
              onClick={generateSummary}
              loading={summarizing}
              disabled={summarizing || summaryShredded}
            >
              {summary ? "Regenerate summary" : "Generate summary"}
            </Button>
          </div>
          <p className="mb-3 text-[13px] leading-relaxed text-fg-subtle">
            Summarizes only kept lines (committed, redacted, or flagged) - dropped and
            declined content never reaches the model.
          </p>
          {summaryErr && <p className="mb-3 text-[13px] text-danger">{summaryErr}</p>}
          {summaryShredded ? (
            <Card className="flex items-center gap-2 text-[13px] text-fg-subtle">
              <Lock size={14} aria-hidden="true" />
              Summary unreadable - the meeting key was crypto-shredded.
            </Card>
          ) : summary ? (
            <Card className="flex flex-col gap-3">
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-fg">
                {summary}
              </p>
              {summaryAt && (
                <span className="text-xs text-fg-subtle">
                  Generated {formatWhen(summaryAt)}
                </span>
              )}
            </Card>
          ) : (
            <EmptyState
              icon={<FileText size={20} aria-hidden="true" />}
              title="No summary yet"
              description="Generate one from the kept lines above."
            />
          )}
        </section>

        {/* Audit & compliance - content-free: counts only, never the words. */}
        <section>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <SectionTitle icon={<ClipboardCheck size={16} aria-hidden="true" />} className="mb-0">
              Audit &amp; compliance
            </SectionTitle>
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                icon={<Download size={14} aria-hidden="true" />}
                onClick={() => exportAudit("json")}
                loading={exporting === "json"}
                disabled={!audit || exporting !== null}
              >
                Export JSON
              </Button>
              <Button
                variant="secondary"
                size="sm"
                icon={<Download size={14} aria-hidden="true" />}
                onClick={() => exportAudit("csv")}
                loading={exporting === "csv"}
                disabled={!audit || exporting !== null}
              >
                Export CSV
              </Button>
            </div>
          </div>
          <p className="mb-3 text-[13px] leading-relaxed text-fg-subtle">
            Counts only - never the words. Per-participant decision tallies, consent state,
            and an integrity hash over the decision log.
          </p>
          {auditErr && <p className="mb-3 text-[13px] text-danger">{auditErr}</p>}
          {!audit || audit.participants.length === 0 ? (
            <EmptyState
              icon={<ClipboardCheck size={20} aria-hidden="true" />}
              title="No audit data yet"
              description="Decision tallies appear here once lines are governed."
            />
          ) : (
            <Card className="flex flex-col gap-4 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="text-left text-xs text-fg-subtle">
                      <th className="pb-2 pr-3 font-medium">Participant</th>
                      <th className="pb-2 pr-3 font-medium">Consent</th>
                      {AUDIT_ACTIONS.map((a) => (
                        <th key={a} className="pb-2 pr-3 text-right font-medium">
                          <ActionPill action={a} showIcon={false} className="px-2 py-0.5" />
                        </th>
                      ))}
                      <th className="pb-2 text-right font-medium text-fg-muted">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {audit.participants.map((p) => (
                      <tr key={p.name} className="border-t border-border">
                        <td className="py-2 pr-3">
                          <span className="flex flex-col">
                            <span className="text-fg">{p.name}</span>
                            {p.email && (
                              <span className="text-xs text-fg-subtle">{p.email}</span>
                            )}
                          </span>
                        </td>
                        <td className="py-2 pr-3">
                          <span
                            className={cn(
                              "text-[13px] font-medium",
                              p.consent ? "text-brand" : "text-danger"
                            )}
                          >
                            {p.consent ? "Consented" : "Declined"}
                          </span>
                        </td>
                        {AUDIT_ACTIONS.map((a) => (
                          <td
                            key={a}
                            className="py-2 pr-3 text-right font-mono tabular-nums text-fg-muted"
                          >
                            {p.counts[a]}
                          </td>
                        ))}
                        <td className="py-2 text-right font-mono tabular-nums text-fg">
                          {p.total}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-border-strong">
                      <td className="py-2 pr-3 font-medium text-fg">Totals</td>
                      <td className="py-2 pr-3" />
                      {AUDIT_ACTIONS.map((a) => (
                        <td
                          key={a}
                          className="py-2 pr-3 text-right font-mono tabular-nums text-fg"
                        >
                          {audit.totals[a]}
                        </td>
                      ))}
                      <td className="py-2 text-right font-mono tabular-nums text-fg">
                        {AUDIT_ACTIONS.reduce((sum, a) => sum + audit.totals[a], 0)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
              <div className="flex items-center gap-2 text-xs text-fg-subtle">
                <Lock size={12} aria-hidden="true" />
                <span className="font-mono">{audit.integrity.algo}</span>
                <span className="truncate font-mono">{audit.integrity.hash}</span>
              </div>
            </Card>
          )}
        </section>
      </div>

      <ConfirmDialog
        open={confirmShred}
        title="Crypto-shred this meeting?"
        description={
          <>
            This destroys the meeting&rsquo;s encryption key. Every stored line becomes
            permanently unreadable - there is no recovery, by design.
          </>
        }
        confirmLabel="Destroy key"
        cancelLabel="Cancel"
        confirmVariant="danger"
        onConfirm={() => { setConfirmShred(false); shred(); }}
        onCancel={() => setConfirmShred(false)}
      />
    </AppShell>
  );
}

// Column order for the audit table - matches the ActionCounts keys.
const AUDIT_ACTIONS: (keyof ActionCounts)[] = [
  "COMMIT",
  "REDACT",
  "FLAG",
  "DROP",
  "DECLINE",
];

function formatWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Map a governance action to its per-utterance toast treatment.
// COMMIT=success, REDACT=warning, DROP=error, FLAG=info, DECLINE=neutral.
function decisionToast(action: string): {
  title: string;
  variant: ToastVariant;
  showText: boolean;
} {
  switch (action?.toUpperCase()) {
    case "COMMIT":
      return { title: "Committed", variant: "success", showText: true };
    case "REDACT":
      return { title: "Redacted", variant: "warning", showText: true };
    case "DROP":
      return { title: "Dropped", variant: "error", showText: false };
    case "FLAG":
      return { title: "Flagged", variant: "info", showText: true };
    case "DECLINE":
    default:
      return {
        title: "Declined - no consent",
        variant: "neutral",
        showText: false,
      };
  }
}

function truncate(s: string, max: number): string {
  return s.length > max ? `${s.slice(0, max).trimEnd()}…` : s;
}

function isMonoAction(action: string): boolean {
  const a = action?.toUpperCase();
  return a === "COMMIT" || a === "REDACT";
}

function ConsentStep({ children }: { children: React.ReactNode }) {
  return (
    <span className="mt-px flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-border bg-surface text-[11px] font-medium text-fg-muted">
      {children}
    </span>
  );
}

function SectionTitle({
  icon,
  children,
  className,
}: {
  icon?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <h2
      className={cn(
        "mb-3 flex items-center gap-2 text-sm font-semibold tracking-tight text-fg",
        className
      )}
    >
      {icon && <span className="text-fg-muted">{icon}</span>}
      {children}
    </h2>
  );
}
