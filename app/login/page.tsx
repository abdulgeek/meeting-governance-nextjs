"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, setToken } from "../lib/api";
import {
  Button,
  Card,
  Field,
  Input,
  Hero,
  Logo,
  ThemeToggle,
} from "../components";

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

  const isLogin = mode === "login";

  return (
    <div className="relative min-h-screen overflow-hidden bg-bg text-fg">
      {/* Theme toggle, pinned top-right */}
      <div className="absolute right-4 top-4 z-10">
        <ThemeToggle />
      </div>

      <div className="mx-auto grid min-h-screen max-w-5xl items-center gap-10 px-6 py-12 lg:grid-cols-2">
        {/* Brand panel — hidden on small screens */}
        <div className="hidden flex-col justify-center lg:flex">
          <Logo size={32} />
          <div className="mt-10 max-w-md">
            <Hero />
          </div>
          <h2 className="mt-10 text-2xl font-semibold tracking-tight text-fg">
            Decide what gets recorded
            <br />
            before it&apos;s written down.
          </h2>
          <p className="mt-3 max-w-sm text-sm leading-relaxed text-fg-muted">
            Real-time meeting governance — consent, redaction, and
            crypto-shredding, decided live as people speak.
          </p>
        </div>

        {/* Auth card */}
        <div className="flex flex-col items-center">
          {/* Compact logo for small screens */}
          <div className="mb-6 lg:hidden">
            <Logo size={30} />
          </div>

          <Card className="w-full max-w-sm">
            <h1 className="text-xl font-semibold tracking-tight text-fg">
              {isLogin ? "Sign in" : "Create account"}
            </h1>
            <p className="mt-1 text-sm text-fg-muted">
              {isLogin
                ? "Sign in to run governed meetings."
                : "Sign up to run governed meetings."}
            </p>

            <form className="mt-6 flex flex-col gap-4" onSubmit={submit}>
              <Field label="Email" htmlFor="email">
                <Input
                  id="email"
                  type="email"
                  placeholder="you@company.com"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </Field>

              <Field label="Password" htmlFor="password" hint="Minimum 6 characters.">
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  autoComplete={isLogin ? "current-password" : "new-password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </Field>

              {err && (
                <p role="alert" className="text-[13px] text-danger">
                  {err}
                </p>
              )}

              <Button type="submit" loading={busy} className="w-full">
                {isLogin ? "Sign in" : "Create account"}
              </Button>
            </form>

            <p className="mt-5 text-center text-sm text-fg-muted">
              {isLogin ? "No account? " : "Have an account? "}
              <button
                type="button"
                onClick={() => {
                  setErr("");
                  setMode(isLogin ? "register" : "login");
                }}
                className="font-medium text-brand underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand rounded"
              >
                {isLogin ? "Register" : "Sign in"}
              </button>
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}
