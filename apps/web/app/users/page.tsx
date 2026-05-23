"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { useClientAuth, canManageUsers } from "@/lib/auth-store";
import { useRouter } from "next/navigation";

type User = {
  id: string;
  userCode: string;
  username: string;
  fullName: string;
  role: string;
  department?: string;
  email?: string;
  status: string;
};

type WaRow = {
  userId: string;
  integration: {
    providerLabel: string;
    status: string;
    dailyLimit: number;
    sentToday: number;
  } | null;
};

const emptyForm = {
  username: "",
  password: "",
  fullName: "",
  role: "USER",
  department: "Sales",
  email: "",
};

export default function UsersPage() {
  const router = useRouter();
  const { role, ready: authReady } = useClientAuth();
  const [items, setItems] = useState<User[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState("");
  const [modalError, setModalError] = useState("");
  const [busy, setBusy] = useState(false);
  const [editUser, setEditUser] = useState<User | null>(null);
  const [editForm, setEditForm] = useState({
    fullName: "",
    role: "USER",
    department: "Sales",
    email: "",
    password: "",
    status: "active",
  });

  const [waMap, setWaMap] = useState<Record<string, WaRow["integration"]>>({});

  function load() {
    setError("");
    api<{ items: User[] }>("/users")
      .then((r) => setItems(r.items))
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load users"));
    // WhatsApp assignment summary per user (admin only endpoint — silently ignore if not admin)
    api<{ items: WaRow[] }>("/whatsapp/admin/integrations")
      .then((r) => {
        const m: Record<string, WaRow["integration"]> = {};
        for (const row of r.items) m[row.userId] = row.integration;
        setWaMap(m);
      })
      .catch(() => {});
  }

  useEffect(() => {
    if (!authReady) return;
    if (!canManageUsers(role)) {
      router.replace("/dashboard");
      return;
    }
    load();
  }, [authReady, role, router]);

  async function addUser(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setModalError("");
    try {
      const body: Record<string, string> = {
        username: form.username.trim(),
        password: form.password,
        fullName: form.fullName.trim(),
        role: form.role,
        department: form.department,
      };
      if (form.email.trim()) body.email = form.email.trim();
      await api("/users", { method: "POST", body: JSON.stringify(body) });
      setShowAdd(false);
      setForm(emptyForm);
      load();
    } catch (err) {
      setModalError(err instanceof Error ? err.message : "Create failed");
    } finally {
      setBusy(false);
    }
  }

  function openEdit(u: User) {
    setModalError("");
    setEditUser(u);
    setEditForm({
      fullName: u.fullName,
      role: u.role,
      department: u.department ?? "Sales",
      email: u.email ?? "",
      password: "",
      status: u.status,
    });
  }

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editUser) return;
    setBusy(true);
    setModalError("");
    try {
      const body: Record<string, string> = {
        fullName: editForm.fullName.trim(),
        role: editForm.role,
        department: editForm.department,
        status: editForm.status,
      };
      if (editForm.email.trim()) body.email = editForm.email.trim();
      if (editForm.password) body.password = editForm.password;
      await api(`/users/${editUser.id}`, { method: "PATCH", body: JSON.stringify(body) });
      setEditUser(null);
      load();
    } catch (err) {
      setModalError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive(u: User) {
    setError("");
    try {
      if (u.status === "active") {
        await api(`/users/${u.id}`, { method: "DELETE" });
      } else {
        await api(`/users/${u.id}/activate`, { method: "POST" });
      }
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Status update failed");
    }
  }

  if (!authReady || !canManageUsers(role)) {
    return <p className="wa-hint">Loading…</p>;
  }

  return (
    <>
      {error && <div className="alert-error">{error}</div>}
      <p className="wa-hint" style={{ marginBottom: "1rem" }}>
        Admin: sab users ki activity dashboard par dikhti hai. User: sirf apni leads / calls.
      </p>
      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem", flexWrap: "wrap" }}>
        <button
          type="button"
          className="btn btn-wa"
          onClick={() => {
            setModalError("");
            setShowAdd(true);
          }}
        >
          + Add user
        </button>
        <Link href="/settings/team" className="btn btn-outline">
          Manage WhatsApp APIs →
        </Link>
      </div>
      <div className="card table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Code</th>
              <th>Name</th>
              <th>Username</th>
              <th>Role</th>
              <th>Status</th>
              <th>Department</th>
              <th>WhatsApp API</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map((u) => {
              const wa = waMap[u.id];
              return (
                <tr key={u.id} className={u.status === "inactive" ? "row-muted" : undefined}>
                  <td>{u.userCode}</td>
                  <td>{u.fullName}</td>
                  <td>{u.username}</td>
                  <td>
                    <span className="badge badge-stage">{u.role}</span>
                  </td>
                  <td>
                    <span className={`badge ${u.status === "active" ? "badge-success" : "badge-stage"}`}>
                      {u.status}
                    </span>
                  </td>
                  <td>{u.department ?? "—"}</td>
                  <td>
                    {wa ? (
                      <>
                        <span className={`badge ${wa.status === "active" ? "badge-success" : "badge-stage"}`}>
                          {wa.providerLabel}
                        </span>
                        <br />
                        <small className="wa-hint">
                          {wa.sentToday}/{wa.dailyLimit}
                        </small>
                      </>
                    ) : (
                      <span className="badge badge-stage">Not set</span>
                    )}
                  </td>
                  <td className="table-actions">
                    <button type="button" className="btn btn-outline btn-sm" onClick={() => openEdit(u)}>
                      Edit
                    </button>
                    <Link
                      href="/settings/team"
                      className="btn btn-outline btn-sm"
                      title="Manage WhatsApp API"
                    >
                      WA
                    </Link>
                    <button
                      type="button"
                      className={`btn btn-sm ${u.status === "active" ? "btn-ghost" : "btn-wa"}`}
                      onClick={() => toggleActive(u)}
                    >
                      {u.status === "active" ? "Deactivate" : "Activate"}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {editUser && (
        <div className="modal-backdrop" onClick={() => !busy && setEditUser(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Edit — {editUser.username}</h3>
              <button type="button" className="btn btn-outline btn-sm" onClick={() => setEditUser(null)}>
                ✕
              </button>
            </div>
            <div className="modal-body">
              <form onSubmit={saveEdit}>
                <div className="form-group">
                  <label>Full name</label>
                  <input
                    className="form-control"
                    required
                    value={editForm.fullName}
                    onChange={(e) => setEditForm({ ...editForm, fullName: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>Email (optional)</label>
                  <input
                    className="form-control"
                    value={editForm.email}
                    onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>Department</label>
                  <input
                    className="form-control"
                    value={editForm.department}
                    onChange={(e) => setEditForm({ ...editForm, department: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>Role</label>
                  <select
                    className="form-control"
                    value={editForm.role}
                    onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
                  >
                    <option value="USER">User (sales)</option>
                    <option value="MANAGER">Manager</option>
                    <option value="ADMIN">Admin</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Status</label>
                  <select
                    className="form-control"
                    value={editForm.status}
                    onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>New password (optional)</label>
                  <input
                    type="password"
                    className="form-control"
                    minLength={6}
                    value={editForm.password}
                    onChange={(e) => setEditForm({ ...editForm, password: e.target.value })}
                    placeholder="Leave blank to keep current"
                  />
                </div>
                {modalError && <div className="alert-error">{modalError}</div>}
                <button type="submit" className="btn btn-wa" disabled={busy}>
                  {busy ? "Saving…" : "Save changes"}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {showAdd && (
        <div className="modal-backdrop" onClick={() => !busy && setShowAdd(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Add user</h3>
              <button type="button" className="btn btn-outline btn-sm" onClick={() => setShowAdd(false)}>
                ✕
              </button>
            </div>
            <div className="modal-body">
              <form onSubmit={addUser}>
                <div className="form-group">
                  <label>Full name</label>
                  <input
                    className="form-control"
                    required
                    value={form.fullName}
                    onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>Username</label>
                  <input
                    className="form-control"
                    required
                    minLength={3}
                    value={form.username}
                    onChange={(e) => setForm({ ...form, username: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>Password (min 6)</label>
                  <input
                    type="password"
                    className="form-control"
                    required
                    minLength={6}
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>Department</label>
                  <input
                    className="form-control"
                    value={form.department}
                    onChange={(e) => setForm({ ...form, department: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>Role</label>
                  <select
                    className="form-control"
                    value={form.role}
                    onChange={(e) => setForm({ ...form, role: e.target.value })}
                  >
                    <option value="USER">User (sales)</option>
                    <option value="MANAGER">Manager</option>
                    <option value="ADMIN">Admin</option>
                  </select>
                </div>
                {modalError && <div className="alert-error">{modalError}</div>}
                <button type="submit" className="btn btn-wa" disabled={busy}>
                  {busy ? "Creating…" : "Create user"}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
