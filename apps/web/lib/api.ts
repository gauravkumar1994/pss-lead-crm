/** Browser: same-origin /api proxy. Server/build: full API URL. */
function resolveApiBase(): string {
  const env = (process.env.NEXT_PUBLIC_API_URL ?? "").trim();
  if (env === "/api" || (env.startsWith("/") && !env.startsWith("//"))) {
    return env.replace(/\/$/, "") || "/api";
  }
  if (env.startsWith("http")) return env.replace(/\/$/, "");
  if (typeof window !== "undefined") return "/api";
  return (
    process.env.API_PROXY_TARGET ??
    "https://pss-crm-api.onrender.com"
  ).replace(/\/$/, "");
}

const API = resolveApiBase();

const RETRIES = 6;
const RETRY_MS = 3000;

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchWithRetry(input: string, init?: RequestInit): Promise<Response> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < RETRIES; attempt++) {
    try {
      return await fetch(input, init);
    } catch (e) {
      lastErr = e;
      if (attempt < RETRIES - 1) await sleep(RETRY_MS);
    }
  }
  throw lastErr;
}

export function getApiBaseUrl(): string {
  return API;
}

export async function checkApiHealth(): Promise<boolean> {
  try {
    const r = await fetchWithRetry(`${API}/health`, { cache: "no-store" });
    return r.ok;
  } catch {
    return false;
  }
}

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("crm_token");
}

export function setToken(token: string | null) {
  if (token) localStorage.setItem("crm_token", token);
  else localStorage.removeItem("crm_token");
}

export async function api<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken();
  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...(options.headers ?? {}),
  };
  if (token) (headers as Record<string, string>)["Authorization"] = `Bearer ${token}`;

  let res: Response;
  try {
    res = await fetchWithRetry(`${API}${path}`, { ...options, headers });
  } catch {
    throw new Error(
      "Server abhi start ho raha hai — 1 minute wait karke dubara Sign in dabao. (Pehli baar thoda slow ho sakta hai.)"
    );
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? res.statusText);
  return data as T;
}

export async function apiUpload<T>(path: string, formData: FormData): Promise<T> {
  const token = getToken();
  const headers: HeadersInit = {};
  if (token) (headers as Record<string, string>)["Authorization"] = `Bearer ${token}`;

  let res: Response;
  try {
    res = await fetchWithRetry(`${API}${path}`, { method: "POST", headers, body: formData });
  } catch {
    throw new Error("Upload fail — thodi der baad dubara try karo.");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? res.statusText);
  return data as T;
}

/** Download a file (CSV, etc.) from API with auth. Triggers browser save dialog. */
export async function apiDownload(path: string, filename: string): Promise<void> {
  const token = getToken();
  const headers: HeadersInit = {};
  if (token) (headers as Record<string, string>)["Authorization"] = `Bearer ${token}`;

  let res: Response;
  try {
    res = await fetchWithRetry(`${API}${path}`, { headers, cache: "no-store" });
  } catch {
    throw new Error("Download fail — server start ho raha ho sakta hai, thodi der baad try karo.");
  }

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data as { error?: string }).error ?? `Export failed (${res.status})`);
  }

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
