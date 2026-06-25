"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Mic, RadioTower, Users, ListChecks, Database, Lock } from "lucide-react";
import { api, getToken, WS_URL, Line, Participant } from "../../lib/api";
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
} from "../../components";

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

  const wsRef = useRef<WebSocket | null>(null);
  const recRef = useRef(false);
  const spkRef = useRef("you");
  useEffect(() => { spkRef.current = speaker; }, [speaker]);

  async function refreshSaved() {
    try {
      const [lines, parts] = await Promise.all([api.getLines(id), api.participants(id)]);
      setSaved(lines);
      setParticipants(parts);
    } catch {}
  }
  async function shred() {
    if (typeof window !== "undefined" &&
        !window.confirm("Crypto-shred this meeting? Its key is destroyed and all stored text becomes permanently unreadable.")) return;
    try { await api.shred(id); await refreshSaved(); } catch {}
  }
  async function joinBot() {
    const url = meetingUrl.trim();
    if (!url) return;
    setBotErr("");
    try {
      const r = await api.joinMeeting(id, url, separate);
      setBotStatus(r.status);
      setBotLaunched(true);
    } catch (err: any) {
      setBotErr(err.message || "join failed");
    }
  }
  async function stopBot() {
    setBotErr("");
    try {
      await api.stopMeeting(id);
      setBotStatus("stopped");
      setBotLaunched(false);
    } catch (err: any) {
      setBotErr(err.message || "stop failed");
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
    }).catch(() => {});
    refreshSaved();

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
      } else if (m.type === "decision") {
        setLive((p) => [m as Decision, ...p]);
      }
    };
    ws.onclose = () => { setBadge("disconnected"); setReady(false); };

    let cleanup = () => {};
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

    return () => { cleanup(); ws.close(); };
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
              <Button onClick={joinBot} disabled={!meetingUrl.trim()}>
                Join bot
              </Button>
              <Button variant="ghost" onClick={stopBot} disabled={!botLaunched}>
                Stop bot
              </Button>
              {botStatus && <Badge variant="neutral">{botStatus}</Badge>}
            </div>
            <p className="text-[13px] leading-relaxed text-fg-subtle">
              Admit &ldquo;Governance Bot&rdquo; in the call. It pins a chat message asking each
              person to type &ldquo;+&rdquo; to allow their own recording — no reply means
              they&rsquo;re not recorded.
            </p>
            {botErr && <p className="text-[13px] text-[#F87171]">{botErr}</p>}
          </Card>
        </section>

        {/* Mic controls */}
        <section>
          <Card className="flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-2 text-sm text-fg-muted">
              Speaker
              <select
                value={speaker}
                onChange={(e) => setSpeaker(e.target.value)}
                className="h-10 rounded-xl border border-border bg-elevated px-3 text-sm text-fg transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:border-brand"
              >
                <option value="you">You (consented)</option>
                <option value="guest">Guest (NOT consented)</option>
              </select>
            </label>
            <Button
              variant={talking ? "danger" : "primary"}
              disabled={!ready}
              icon={<Mic size={16} aria-hidden="true" />}
              className={cn("select-none", talking && "bg-[rgba(248,113,113,0.12)] border-[#F87171]")}
              onMouseDown={start}
              onMouseUp={stop}
              onMouseLeave={stop}
              onTouchStart={(e) => { e.preventDefault(); start(); }}
              onTouchEnd={(e) => { e.preventDefault(); stop(); }}
            >
              {talking ? "Listening…" : "Hold to talk"}
            </Button>
            <span className="text-[13px] text-fg-subtle">
              Switch to &ldquo;Guest&rdquo; to see the consent gate decline it.
            </span>
          </Card>
        </section>

        {/* Participants & consent */}
        <section>
          <SectionTitle icon={<Users size={16} aria-hidden="true" />}>
            Participants &amp; consent
          </SectionTitle>
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
                        p.consent ? "text-brand" : "text-[#F87171]"
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
                    <Badge mono variant="neutral">{d.policy_id}</Badge>
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
                onClick={shred}
                icon={<Lock size={14} aria-hidden="true" />}
              >
                Crypto-shred
              </Button>
            </div>
          </div>
          <p className="mb-3 text-[13px] leading-relaxed text-fg-subtle">
            Kept text is stored encrypted per meeting; dropped/declined lines hold no text
            (&ldquo;—&rdquo;). Crypto-shred destroys the meeting key — stored text becomes
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
                    <Badge mono variant="neutral">{l.policyId || "-"}</Badge>
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
                        unreadable — key destroyed
                      </>
                    ) : (
                      l.text ?? "—"
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </AppShell>
  );
}

function isMonoAction(action: string): boolean {
  const a = action?.toUpperCase();
  return a === "COMMIT" || a === "REDACT";
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
