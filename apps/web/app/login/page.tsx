"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, setToken } from "@/lib/api";
import { setStoredUser } from "@/lib/auth-store";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("admin123");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [serverOk, setServerOk] = useState<boolean | null>(null);

  useEffect(() => {
    const base = process.env.NEXT_PUBLIC_API_URL ?? "https://pss-crm-api.onrender.com";
    fetch(`${base}/health`)
      .then((r) => r.ok)
      .then(setServerOk)
      .catch(() => setServerOk(false));
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

        {serverOk === false && (
          <div className="alert-error">
            API server se connect nahi ho pa raha. 30-60 sec baad retry karo, phir{" "}
            <a href={`${process.env.NEXT_PUBLIC_API_URL ?? "https://pss-crm-api.onrender.com"}/health`} target="_blank" rel="noreferrer">
              health check
            </a>
          </div>
        )}
        {serverOk === true && <p className="alert-success">Server connected</p>}

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
