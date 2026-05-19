"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";

type User = {
  id: string;
  userCode: string;
  username: string;
  fullName: string;
  role: string;
  department?: string;
  email?: string;
};

export default function UsersPage() {
  const [items, setItems] = useState<User[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({
    username: "",
    password: "",
    fullName: "",
    role: "USER",
    department: "Sales",
    email: "",
  });
  const [error, setError] = useState("");
  const [editUser, setEditUser] = useState<User | null>(null);
  const [editForm, setEditForm] = useState({
    fullName: "",
    role: "USER",
    department: "Sales",
    email: "",
    password: "",
  });

  function load() {
    api<{ items: User[] }>("/users").then((r) => setItems(r.items)).catch((e) => setError(e.message));
  }

  useEffect(() => {
    load();
  }, []);

  async function addUser(e: React.FormEvent) {
    e.preventDefault();
    await api("/users", { method: "POST", body: JSON.stringify(form) });
    setShowAdd(false);
    load();
  }

  function openEdit(u: User) {
    setEditUser(u);
    setEditForm({
      fullName: u.fullName,
      role: u.role,
      department: u.department ?? "Sales",
      email: u.email ?? "",
      password: "",
    });
  }

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editUser) return;
    const body: Record<string, string> = {
      fullName: editForm.fullName,
      role: editForm.role,
      department: editForm.department,
    };
    if (editForm.email) body.email = editForm.email;
    if (editForm.password) body.password = editForm.password;
    await api(`/users/${editUser.id}`, { method: "PATCH", body: JSON.stringify(body) });
    setEditUser(null);
    load();
  }

  return (
    <>
      {error && <div className="alert-error">{error}</div>}
      <button type="button" className="btn btn-wa" style={{ marginBottom: "1rem" }} onClick={() => setShowAdd(true)}>
        + Add user
      </button>
      <div className="card table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Code</th>
              <th>Name</th>
              <th>Username</th>
              <th>Role</th>
              <th>Department</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {items.map((u) => (
              <tr key={u.id}>
                <td>{u.userCode}</td>
                <td>{u.fullName}</td>
                <td>{u.username}</td>
                <td>
                  <span className="badge badge-stage">{u.role}</span>
                </td>
                <td>{u.department ?? "—"}</td>
                <td>
                  <button type="button" className="btn btn-outline btn-sm" onClick={() => openEdit(u)}>
                    Edit
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editUser && (
        <div className="modal-backdrop" onClick={() => setEditUser(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Edit — {editUser.username}</h3>
              <button type="button" className="btn btn-outline btn-sm" onClick={() => setEditUser(null)}>✕</button>
            </div>
            <div className="modal-body">
              <form onSubmit={saveEdit}>
                <div className="form-group">
                  <label>Full name</label>
                  <input className="form-control" required value={editForm.fullName} onChange={(e) => setEditForm({ ...editForm, fullName: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>Email</label>
                  <input className="form-control" value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>Role</label>
                  <select className="form-control" value={editForm.role} onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}>
                    <option value="USER">User</option>
                    <option value="MANAGER">Manager</option>
                    <option value="ADMIN">Admin</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>New password (optional)</label>
                  <input type="password" className="form-control" value={editForm.password} onChange={(e) => setEditForm({ ...editForm, password: e.target.value })} />
                </div>
                <button type="submit" className="btn btn-wa">Save</button>
              </form>
            </div>
          </div>
        </div>
      )}

      {showAdd && (
        <div className="modal-backdrop" onClick={() => setShowAdd(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Add user</h3>
              <button type="button" className="btn btn-outline btn-sm" onClick={() => setShowAdd(false)}>✕</button>
            </div>
            <div className="modal-body">
              <form onSubmit={addUser}>
                <div className="form-group">
                  <label>Full name</label>
                  <input className="form-control" required value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>Username</label>
                  <input className="form-control" required value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>Password</label>
                  <input type="password" className="form-control" required value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>Role</label>
                  <select className="form-control" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                    <option value="USER">User</option>
                    <option value="MANAGER">Manager</option>
                    <option value="ADMIN">Admin</option>
                  </select>
                </div>
                <button type="submit" className="btn btn-wa">Create user</button>
              </form>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
