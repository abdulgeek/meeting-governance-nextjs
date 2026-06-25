"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, setToken } from "../lib/api";

export default function Login() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    setBusy(true);
    try {
      const res = mode === "login"
        ? await api.login(email, password)
        : await api.register(email, password);
      setToken(res.accessToken);
      router.push("/");
    } catch (e: any) {
      setErr(e.message || "failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="wrap">
      <div className="center card-box">
        <h1>Meeting Governance</h1>
        <div className="sub">Sign {mode === "login" ? "in" : "up"} to run governed meetings.</div>
        <form className="stack" onSubmit={submit} style={{ marginTop: 16 }}>
          <input type="email" placeholder="email" value={email}
            onChange={(e) => setEmail(e.target.value)} required />
          <input type="password" placeholder="password (min 6 chars)" value={password}
            onChange={(e) => setPassword(e.target.value)} required />
          {err && <div className="err">{err}</div>}
          <button className="btn-primary" disabled={busy}>
            {busy ? "…" : mode === "login" ? "Sign in" : "Create account"}
          </button>
        </form>
        <div className="muted" style={{ marginTop: 12 }}>
          {mode === "login" ? (
            <>No account?{" "}
              <a style={{ cursor: "pointer" }} onClick={() => setMode("register")}>Register</a></>
          ) : (
            <>Have an account?{" "}
              <a style={{ cursor: "pointer" }} onClick={() => setMode("login")}>Sign in</a></>
          )}
        </div>
      </div>
    </div>
  );
}
