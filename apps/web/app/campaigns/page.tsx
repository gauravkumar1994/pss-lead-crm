"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { api } from "@/lib/api";

type Campaign = {
  id: string;
  campaignCode: string;
  name: string;
  status: string;
  totalLeads: number;
  successCount: number;
  failedCount: number;
  createdAt: string;
};

type Detail = Campaign & {
  message: string;
  recipients: {
    id: string;
    status: string;
    mobile: string;
    error?: string;
    lead?: { name: string; leadCode: string };
  }[];
};

function CampaignsContent() {
  const params = useSearchParams();
  const [items, setItems] = useState<Campaign[]>([]);
  const [detail, setDetail] = useState<Detail | null>(null);

  useEffect(() => {
    api<{ items: Campaign[] }>("/campaigns").then((r) => setItems(r.items));
    const id = params.get("id");
    if (id) api<Detail>(`/campaigns/${id}`).then(setDetail);
  }, [params]);

  return (
    <>
      <div className="card table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Code</th>
              <th>Name</th>
              <th>Status</th>
              <th>Total</th>
              <th>Success</th>
              <th>Failed</th>
              <th>Date</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {items.map((c) => (
              <tr key={c.id}>
                <td>{c.campaignCode}</td>
                <td>{c.name}</td>
                <td>
                  <span className="badge badge-stage">{c.status}</span>
                </td>
                <td>{c.totalLeads}</td>
                <td style={{ color: "var(--wa-green-dark)" }}>{c.successCount}</td>
                <td style={{ color: "var(--wa-danger)" }}>{c.failedCount}</td>
                <td>{new Date(c.createdAt).toLocaleDateString()}</td>
                <td>
                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    onClick={() => api<Detail>(`/campaigns/${c.id}`).then(setDetail)}
                  >
                    View
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {detail && (
        <div className="card" style={{ marginTop: "1rem" }}>
          <h3>
            {detail.name} — {detail.campaignCode}
          </h3>
          <p style={{ color: "var(--wa-muted)" }}>{detail.message.slice(0, 200)}…</p>
          <table className="table">
            <thead>
              <tr>
                <th>Lead</th>
                <th>Mobile</th>
                <th>Status</th>
                <th>Error</th>
              </tr>
            </thead>
            <tbody>
              {detail.recipients.map((r) => (
                <tr key={r.id}>
                  <td>
                    {r.lead?.name ?? "—"} ({r.lead?.leadCode})
                  </td>
                  <td>{r.mobile}</td>
                  <td>
                    <span className="badge badge-stage">{r.status}</span>
                  </td>
                  <td>{r.error ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

export default function CampaignsPage() {
  return (
    <>
      <Suspense fallback={<p>Loading…</p>}>
        <CampaignsContent />
      </Suspense>
    </>
  );
}
