"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";

type Row = { userId: string; userName: string; outcome: string; count: number };

export default function ReportsPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  function load() {
    const q = new URLSearchParams();
    if (from) q.set("from", from);
    if (to) q.set("to", to);
    api<{ breakdown: Row[] }>(`/calls/report?${q}`).then((r) => setRows(r.breakdown));
  }

  useEffect(() => {
    load();
  }, []);

  const byUser = rows.reduce<Record<string, { name: string; total: number; outcomes: Record<string, number> }>>(
    (acc, r) => {
      if (!acc[r.userId]) acc[r.userId] = { name: r.userName, total: 0, outcomes: {} };
      acc[r.userId].total += r.count;
      acc[r.userId].outcomes[r.outcome] = r.count;
      return acc;
    },
    {}
  );

  return (
    <>
      <div className="filter-bar">
        <div className="form-row">
          <div className="form-group">
            <label>From</label>
            <input type="date" className="form-control" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="form-group">
            <label>To</label>
            <input type="date" className="form-control" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
        </div>
        <button type="button" className="btn btn-wa" onClick={load}>
          Apply
        </button>
      </div>

      <div className="stat-grid">
        {Object.entries(byUser).map(([id, u]) => (
          <div key={id} className="stat-card">
            <h3>{u.total}</h3>
            <p>{u.name} — total calls</p>
            <div style={{ marginTop: "0.5rem", fontSize: "0.8rem" }}>
              {Object.entries(u.outcomes).map(([o, c]) => (
                <span key={o} className="badge badge-stage" style={{ marginRight: 4 }}>
                  {o}: {c}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="card table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>User</th>
              <th>Outcome</th>
              <th>Count</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={`${r.userId}-${r.outcome}-${i}`}>
                <td>{r.userName}</td>
                <td>{r.outcome}</td>
                <td>{r.count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
