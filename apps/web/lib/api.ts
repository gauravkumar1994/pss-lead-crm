const API = process.env.NEXT_PUBLIC_API_URL ?? "https://pss-crm-api.onrender.com";

const RETRIES = 5;
const RETRY_MS = 2500;

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

/** Free tier cold start: first fetch often fails — retry before showing error. */
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
      "Abhi server respond nahi kar paaya — page refresh karke dubara try karo. (Free hosting par pehli request 1-2 minute tak bhi lag sakti hai.)"
    );
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? res.statusText);
  return data as T;
}

/** Multipart upload (photos) — no JSON Content-Type. */
export async function apiUpload<T>(path: string, formData: FormData): Promise<T> {
  const token = getToken();
  const headers: HeadersInit = {};
  if (token) (headers as Record<string, string>)["Authorization"] = `Bearer ${token}`;

  let res: Response;
  try {
    res = await fetchWithRetry(`${API}${path}`, { method: "POST", headers, body: formData });
  } catch {
    throw new Error(
      "Upload fail — network busy. Thodi der baad dubara try karo ya page refresh karo."
    );
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? res.statusText);
  return data as T;
}
