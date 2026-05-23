"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";

type Batch = {
  id: string;
  batchCode: string;
  name: string;
  status: string;
  total: number;
  sent: number;
  failed: number;
  skipped: number;
  message: string;
  mediaUrl?: string;
  createdAt: string;
  startedAt?: string | null;
  completedAt?: string | null;
  user?: { id: string; fullName: string };
};

type Recipient = {
  id: string;
  mobile: string;
  name?: string | null;
  city?: string | null;
  status: "PENDING" | "SENT" | "FAILED" | "SKIPPED";
  error?: string | null;
  messageId?: string | null;
  sentAt?: string | null;
  retries: number;
};

type Stats = { pending: number; sent: number; failed: number; skipped: number };

export default function BatchDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id as string;
  const router = useRouter();

  const [batch, setBatch] = useState<Batch | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  function loadAll() {
    if (!id) return;
    api<{ batch: Batch; stats: Stats }>(`/bulk-automation/batches/${id}`)
      .then((r) => {
        setBatch(r.batch);
        setStats(r.stats);
      })
      .catch((e) => {
        const m = e instanceof Error ? e.message : "Batch load failed";
        setError(m);
        if (/forbidden|not found/i.test(m)) {
          setTimeout(() => router.push("/bulk-automation"), 1500);
        }
      });

    const qs = new URLSearchParams({
      page: String(page),
      limit: "100",
      ...(statusFilter ? { status: statusFilter } : {}),
    });
    api<{ items: Recipient[]; total: number }>(
      `/bulk-automation/batches/${id}/recipients?${qs.toString()}`
    )
      .then((r) => {
        setRecipients(r.items);
        setTotal(r.total);
      })
      .catch(() => {});
  }

  useEffect(() => {
    loadAll();
    const t = setInterval(loadAll, 10_000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, page, statusFilter]);

  async function act(action: "pause" | "resume" | "cancel" | "start") {
    setBusy(true);
    try {
      await api(`/bulk-automation/batches/${id}/${action}`, { method: "POST" });
      loadAll();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action failed");
    } finally {
      setBusy(false);
    }
  }

  if (error && !batch) {
    return <div className="alert-error">{error} — redirect ho raha…</div>;
  }
  if (!batch) return <p>Loading…</p>;

  const progressPct =
    batch.total > 0 ? Math.round(((batch.sent + batch.failed) / batch.total) * 100) : 0;

  return (
    <>
      {error && <div className="alert-error" style={{ marginBottom: "1rem" }}>{error}</div>}

      <div className="card" style={{ marginBottom: "1rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: "1rem" }}>
          <div>
            <Link href="/bulk-automation" className="back-link">
              ← Back to Bulk Automation
            </Link>
            <h2 style={{ marginTop: "0.5rem", marginBottom: 0 }}>{batch.name}</h2>
            <small>
              <code>{batch.batchCode}</code> ·{" "}
              {batch.user ? `${batch.user.fullName} · ` : ""}
              Created {new Date(batch.createdAt).toLocaleString()}
            </small>
          </div>
          <span className={`badge badge-status-${batch.status.toLowerCase()}`} style={{ alignSelf: "flex-start" }}>
            {batch.status}
          </span>
        </div>

        <div className="progress-bar-wrap" style={{ marginTop: "1rem" }}>
          <div className="progress-bar-fill" style={{ width: `${progressPct}%` }} />
        </div>
        <small>
          {batch.sent + batch.failed} of {batch.total} processed ({progressPct}%)
        </small>

        <div className="bulk-stats-row" style={{ marginTop: "0.75rem" }}>
          <div className="bulk-stat">
            <span>Total</span>
            <strong>{batch.total}</strong>
          </div>
          <div className="bulk-stat ok">
            <span>Sent</span>
            <strong>{stats?.sent ?? batch.sent}</strong>
          </div>
          <div className="bulk-stat bad">
            <span>Failed</span>
            <strong>{stats?.failed ?? batch.failed}</strong>
          </div>
          <div className="bulk-stat">
            <span>Pending</span>
            <strong>{stats?.pending ?? batch.total - batch.sent - batch.failed - batch.skipped}</strong>
          </div>
          <div className="bulk-stat">
            <span>Skipped</span>
            <strong>{stats?.skipped ?? batch.skipped}</strong>
          </div>
        </div>

        <div className="bulk-batch-actions" style={{ marginTop: "1rem" }}>
          {batch.status === "PENDING" && (
            <button type="button" className="btn btn-wa btn-sm" disabled={busy} onClick={() => act("start")}>
              Start sending
            </button>
          )}
          {batch.status === "ACTIVE" && (
            <button type="button" className="btn btn-outline btn-sm" disabled={busy} onClick={() => act("pause")}>
              Pause
            </button>
          )}
          {batch.status === "PAUSED" && (
            <button type="button" className="btn btn-wa btn-sm" disabled={busy} onClick={() => act("resume")}>
              Resume
            </button>
          )}
          {(batch.status === "ACTIVE" || batch.status === "PAUSED" || batch.status === "PENDING") && (
            <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={() => act("cancel")}>
              Cancel
            </button>
          )}
        </div>
      </div>

      <div className="card" style={{ marginBottom: "1rem" }}>
        <h3 style={{ marginTop: 0 }}>Message</h3>
        <pre className="message-preview">{batch.message}</pre>
        {batch.mediaUrl && (
          <div className="media-preview media-preview-sm">
            <img src={batch.mediaUrl} alt="batch media" />
          </div>
        )}
      </div>

      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.5rem" }}>
          <h3 style={{ margin: 0 }}>Recipients ({total})</h3>
          <select
            className="form-control"
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            style={{ maxWidth: 200 }}
          >
            <option value="">All statuses</option>
            <option value="PENDING">Pending</option>
            <option value="SENT">Sent</option>
            <option value="FAILED">Failed</option>
            <option value="SKIPPED">Skipped</option>
          </select>
        </div>

        {recipients.length === 0 ? (
          <p className="empty-hint" style={{ marginTop: "1rem" }}>Koi recipient nahi.</p>
        ) : (
          <div className="table-wrap" style={{ marginTop: "0.75rem" }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Mobile</th>
                  <th>Name</th>
                  <th>City</th>
                  <th>Status</th>
                  <th>Sent at</th>
                  <th>Retries</th>
                  <th>Error</th>
                </tr>
              </thead>
              <tbody>
                {recipients.map((r) => (
                  <tr key={r.id}>
                    <td><code>{r.mobile}</code></td>
                    <td>{r.name ?? "—"}</td>
                    <td>{r.city ?? "—"}</td>
                    <td>
                      <span className={`badge badge-status-${r.status.toLowerCase()}`}>{r.status}</span>
                    </td>
                    <td>{r.sentAt ? new Date(r.sentAt).toLocaleString() : "—"}</td>
                    <td>{r.retries}</td>
                    <td>
                      {r.error ? (
                        <small style={{ color: "var(--wa-danger)" }}>{r.error}</small>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {total > 100 && (
          <div className="pagination-row" style={{ marginTop: "0.75rem" }}>
            <button
              type="button"
              className="btn btn-outline btn-sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              ← Prev
            </button>
            <span>
              Page {page} / {Math.ceil(total / 100)}
            </span>
            <button
              type="button"
              className="btn btn-outline btn-sm"
              disabled={page >= Math.ceil(total / 100)}
              onClick={() => setPage((p) => p + 1)}
            >
              Next →
            </button>
          </div>
        )}
      </div>
    </>
  );
}
