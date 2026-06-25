"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, getToken, WS_URL, Line, Participant } from "../../lib/api";

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
      const r = await api.joinMeeting(id, url);
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

  return (
    <div className="wrap">
      <div className="row">
        <div>
          <h1>{title || "Meeting"}<span className="badge">{badge}</span></h1>
          <div className="sub">Hold Talk and speak. Decisions are made live; only governed output is saved.</div>
        </div>
        <Link href="/" className="btn-ghost" style={{ padding: "10px 14px", border: "1px solid #2a313c", borderRadius: 9 }}>← Dashboard</Link>
      </div>

      <h2>Join a live meeting</h2>
      <div className="card-box stack">
        <input
          placeholder="Paste a Zoom / Google Meet / Teams URL"
          value={meetingUrl}
          onChange={(e) => setMeetingUrl(e.target.value)}
        />
        <div className="controls" style={{ margin: 0 }}>
          <button className="btn-primary" onClick={joinBot} disabled={!meetingUrl.trim()}>
            Join bot
          </button>
          <button className="btn-ghost" onClick={stopBot} disabled={!botLaunched}>
            Stop bot
          </button>
          {botStatus && <span className="badge">{botStatus}</span>}
        </div>
        <div className="hint">Admit “Governance Bot” in the call, then type “I consent” in chat.</div>
        {botErr && <div className="err">{botErr}</div>}
      </div>

      <div className="controls">
        <label>Speaker:{" "}
          <select value={speaker} onChange={(e) => setSpeaker(e.target.value)}>
            <option value="you">You (consented)</option>
            <option value="guest">Guest (NOT consented)</option>
          </select>
        </label>
        <button className={`talk${talking ? " live" : ""}`} disabled={!ready}
          onMouseDown={start} onMouseUp={stop} onMouseLeave={stop}
          onTouchStart={(e) => { e.preventDefault(); start(); }}
          onTouchEnd={(e) => { e.preventDefault(); stop(); }}>
          {talking ? "● Listening…" : "● Hold to talk"}
        </button>
        <span className="hint">switch to “Guest” to see the consent gate decline it</span>
      </div>

      <h2>Participants &amp; consent</h2>
      {participants.length === 0 ? (
        <div className="empty">No participants yet — opt-ins appear here as people consent.</div>
      ) : (
        <div className="mlist">
          {participants.map((p) => (
            <div key={p.name} className="mitem">
              <span>{p.name}</span>
              <span className="tag" style={{ color: p.consent ? "#3fb950" : "#f85149" }}>
                {p.consent ? "✓ consented" : "✗ declined"}
              </span>
            </div>
          ))}
        </div>
      )}

      <h2>Live decisions</h2>
      {live.length === 0 ? (
        <div className="empty">Nothing yet — hold Talk and say a sentence.</div>
      ) : (
        <div className="feed">
          {live.map((d) => (
            <div key={d.idx} className={`card a-${d.action}`}>
              <div className="meta">#{d.idx} · {d.speaker} · <span className="tag">{d.action}</span> · {d.policy_id} · conf {d.confidence.toFixed(2)}</div>
              <div className="text">{d.shown}</div>
            </div>
          ))}
        </div>
      )}

      <div className="row">
        <h2>Saved transcript (in MongoDB)</h2>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn-ghost" onClick={refreshSaved}>Refresh</button>
          <button className="btn-ghost" onClick={shred}>🔒 Crypto-shred</button>
        </div>
      </div>
      <div className="muted" style={{ marginBottom: 8 }}>
        Kept text is stored encrypted per meeting; dropped/declined lines hold no text (“—”).
        Crypto-shred destroys the meeting key — stored text becomes permanently unreadable.
      </div>
      {saved.length === 0 ? (
        <div className="empty">No saved lines yet.</div>
      ) : (
        <div className="feed">
          {saved.map((l) => (
            <div key={l.idx} className={`card a-${l.action}`}>
              <div className="meta">#{l.idx} · {l.speaker} · <span className="tag">{l.action}</span> · {l.policyId || "-"}</div>
              <div className="text">{l.shredded ? "🔒 unreadable — key destroyed" : (l.text ?? "—")}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
