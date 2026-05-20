"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, getApiBaseUrl, setToken } from "@/lib/api";
import { setStoredUser } from "@/lib/auth-store";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("admin123");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [serverOk, setServerOk] = useState<boolean | null>(null);

  useEffect(() => {
    const base = getApiBaseUrl();
    let cancelled = false;

    async function pollHealth() {
      // Cold start: poll ~2 min before showing red error (free Render)
      const maxTries = 40;
      const delayMs = 3000;
      for (let i = 0; i < maxTries; i++) {
        if (cancelled) return;
        try {
          const r = await fetch(`${base}/health`, { cache: "no-store" });
          if (r.ok) {
            if (!cancelled) setServerOk(true);
            return;
          }
        } catch {
          /* still waking up */
        }
        await new Promise((r) => setTimeout(r, delayMs));
      }
      if (!cancelled) setServerOk(false);
    }

    void pollHealth();
    return () => {
      cancelled = true;
    };
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await api<{
        token: string;
        user: {
          id: string;
          userCode: string;
          username: string;
          fullName: string;
          role: "ADMIN" | "MANAGER" | "USER";
          department?: string;
        };
      }>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ username, password }),
      });
      setToken(res.token);
      setStoredUser(res.user);
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <header className="login-brand">
          <h1 className="brand-title">PSS SOLUTION</h1>
          <p className="brand-sub">Pinnacle Software Solutions</p>
          <p className="login-tagline">Lead CRM · WhatsApp · Follow-ups</p>
        </header>

        {serverOk === null && (
          <p className="alert-info login-warmup">
            Server start ho rahi hai… thoda wait karo (free plan par 30 sec–2 min lag sakta hai).
            Phir login ho jayega.
          </p>
        )}
        {serverOk === false && (
          <div className="alert-error">
            Abhi bhi API respond nahi kar rahi. Page refresh karo ya 1–2 minute baad dubara
            try karo.{" "}
            <a href={`${getApiBaseUrl()}/health`} target="_blank" rel="noreferrer">
              Health check
            </a>
          </div>
        )}
        {serverOk === true && <p className="alert-success">Server connected — aap login kar sakte ho</p>}

        <form onSubmit={onSubmit} className="login-form">
          <div className="form-group">
            <label>Username</label>
            <input
              className="form-control"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
            />
          </div>
          <div className="form-group">
            <label>Password</label>
            <input
              className="form-control"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </div>
          {error && <div className="alert-error">{error}</div>}
          <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>
        <p className="login-demo">Demo: admin / admin123</p>
      </div>
    </div>
  );
}
