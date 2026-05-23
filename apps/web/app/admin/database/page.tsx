"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useClientAuth, canManageWhatsAppApi } from "@/lib/auth-store";

type TableInfo = {
  key: string;
  label: string;
  description: string;
  count: number;
  searchFields: string[];
};

type TableData = {
  key: string;
  label: string;
  columns: string[];
  items: Record<string, unknown>[];
  total: number;
  page: number;
  limit: number;
};

function formatCell(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "boolean") return value ? "yes" : "no";
  if (value instanceof Date) return value.toLocaleString();
  if (typeof value === "object") return JSON.stringify(value);
  const s = String(value);
  if (/^\d{4}-\d{2}-\d{2}T/.test(s)) {
    try {
      return new Date(s).toLocaleString();
    } catch {
      return s;
    }
  }
  return s;
}

export default function AdminDatabasePage() {
  const { user, ready } = useClientAuth();
  const isAdmin = ready && canManageWhatsAppApi(user?.role ?? "USER");

  const [tables, setTables] = useState<TableInfo[]>([]);
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [data, setData] = useState<TableData | null>(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!ready || !isAdmin) return;
    api<{ tables: TableInfo[] }>("/admin-db/tables")
      .then((r) => setTables(r.tables))
      .catch((e) => setError(e instanceof Error ? e.message : "Load failed"));
  }, [ready, isAdmin]);

  useEffect(() => {
    if (!activeKey) return;
    const qs = new URLSearchParams({
      page: String(page),
      limit: "50",
      ...(search ? { search } : {}),
    });
    api<TableData>(`/admin-db/tables/${activeKey}?${qs.toString()}`)
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : "Load failed"));
  }, [activeKey, page, search]);

  if (!ready) return <p>Loading…</p>;
  if (!isAdmin) {
    return <div className="alert-error">Sirf Admin database access kar sakta hai.</div>;
  }

  return (
    <>
      {error && <div className="alert-error" style={{ marginBottom: "1rem" }}>{error}</div>}

      <div className="card" style={{ marginBottom: "1rem" }}>
        <h2 style={{ marginTop: 0 }}>Database Panel (read-only)</h2>
        <p className="page-intro">
          Yahan tum saari PostgreSQL tables browse kar sakte ho — Adminer/phpMyAdmin jaisa.
          Passwords aur access tokens auto-mask hote hain. Yahan se kuch edit nahi hota; sirf data verify karna.
        </p>
      </div>

      <div className="db-panel-grid">
        {/* Table list */}
        <div className="card db-table-list">
          <h3 style={{ marginTop: 0 }}>Tables</h3>
          {tables.length === 0 ? (
            <p className="empty-hint">Loading…</p>
          ) : (
            <ul className="db-table-ul">
              {tables.map((t) => (
                <li key={t.key}>
                  <button
                    type="button"
                    className={`db-table-link ${activeKey === t.key ? "active" : ""}`}
                    onClick={() => {
                      setActiveKey(t.key);
                      setPage(1);
                      setSearch("");
                    }}
                  >
                    <strong>{t.label}</strong>
                    <span className="db-count-badge">{t.count}</span>
                    <small>{t.description}</small>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Table data */}
        <div className="card db-table-data">
          {!activeKey ? (
            <p className="empty-hint">Left side se koi table choose karo.</p>
          ) : !data ? (
            <p>Loading data…</p>
          ) : (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.5rem" }}>
                <h3 style={{ margin: 0 }}>
                  {data.label} <small>({data.total})</small>
                </h3>
                <input
                  type="search"
                  className="form-control"
                  placeholder="Search…"
                  style={{ maxWidth: 280 }}
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(1);
                  }}
                />
              </div>

              {data.items.length === 0 ? (
                <p className="empty-hint" style={{ marginTop: "1rem" }}>Koi row nahi mili.</p>
              ) : (
                <div className="table-wrap" style={{ marginTop: "0.75rem" }}>
                  <table className="table compact">
                    <thead>
                      <tr>
                        {data.columns.map((c) => (
                          <th key={c}>{c}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {data.items.map((row, idx) => (
                        <tr key={idx}>
                          {data.columns.map((c) => (
                            <td key={c}>
                              <span className="db-cell" title={formatCell(row[c])}>
                                {formatCell(row[c])}
                              </span>
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {data.total > data.limit && (
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
                    Page {page} / {Math.ceil(data.total / data.limit)}
                  </span>
                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    disabled={page >= Math.ceil(data.total / data.limit)}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Next →
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}
