"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { PageSpinner } from "@/components/ui/PageSpinner";

type FLead = {
  id: string;
  leadCode: string;
  name: string;
  mobile: string;
  city?: string;
  stage: string;
  leadType: string;
  nextFollowup?: string;
  assignedUser?: { fullName: string };
};

type Bucket = { count: number; items: FLead[] };

type FollowupData = {
  overdue: Bucket;
  today: Bucket;
  upcoming: Bucket;
  noFollowupDate: Bucket;
};

function LeadTable({ items, highlight }: { items: FLead[]; highlight?: "overdue" | "today" }) {
  if (!items.length) return <p className="empty-hint">No leads in this list.</p>;
  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>
            <th>Code</th>
            <th>Name</th>
            <th>Mobile</th>
            <th>Due</th>
            <th>Stage</th>
            <th>Assigned</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {items.map((l) => (
            <tr key={l.id} className={highlight === "overdue" ? "row-overdue" : undefined}>
              <td>{l.leadCode}</td>
              <td>{l.name}</td>
              <td>{l.mobile}</td>
              <td>
                {l.nextFollowup
                  ? new Date(l.nextFollowup).toLocaleString()
                  : "—"}
              </td>
              <td>
                <span className="badge badge-stage">{l.stage}</span>
              </td>
              <td>{l.assignedUser?.fullName ?? "—"}</td>
              <td>
                <Link href={`/leads/${l.id}`} className="btn btn-outline btn-sm">
                  Open
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function FollowupsPage() {
  const [tab, setTab] = useState<"overdue" | "today" | "upcoming" | "none">("today");
  const [data, setData] = useState<FollowupData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  function load() {
    setLoading(true);
    setError("");
    api<FollowupData>("/followups")
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load"))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, []);

  const tabs = [
    { id: "overdue" as const, label: "Overdue", count: data?.overdue.count ?? 0, danger: true },
    { id: "today" as const, label: "Today", count: data?.today.count ?? 0 },
    { id: "upcoming" as const, label: "Upcoming", count: data?.upcoming.count ?? 0 },
    { id: "none" as const, label: "No date", count: data?.noFollowupDate.count ?? 0 },
  ];

  const activeItems =
    tab === "overdue"
      ? data?.overdue.items ?? []
      : tab === "today"
        ? data?.today.items ?? []
        : tab === "upcoming"
          ? data?.upcoming.items ?? []
          : data?.noFollowupDate.items ?? [];

  return (
    <>
      <div className="followup-hero card">
        <div>
          <h3>Follow-up board</h3>
          <p>Overdue, today, and upcoming follow-ups. Add remarks from lead detail to reschedule.</p>
        </div>
        <button type="button" className="btn btn-wa" onClick={load}>
          Refresh
        </button>
      </div>

      <div className="followup-tabs">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`followup-tab ${tab === t.id ? "active" : ""} ${t.danger ? "tab-danger" : ""}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
            <span className="tab-count">{t.count}</span>
          </button>
        ))}
      </div>

      {error && <div className="alert-error">{error}</div>}

      <div className="card">
        {loading && !data ? (
          <PageSpinner label="Loading follow-ups…" />
        ) : (
          <LeadTable
            items={activeItems}
            highlight={tab === "overdue" ? "overdue" : tab === "today" ? "today" : undefined}
          />
        )}
      </div>
    </>
  );
}
