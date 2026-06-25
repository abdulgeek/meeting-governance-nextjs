// Tiny client for the NestJS product API + JWT handling. The engine WebSocket URL
// lives here too so pages import one module.

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
export const WS_URL = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8000/ws";
export const API_URL = API;

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

export type Meeting = {
  _id: string; title: string; status: string; createdAt?: string;
  meetingUrl?: string; recallBotId?: string; botStatus?: string;
};
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

// ---- Governed summary (feature 1) ----------------------------------------
// GET returns the stored summary (decrypted server-side). If the meeting key
// was crypto-shredded, the summary is unrecoverable -> shredded:true.
export type SummaryResponse = {
  summary: string | null;
  shredded: boolean;
  generatedAt: string | null;
};

// ---- Audit / consent receipts (feature 2) --------------------------------
// Content-free: counts only, never the words.
export type ActionCounts = {
  COMMIT: number;
  REDACT: number;
  FLAG: number;
  DROP: number;
  DECLINE: number;
};
export type AuditParticipant = {
  name: string;
  email?: string;
  consent: boolean;
  optedInAt?: string;
  counts: ActionCounts;
  total: number;
};
export type AuditResponse = {
  meeting: { id: string; title: string };
  participants: AuditParticipant[];
  totals: ActionCounts;
  integrity: { algo: string; hash: string };
};

// ---- Self-service DSAR (feature 5) ---------------------------------------
// Owner-scoped. identity = email-when-known else name. Erasure is per-MEETING
// (shreds whole meetings containing the person) — true per-line erasure needs
// per-participant keys (future).
export type DsarLine = { idx: number; action: string; text?: string | null };
export type DsarMeeting = {
  meetingId: string;
  title: string;
  consent: boolean;
  lines: DsarLine[];
};
export type DsarLookupResponse = {
  identity: string;
  meetings: DsarMeeting[];
  counts: { meetings: number; lines: number };
};
export type DsarEraseResponse = { erased: string[]; note: string };

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
  joinMeeting: (id: string, meetingUrl: string, separate = true): Promise<{ botId: string; status: string }> =>
    req(`/meetings/${id}/join`, { method: "POST", body: JSON.stringify({ meetingUrl, separate }) }),
  stopMeeting: (id: string): Promise<{ ok: boolean }> =>
    req(`/meetings/${id}/stop`, { method: "POST" }),

  // ---- Governed summary (feature 1) --------------------------------------
  generateSummary: (id: string): Promise<{ summary: string }> =>
    req(`/meetings/${id}/summary`, { method: "POST" }),
  getSummary: (id: string): Promise<SummaryResponse> =>
    req(`/meetings/${id}/summary`),

  // ---- Audit / consent receipts (feature 2) ------------------------------
  getAudit: (id: string): Promise<AuditResponse> => req(`/meetings/${id}/audit`),

  // ---- Self-service DSAR (feature 5) -------------------------------------
  dsarLookup: (identity: string): Promise<DsarLookupResponse> =>
    req(`/dsar?identity=${encodeURIComponent(identity)}`),
  dsarErase: (identity: string): Promise<DsarEraseResponse> =>
    req(`/dsar/erase`, { method: "POST", body: JSON.stringify({ identity }) }),
};

// Fetch a file from a guarded endpoint (the API needs the JWT header, so a
// plain <a href> won't work) and trigger a browser download. Used for the
// audit JSON/CSV exports — content-free, counts only.
async function downloadFile(path: string, filename: string, accept?: string) {
  const token = getToken();
  const res = await fetch(`${API}${path}`, {
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(accept ? { Accept: accept } : {}),
    },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// Download the content-free audit as JSON or CSV (one row per participant).
export function downloadAudit(id: string, format: "json" | "csv") {
  if (format === "csv") {
    return downloadFile(
      `/meetings/${id}/audit?format=csv`,
      `audit-${id}.csv`,
      "text/csv",
    );
  }
  return downloadFile(`/meetings/${id}/audit`, `audit-${id}.json`, "application/json");
}

// Download a DSAR lookup result as JSON (caller-scoped, kept lines only).
export function downloadDsar(data: DsarLookupResponse) {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `dsar-${data.identity}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
