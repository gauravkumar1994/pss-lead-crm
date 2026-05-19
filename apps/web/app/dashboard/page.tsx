"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { PageSpinner } from "@/components/ui/PageSpinner";

type Stats = {
  totalLeads: number;
  todayFollowups: number;
  overdueFollowups: number;
  convertedLeads: number;
  myCallsToday: number;
  myWhatsAppToday: number;
  teamCalls: { userId: string; userName: string; count: number }[];
  byStage: { stage: string; count: number }[];
  recentCampaigns: {
    id: string;
    name: string;
    status: string;
    totalLeads: number;
    successCount: number;
    failedCount: number;
  }[];
};

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api<Stats>("/dashboard/stats")
      .then(setStats)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading && !stats) {
    return <PageSpinner label="Loading dashboard…" />;
  }

  return (
    <>
      <div className="brand-hero animate-fade-in">
        <div>
          <h2>PSS SOLUTION</h2>
          <p>Lead management · WhatsApp · Follow-ups · Team reports</p>
        </div>
        <Link href="/bulk" className="btn btn-wa">
          Bulk WhatsApp →
        </Link>
      </div>

      <div className="stat-grid">
        <div className="stat-card">
          <h3>{stats?.myCallsToday ?? "—"}</h3>
          <p>📞 Your calls today</p>
        </div>
        <div className="stat-card teal">
          <h3>{stats?.myWhatsAppToday ?? "—"}</h3>
          <p>💬 WhatsApp sent today</p>
        </div>
        <div className="stat-card">
          <h3>{stats?.totalLeads ?? "—"}</h3>
          <p>Active leads</p>
        </div>
        <Link href="/followups" className="stat-card warning" style={{ textDecoration: "none", color: "inherit" }}>
          <h3>{stats?.overdueFollowups ?? "—"}</h3>
          <p>Overdue follow-ups →</p>
        </Link>
        <Link href="/followups" className="stat-card" style={{ textDecoration: "none", color: "inherit" }}>
          <h3>{stats?.todayFollowups ?? "—"}</h3>
          <p>Follow-ups today →</p>
        </Link>
        <Link href="/quick-send" className="stat-card teal" style={{ textDecoration: "none", color: "inherit" }}>
          <h3>⚡</h3>
          <p>Quick Send WA</p>
        </Link>
      </div>

      {stats && stats.teamCalls.length > 0 && (
        <div className="card animate-fade-in" style={{ marginBottom: "1.25rem" }}>
          <h3 style={{ marginTop: 0 }}>📞 Team calls today</h3>
          <div className="stat-grid">
            {stats.teamCalls.map((t) => (
              <div key={t.userId} className="stat-card">
                <h3>{t.count}</h3>
                <p>{t.userName}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid-2">
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Pipeline by stage</h3>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
            {stats?.byStage.map((s) => (
              <span key={s.stage} className="badge badge-stage">
                {s.stage}: {s.count}
              </span>
            ))}
          </div>
        </div>
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Quick links</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            <Link href="/leads" className="btn btn-outline">
              👥 Manage leads
            </Link>
            <Link href="/bulk" className="btn btn-wa">
              📢 Bulk WhatsApp
            </Link>
            <Link href="/settings" className="btn btn-outline">
              ⚙️ API settings
            </Link>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: "1rem" }}>
        <h3 style={{ marginTop: 0 }}>Recent bulk campaigns</h3>
        <table className="table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Status</th>
              <th>Total</th>
              <th>OK</th>
              <th>Fail</th>
            </tr>
          </thead>
          <tbody>
            {stats?.recentCampaigns.map((c) => (
              <tr key={c.id}>
                <td>
                  <Link href={`/campaigns?id=${c.id}`}>{c.name}</Link>
                </td>
                <td>
                  <span className="badge badge-stage">{c.status}</span>
                </td>
                <td>{c.totalLeads}</td>
                <td style={{ color: "var(--wa-green-bright)" }}>{c.successCount}</td>
                <td style={{ color: "var(--wa-danger)" }}>{c.failedCount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}