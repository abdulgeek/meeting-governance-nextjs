// Tiny client for the NestJS product API + JWT handling. The engine WebSocket URL
// lives here too so pages import one module.

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
export const WS_URL = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8000/ws";

export function getToken(): string | null {
  return typeof window === "undefined" ? null : localStorage.getItem("token");
}
export function setToken(t: string) {
  localStorage.setItem("token", t);
}
export function clearToken() {
  localStorage.removeItem("token");
}

async function req(path: string, opts: RequestInit = {}) {
  const token = getToken();
  const res = await fetch(`${API}${path}`, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(opts.headers || {}),
    },
  });
  if (res.status === 401) {
    clearToken();
    if (typeof window !== "undefined") window.location.href = "/login";
    throw new Error("unauthorized");
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message || `HTTP ${res.status}`);
  }
  return res.status === 204 ? null : res.json();
}

export type Meeting = { _id: string; title: string; status: string; createdAt?: string };
export type Line = {
  idx: number;
  speaker: string;
  action: string;
  policyId?: string;
  confidence?: number;
  text?: string | null;
  shredded?: boolean;
};

export type Participant = { name: string; consent: boolean };

export const api = {
  register: (email: string, password: string) =>
    req("/auth/register", { method: "POST", body: JSON.stringify({ email, password }) }),
  login: (email: string, password: string) =>
    req("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }),
  listMeetings: (): Promise<Meeting[]> => req("/meetings"),
  createMeeting: (title: string): Promise<Meeting> =>
    req("/meetings", { method: "POST", body: JSON.stringify({ title }) }),
  getMeeting: (id: string): Promise<Meeting> => req(`/meetings/${id}`),
  getLines: (id: string): Promise<Line[]> => req(`/meetings/${id}/lines`),
  participants: (id: string): Promise<Participant[]> => req(`/meetings/${id}/participants`),
  shred: (id: string) => req(`/meetings/${id}/key`, { method: "DELETE" }),
};
