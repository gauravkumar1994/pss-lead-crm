"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { useClientAuth, canManageWhatsAppApi } from "@/lib/auth-store";

type Profile = {
  id?: string;
  enabled: boolean;
  dailyTarget: number;
  gapMinutes: number;
  startHour: number;
  endHour: number;
  sentToday: number;
  lastSentAt?: string | null;
  notes?: string | null;
};

type Row = {
  userId: string;
  userCode: string;
  username: string;
  fullName: string;
  role: string;
  profile: Profile | null;
  whatsapp: { provider: string; status: string; dailyLimit: number; sentToday: number } | null;
};

const PROVIDER_LABEL: Record<string, string> = {
  ULTRAMSG: "UltraMsg",
  ATOZSENDER: "AtozSender",
  EVOLUTION: "Evolution",
};

const DEFAULT_PROFILE: Profile = {
  enabled: false,
  dailyTarget: 50,
  gapMinutes: 18,
  startHour: 9,
  endHour: 21,
  sentToday: 0,
  notes: "",
};

export default function BulkProfilesPage() {
  const { user, ready } = useClientAuth();
  const isAdmin = ready && canManageWhatsAppApi(user?.role ?? "USER");

  const [rows, setRows] = useState<Row[]>([]);
  const [editing, setEditing] = useState<Row | null>(null);
  const [draft, setDraft] = useState<Profile>(DEFAULT_PROFILE);
  const [busy, setBusy] = useState(false);
  const [info, setInfo] = useState("");
  const [error, setError] = useState("");

  function load() {
    api<{ items: Row[] }>("/bulk-automation/profiles")
      .then((r) => setRows(r.items))
      .catch((e) => setError(e instanceof Error ? e.message : "Load failed"));
  }

  useEffect(() => {
    if (!ready) return;
    if (!isAdmin) return;
    load();
  }, [ready, isAdmin]);

  function startEdit(row: Row) {
    setEditing(row);
    setDraft(row.profile ?? DEFAULT_PROFILE);
    setError("");
    setInfo("");
  }

  async function save() {
    if (!editing) return;
    setBusy(true);
    setError("");
    try {
      if (draft.startHour >= draft.endHour) {
        throw new Error("Start hour End hour se chhota hona chahiye");
      }
      await api(`/bulk-automation/profiles/${editing.userId}`, {
        method: "PUT",
        body: JSON.stringify({
          enabled: draft.enabled,
          dailyTarget: draft.dailyTarget,
          gapMinutes: draft.gapMinutes,
          startHour: draft.startHour,
          endHour: draft.endHour,
          notes: draft.notes ?? "",
        }),
      });
      setInfo(`${editing.fullName} ki bulk permission save ho gayi`);
      setEditing(null);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  async function quickToggle(row: Row, value: boolean) {
    setBusy(true);
    try {
      await api(`/bulk-automation/profiles/${row.userId}`, {
        method: "PUT",
        body: JSON.stringify({ enabled: value }),
      });
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Toggle failed");
    } finally {
      setBusy(false);
    }
  }

  if (!ready) return <p>Loading…</p>;
  if (!isAdmin) {
    return (
      <div className="alert-error">
        Sirf Admin is page ko access kar sakta hai.
      </div>
    );
  }

  return (
    <>
      {error && <div className="alert-error" style={{ marginBottom: "1rem" }}>{error}</div>}
      {info && (
        <div className="card" style={{ borderLeft: "4px solid var(--wa-green)", marginBottom: "1rem" }}>
          {info}
        </div>
      )}

      <div className="card" style={{ marginBottom: "1rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: "1rem" }}>
          <div>
            <h2 style={{ marginTop: 0, marginBottom: "0.25rem" }}>Bulk Permissions</h2>
            <p className="page-intro">
              Har user ke liye bulk automation enable/disable karo aur uske rules set karo. Worker
              sirf un users ke liye chalega jinhe yahan se permission di gayi hai.
            </p>
          </div>
          <Link href="/bulk-automation" className="btn btn-outline btn-sm">
            ← Bulk Automation
          </Link>
        </div>
      </div>

      <div className="card">
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>User</th>
                <th>Role</th>
                <th>WhatsApp API</th>
                <th>Bulk Enabled</th>
                <th>Daily / Today</th>
                <th>Gap</th>
                <th>Window</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const p = row.profile;
                const wa = row.whatsapp;
                return (
                  <tr key={row.userId}>
                    <td>
                      <strong>{row.fullName}</strong>
                      <br />
                      <small>
                        {row.userCode} · {row.username}
                      </small>
                    </td>
                    <td>
                      <span className="badge">{row.role}</span>
                    </td>
                    <td>
                      {wa ? (
                        <>
                          <strong>{PROVIDER_LABEL[wa.provider] ?? wa.provider}</strong>
                          <br />
                          <small className={wa.status === "active" ? "wa-ok" : "wa-bad"}>
                            {wa.status} · {wa.sentToday}/{wa.dailyLimit}
                          </small>
                        </>
                      ) : (
                        <small className="wa-bad">Not assigned</small>
                      )}
                    </td>
                    <td>
                      <label className="switch">
                        <input
                          type="checkbox"
                          checked={p?.enabled ?? false}
                          disabled={busy || !wa}
                          onChange={(e) => quickToggle(row, e.target.checked)}
                        />
                        <span className="slider" />
                      </label>
                      {!wa && (
                        <div>
                          <small className="wa-hint">Pehle WhatsApp API assign karo</small>
                        </div>
                      )}
                    </td>
                    <td>
                      {p ? `${p.sentToday} / ${p.dailyTarget}` : "—"}
                    </td>
                    <td>{p ? `${p.gapMinutes} min` : "—"}</td>
                    <td>
                      {p
                        ? `${String(p.startHour).padStart(2, "0")}:00 – ${String(p.endHour).padStart(2, "0")}:00`
                        : "—"}
                    </td>
                    <td>
                      <button
                        type="button"
                        className="btn btn-outline btn-sm"
                        onClick={() => startEdit(row)}
                        disabled={busy}
                      >
                        Rules edit
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {editing && (
        <div className="modal-backdrop" onClick={() => setEditing(null)}>
          <div className="modal modal-lg" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>
                Bulk rules — {editing.fullName} <small style={{ opacity: 0.85 }}>({editing.userCode})</small>
              </h3>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditing(null)} aria-label="Close">✕</button>
            </div>
            <div className="modal-body">

            <div className="form-group" style={{ marginTop: "1rem" }}>
              <label style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <input
                  type="checkbox"
                  checked={draft.enabled}
                  onChange={(e) => setDraft((d) => ({ ...d, enabled: e.target.checked }))}
                />
                <strong>Bulk Automation ENABLED</strong>
              </label>
              <small className="wa-hint">
                Permission ON karke worker is user ke active batches process karega.
              </small>
            </div>

            <div className="grid-2">
              <div className="form-group">
                <label>Daily Target</label>
                <input
                  type="number"
                  className="form-control"
                  min={1}
                  max={5000}
                  value={draft.dailyTarget}
                  onChange={(e) => setDraft((d) => ({ ...d, dailyTarget: Number(e.target.value) }))}
                />
              </div>
              <div className="form-group">
                <label>Gap between messages (minutes)</label>
                <input
                  type="number"
                  className="form-control"
                  min={0}
                  max={720}
                  value={draft.gapMinutes}
                  onChange={(e) => setDraft((d) => ({ ...d, gapMinutes: Number(e.target.value) }))}
                />
                <small className="wa-hint">BEAST default: 18 minutes</small>
              </div>
              <div className="form-group">
                <label>Start Hour (0–23)</label>
                <input
                  type="number"
                  className="form-control"
                  min={0}
                  max={23}
                  value={draft.startHour}
                  onChange={(e) => setDraft((d) => ({ ...d, startHour: Number(e.target.value) }))}
                />
              </div>
              <div className="form-group">
                <label>End Hour (0–23)</label>
                <input
                  type="number"
                  className="form-control"
                  min={0}
                  max={23}
                  value={draft.endHour}
                  onChange={(e) => setDraft((d) => ({ ...d, endHour: Number(e.target.value) }))}
                />
              </div>
            </div>

            <div className="form-group">
              <label>Notes (optional)</label>
              <textarea
                className="form-control"
                rows={2}
                value={draft.notes ?? ""}
                onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))}
              />
              <small className="wa-hint">
                Photo / video user khud batch banate waqt browse karke select karega (manual bulk
                jaisa hi). Yahaan se sirf timing + permission control hoti hai.
              </small>
            </div>

            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-ghost" onClick={() => setEditing(null)} disabled={busy}>
                Cancel
              </button>
              <button type="button" className="btn btn-wa" onClick={save} disabled={busy}>
                {busy ? "Saving…" : "Save rules"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
