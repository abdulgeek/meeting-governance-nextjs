"use client";

import { useEffect, useRef, useState } from "react";

type Decision = {
  idx: number;
  speaker: string;
  action: string;
  policy_id: string;
  confidence: number;
  shown: string;
};

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8000/ws";

function downsample(buf: Float32Array, inRate: number): Float32Array {
  if (inRate === 16000) return buf;
  const ratio = inRate / 16000;
  const outLen = Math.floor(buf.length / ratio);
  const out = new Float32Array(outLen);
  for (let i = 0; i < outLen; i++) out[i] = buf[Math.floor(i * ratio)];
  return out;
}

function floatToInt16(buf: Float32Array): Int16Array {
  const out = new Int16Array(buf.length);
  for (let i = 0; i < buf.length; i++) {
    const s = Math.max(-1, Math.min(1, buf[i]));
    out[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return out;
}

export default function Home() {
  const [ready, setReady] = useState(false);
  const [badge, setBadge] = useState("connecting…");
  const [speaker, setSpeaker] = useState("you");
  const [talking, setTalking] = useState(false);
  const [decisions, setDecisions] = useState<Decision[]>([]);

  const wsRef = useRef<WebSocket | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const recordingRef = useRef(false);
  const speakerRef = useRef("you");

  useEffect(() => {
    speakerRef.current = speaker;
  }, [speaker]);

  useEffect(() => {
    const ws = new WebSocket(WS_URL);
    ws.binaryType = "arraybuffer";
    wsRef.current = ws;

    ws.onopen = () =>
      ws.send(JSON.stringify({ type: "config", consent: { you: true, guest: false } }));
    ws.onmessage = (e) => {
      const m = JSON.parse(e.data);
      if (m.type === "ready") {
        setBadge(`${m.engine} · ${String(m.model).split(".").pop()}`);
        setReady(true);
      } else if (m.type === "decision") {
        setDecisions((prev) => [m as Decision, ...prev]);
      }
    };
    ws.onclose = () => {
      setBadge("disconnected");
      setReady(false);
    };

    let cleanupMic = () => {};
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
        ctxRef.current = ctx;
        const source = ctx.createMediaStreamSource(stream);
        const processor = ctx.createScriptProcessor(4096, 1, 1);
        processor.onaudioprocess = (e) => {
          if (!recordingRef.current || ws.readyState !== 1) return;
          const input = e.inputBuffer.getChannelData(0);
          ws.send(floatToInt16(downsample(input, ctx.sampleRate)).buffer);
        };
        source.connect(processor);
        processor.connect(ctx.destination);
        cleanupMic = () => {
          processor.disconnect();
          source.disconnect();
          stream.getTracks().forEach((t) => t.stop());
        };
      } catch (err) {
        setBadge("mic blocked");
        console.error(err);
      }
    })();

    return () => {
      cleanupMic();
      ctxRef.current?.close();
      ws.close();
    };
  }, []);

  const startTalk = () => {
    if (!ready) return;
    recordingRef.current = true;
    setTalking(true);
    wsRef.current?.send(JSON.stringify({ type: "speaker", id: speakerRef.current }));
  };
  const stopTalk = () => {
    if (!recordingRef.current) return;
    recordingRef.current = false;
    setTalking(false);
    wsRef.current?.send(JSON.stringify({ type: "eou" }));
  };

  return (
    <div className="wrap">
      <header>
        <h1>
          Meeting Governance — live<span className="badge">{badge}</span>
        </h1>
        <div className="sub">
          Hold <b>Talk</b>, say a sentence, release. It transcribes, judges it against the
          policies, and decides — commit / drop / redact / flag / decline — before anything is
          written down.
        </div>
      </header>

      <div className="controls">
        <label>
          Speaker:{" "}
          <select value={speaker} onChange={(e) => setSpeaker(e.target.value)}>
            <option value="you">You (consented)</option>
            <option value="guest">Guest (NOT consented)</option>
          </select>
        </label>
        <button
          className={`talk${talking ? " live" : ""}`}
          disabled={!ready}
          onMouseDown={startTalk}
          onMouseUp={stopTalk}
          onMouseLeave={stopTalk}
          onTouchStart={(e) => {
            e.preventDefault();
            startTalk();
          }}
          onTouchEnd={(e) => {
            e.preventDefault();
            stopTalk();
          }}
        >
          {talking ? "● Listening…" : "● Hold to talk"}
        </button>
        <span className="hint">switch to “Guest” to watch the consent gate decline it</span>
      </div>

      {decisions.length === 0 ? (
        <div className="empty">No decisions yet — hold Talk and say something.</div>
      ) : (
        <div className="feed">
          {decisions.map((d) => (
            <div key={d.idx} className={`card a-${d.action}`}>
              <div className="meta">
                #{d.idx} · {d.speaker} · <span className="tag">{d.action}</span> · {d.policy_id} ·
                conf {d.confidence.toFixed(2)}
              </div>
              <div className="text">{d.shown}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
