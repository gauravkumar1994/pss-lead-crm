"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { useClientAuth } from "@/lib/auth-store";
import { PageSpinner } from "@/components/ui/PageSpinner";

type Stats = {
  totalLeads: number;
  todayFollowups: number;
  overdueFollowups: number;
  convertedLeads: number;
  myCallsToday: number;
  myWhatsAppToday: number;
  scopeLabel?: string;
  teamCalls: { userId: string; userName: string; count: number }[];
  viewAllTeam?: boolean;
  teamUserReport?: {
    userId: string;
    userCode: string;
    fullName: string;
    role: string;
    activeLeads: number;
    callsToday: number;
    waToday: number;
  }[];
  recentActivities?: {
    id: string;
    type: string;
    content: string;
    remarkType?: string | null;
    createdAt: string;
    userName: string;
    leadCode: string;
    leadName: string;
  }[];
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
  const { role } = useClientAuth();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const isAdminView = role === "ADMIN" || role === "MANAGER";

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
          <p>{stats?.scopeLabel ?? "Lead CRM"}</p>
        </div>
        {isAdminView && (
          <Link href="/users" className="btn btn-outline">
            Manage users →
          </Link>
        )}
        {!isAdminView && (
          <Link href="/quick-send" className="btn btn-wa">
            Quick WhatsApp →
          </Link>
        )}
      </div>

      <div className="stat-grid">
        <div className="stat-card">
          <h3>{stats?.myCallsToday ?? "—"}</h3>
          <p>{isAdminView ? "📞 Team calls today (all)" : "📞 Your calls today"}</p>
        </div>
        <div className="stat-card teal">
          <h3>{stats?.myWhatsAppToday ?? "—"}</h3>
          <p>{isAdminView ? "💬 Your WA today" : "💬 WhatsApp sent today"}</p>
        </div>
        <div className="stat-card">
          <h3>{stats?.totalLeads ?? "—"}</h3>
          <p>{isAdminView ? "Active leads (all users)" : "Your active leads"}</p>
        </div>
        <Link href="/followups" className="stat-card warning" style={{ textDecoration: "none", color: "inherit" }}>
          <h3>{stats?.overdueFollowups ?? "—"}</h3>
          <p>Overdue follow-ups →</p>
        </Link>
        <Link href="/followups" className="stat-card" style={{ textDecoration: "none", color: "inherit" }}>
          <h3>{stats?.todayFollowups ?? "—"}</h3>
          <p>Follow-ups today →</p>
        </Link>
        <Link href="/leads" className="stat-card teal" style={{ textDecoration: "none", color: "inherit" }}>
          <h3>{stats?.convertedLeads ?? "—"}</h3>
          <p>Converted →</p>
        </Link>
      </div>

      {isAdminView && stats?.teamUserReport && stats.teamUserReport.length > 0 && (
        <div className="card animate-fade-in" style={{ marginBottom: "1.25rem" }}>
          <h3 style={{ marginTop: 0 }}>👥 Team activity report (all users)</h3>
          <p className="wa-hint" style={{ marginTop: 0 }}>
            Har user ke active leads, aaj ke calls aur WhatsApp activity ki ek nazar.
          </p>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Name</th>
                  <th>Role</th>
                  <th>Active leads</th>
                  <th>Calls today</th>
                  <th>WA today</th>
                </tr>
              </thead>
              <tbody>
                {stats.teamUserReport.map((u) => (
                  <tr key={u.userId}>
                    <td>{u.userCode}</td>
                    <td>{u.fullName}</td>
                    <td>
                      <span className="badge badge-stage">{u.role}</span>
                    </td>
                    <td>{u.activeLeads}</td>
                    <td>{u.callsToday}</td>
                    <td>{u.waToday}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {stats && stats.recentActivities && stats.recentActivities.length > 0 && (
        <div className="card animate-fade-in" style={{ marginBottom: "1.25rem" }}>
          <h3 style={{ marginTop: 0 }}>
            {stats.viewAllTeam ? "📋 Team activity feed (all users)" : "📋 Your activity only"}
          </h3>
          <ul className="timeline">
            {stats.recentActivities.map((a) => (
              <li key={a.id}>
                <strong>{a.userName}</strong> · {a.leadName}
                <br />
                <span className="badge badge-stage">{a.type}</span>
                {a.remarkType ? ` · ${a.remarkType}` : ""} — {a.content}
                <div className="meta">{new Date(a.createdAt).toLocaleString()}</div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {stats && stats.teamCalls.length > 0 && (
        <div className="card animate-fade-in" style={{ marginBottom: "1.25rem" }}>
          <h3 style={{ marginTop: 0 }}>📞 Calls today by user</h3>
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
              👥 {isAdminView ? "All leads" : "My leads"}
            </Link>
            {isAdminView && (
              <>
                <Link href="/bulk" className="btn btn-wa">
                  📢 Bulk WhatsApp
                </Link>
                <Link href="/reports" className="btn btn-outline">
                  📊 Call reports (team)
                </Link>
              </>
            )}
            <Link href="/quick-send" className="btn btn-wa">
              ⚡ Quick Send
            </Link>
          </div>
        </div>
      </div>

      {isAdminView && stats?.recentCampaigns && stats.recentCampaigns.length > 0 && (
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
              {stats.recentCampaigns.map((c) => (
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
      )}
    </>
  );
}
