"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useClientAuth, canManageWhatsAppApi } from "@/lib/auth-store";

type ProviderMeta = {
  id: string;
  label: string;
  description: string;
  fields: {
    key: string;
    label: string;
    type: string;
    required: boolean;
    placeholder?: string;
    help?: string;
  }[];
};

type IntegrationSummary = {
  provider: string;
  providerLabel: string;
  instanceId: string;
  baseUrl: string | null;
  phone: string | null;
  dailyLimit: number;
  sentToday: number;
  status: string;
  lastUsedAt: string | null;
  hasToken: boolean;
  configured: boolean;
};

type TeamRow = {
  userId: string;
  userCode: string;
  username: string;
  fullName: string;
  role: string;
  userStatus: string;
  integration: IntegrationSummary | null;
};

const emptyFields = {
  instanceId: "",
  accessToken: "",
  baseUrl: "",
  phone: "",
  dailyLimit: "1000",
  status: "active",
};

export default function TeamWhatsAppPage() {
  const router = useRouter();
  const { role, ready: authReady } = useClientAuth();
  const [items, setItems] = useState<TeamRow[]>([]);
  const [providers, setProviders] = useState<ProviderMeta[]>([]);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [editRow, setEditRow] = useState<TeamRow | null>(null);
  const [provider, setProvider] = useState("ULTRAMSG");
  const [fields, setFields] = useState(emptyFields);
  const [testTo, setTestTo] = useState("");

  function load() {
    setError("");
    api<{ items: TeamRow[]; providers: ProviderMeta[] }>("/whatsapp/admin/integrations")
      .then((r) => {
        setItems(r.items);
        setProviders(r.providers);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load"));
  }

  useEffect(() => {
    if (!authReady) return;
    if (!canManageWhatsAppApi(role)) {
      router.replace("/settings");
      return;
    }
    load();
  }, [authReady, role, router]);

  const meta = providers.find((p) => p.id === provider);

  function openEdit(row: TeamRow) {
    setMsg("");
    setEditRow(row);
    setTestTo("");
    if (row.integration) {
      setProvider(row.integration.provider);
      setFields({
        instanceId: row.integration.instanceId,
        accessToken: "",
        baseUrl: row.integration.baseUrl ?? "",
        phone: row.integration.phone ?? "",
        dailyLimit: String(row.integration.dailyLimit),
        status: row.integration.status,
      });
    } else {
      setProvider("ULTRAMSG");
      setFields(emptyFields);
    }
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!editRow) return;
    setBusy(true);
    setMsg("");
    try {
      const body: Record<string, string | number | null> = {
        provider,
        instanceId: fields.instanceId.trim(),
        baseUrl: fields.baseUrl.trim() || null,
        phone: fields.phone.trim() || null,
        dailyLimit: Number(fields.dailyLimit) || 1000,
        status: fields.status,
      };
      if (fields.accessToken.trim()) body.accessToken = fields.accessToken.trim();

      await api(`/whatsapp/admin/integrations/${editRow.userId}`, {
        method: "PUT",
        body: JSON.stringify(body),
      });
      setMsg(`Saved WhatsApp API for ${editRow.fullName}`);
      setEditRow(null);
      load();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  async function testSend() {
    if (!editRow) return;
    setBusy(true);
    setMsg("");
    try {
      const r = await api<{ success: boolean; error?: string }>(
        `/whatsapp/admin/integrations/${editRow.userId}/test`,
        {
          method: "POST",
          body: JSON.stringify({ to: testTo }),
        }
      );
      setMsg(r.success ? "Test message sent" : r.error ?? "Test failed");
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Test failed");
    } finally {
      setBusy(false);
    }
  }

  if (!authReady || !canManageWhatsAppApi(role)) {
    return <p className="wa-hint">Loading…</p>;
  }

  return (
    <>
      {error && <div className="alert-error">{error}</div>}
      {msg && (
        <div className="card" style={{ marginBottom: "1rem", borderLeft: "4px solid var(--wa-green)" }}>
          {msg}
        </div>
      )}

      <p className="wa-hint" style={{ marginBottom: "1rem" }}>
        <strong>Admin-controlled WhatsApp APIs:</strong> Tum har user (apne sahit) ke liye API
        choose karte ho — UltraMsg, AtozSender, ya Evolution. User sirf apna assigned API dekhta
        hai, edit nahi kar sakta.
      </p>

      <div className="card table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>User</th>
              <th>Role</th>
              <th>Assigned API</th>
              <th>Today</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map((row) => (
              <tr key={row.userId}>
                <td>
                  <strong>{row.fullName}</strong>
                  <br />
                  <small className="wa-hint">@{row.username}</small>
                </td>
                <td>
                  <span className="badge badge-stage">{row.role}</span>
                </td>
                <td>
                  {row.integration ? (
                    <span className="badge badge-success">{row.integration.providerLabel}</span>
                  ) : (
                    <span className="badge badge-stage">Not set</span>
                  )}
                </td>
                <td>
                  {row.integration
                    ? `${row.integration.sentToday} / ${row.integration.dailyLimit}`
                    : "—"}
                </td>
                <td>
                  {row.integration ? (
                    <span
                      className={`badge ${row.integration.status === "active" ? "badge-success" : "badge-stage"}`}
                    >
                      {row.integration.status}
                    </span>
                  ) : (
                    "—"
                  )}
                </td>
                <td>
                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    onClick={() => openEdit(row)}
                  >
                    {row.integration ? "Edit API" : "Assign API"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editRow && (
        <div className="modal-backdrop" onClick={() => !busy && setEditRow(null)}>
          <div className="modal modal-wide" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>
                WhatsApp API — {editRow.fullName}
                {editRow.role === "ADMIN" ? " (Admin)" : ""}
              </h3>
              <button type="button" className="btn btn-outline btn-sm" onClick={() => setEditRow(null)}>
                ✕
              </button>
            </div>
            <div className="modal-body">
              <p className="wa-hint">User ko sirf assigned API dikhega — credentials yahan admin save karega.</p>

              <div className="provider-grid" style={{ marginBottom: "1rem" }}>
                {providers.map((p) => (
                  <div
                    key={p.id}
                    className={`provider-card ${provider === p.id ? "selected" : ""}`}
                    onClick={() => setProvider(p.id)}
                    role="button"
                  >
                    <h4>{p.label}</h4>
                    <p style={{ fontSize: "0.85rem", color: "var(--wa-muted)", margin: 0 }}>
                      {p.description}
                    </p>
                  </div>
                ))}
              </div>

              <form onSubmit={save}>
                {meta?.fields.map((f) => (
                  <div key={f.key} className="form-group">
                    <label>
                      {f.label}
                      {f.required && f.key !== "accessToken" ? " *" : ""}
                    </label>
                    <input
                      type={f.type === "password" ? "password" : "text"}
                      className="form-control"
                      required={f.required && f.key !== "accessToken"}
                      placeholder={
                        f.key === "accessToken" && editRow.integration?.hasToken
                          ? "Leave blank to keep current token"
                          : f.placeholder
                      }
                      value={fields[f.key as keyof typeof fields] ?? ""}
                      onChange={(e) => setFields({ ...fields, [f.key]: e.target.value })}
                    />
                    {f.help && <small className="wa-hint">{f.help}</small>}
                  </div>
                ))}

                <div className="form-group">
                  <label>Daily message limit</label>
                  <input
                    type="number"
                    className="form-control"
                    min={1}
                    value={fields.dailyLimit}
                    onChange={(e) => setFields({ ...fields, dailyLimit: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label>API status</label>
                  <select
                    className="form-control"
                    value={fields.status}
                    onChange={(e) => setFields({ ...fields, status: e.target.value })}
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>

                <button type="submit" className="btn btn-wa" disabled={busy}>
                  {busy ? "Saving…" : "Save API settings"}
                </button>
              </form>

              <hr style={{ borderColor: "var(--wa-border)", margin: "1.5rem 0" }} />

              <h4>Test (this user&apos;s API)</h4>
              <div className="form-group">
                <label>Test mobile number</label>
                <input
                  className="form-control"
                  value={testTo}
                  onChange={(e) => setTestTo(e.target.value)}
                />
              </div>
              <button type="button" className="btn btn-outline" disabled={busy} onClick={testSend}>
                Send test message
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
