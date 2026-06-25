"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api, getToken, clearToken, Meeting } from "./lib/api";

export default function Dashboard() {
  const router = useRouter();
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [title, setTitle] = useState("");
  const [err, setErr] = useState("");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!getToken()) { router.replace("/login"); return; }
    api.listMeetings()
      .then((m) => { setMeetings(m); setReady(true); })
      .catch((e) => setErr(e.message));
  }, []);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    try {
      const m = await api.createMeeting(title.trim() || "Untitled meeting");
      router.push(`/meeting/${m._id}`);
    } catch (e: any) {
      setErr(e.message);
    }
  }
  function logout() { clearToken(); router.replace("/login"); }

  if (!ready) return <div className="wrap"><div className="muted">Loading…</div></div>;

  return (
    <div className="wrap">
      <div className="row">
        <div>
          <h1>Your meetings</h1>
          <div className="sub">Start a governed meeting — decisions are made live, and only governed output is stored.</div>
        </div>
        <button className="btn-ghost" onClick={logout}>Log out</button>
      </div>

      <form className="row" onSubmit={create} style={{ marginTop: 18, gap: 10 }}>
        <input placeholder="New meeting title" value={title}
          onChange={(e) => setTitle(e.target.value)} style={{ flex: 1 }} />
        <button className="btn-primary">Start meeting</button>
      </form>
      {err && <div className="err">{err}</div>}

      <h2>Recent</h2>
      {meetings.length === 0 ? (
        <div className="empty">No meetings yet — start one above.</div>
      ) : (
        <div className="mlist">
          {meetings.map((m) => (
            <Link key={m._id} href={`/meeting/${m._id}`} className="mitem">
              <span>{m.title}</span>
              <span className="muted">{m.status}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
