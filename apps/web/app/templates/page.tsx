"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { useMessageTemplates } from "@/lib/use-templates";
import { MESSAGE_TOKENS } from "@/lib/constants";

export default function TemplatesPage() {
  const { templates, reload } = useMessageTemplates();
  const [form, setForm] = useState({ name: "", body: "", category: "general" });
  const [editId, setEditId] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    try {
      if (editId) {
        await api(`/templates/${editId}`, {
          method: "PATCH",
          body: JSON.stringify(form),
        });
      } else {
        await api("/templates", { method: "POST", body: JSON.stringify(form) });
      }
      setForm({ name: "", body: "", category: "general" });
      setEditId(null);
      reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    }
  }

  async function remove(id: string) {
    if (!confirm("Delete this template?")) return;
    await api(`/templates/${id}`, { method: "DELETE" });
    reload();
  }

  function startEdit(t: { id: string; name: string; body: string; category: string }) {
    setEditId(t.id);
    setForm({ name: t.name, body: t.body, category: t.category });
  }

  return (
    <>
      <div className="grid-2">
        <div className="card">
          <h3>{editId ? "Edit template" : "New template"}</h3>
          <form onSubmit={save}>
            <div className="form-group">
              <label>Name</label>
              <input
                className="form-control"
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label>Category</label>
              <input
                className="form-control"
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label>Message body</label>
              <textarea
                className="form-control"
                rows={5}
                required
                value={form.body}
                onChange={(e) => setForm({ ...form, body: e.target.value })}
              />
              <small className="wa-hint">Tokens: {MESSAGE_TOKENS.join(" ")}</small>
            </div>
            {error && <p className="wa-result-err">{error}</p>}
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <button type="submit" className="btn btn-wa">
                {editId ? "Update" : "Create"}
              </button>
              {editId && (
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => {
                    setEditId(null);
                    setForm({ name: "", body: "", category: "general" });
                  }}
                >
                  Cancel
                </button>
              )}
            </div>
          </form>
        </div>

        <div className="card table-wrap">
          <h3>Saved templates</h3>
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Category</th>
                <th>Preview</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {templates.map((t) => (
                <tr key={t.id}>
                  <td>{t.name}</td>
                  <td>{t.category}</td>
                  <td style={{ maxWidth: 280 }}>{t.body.slice(0, 80)}…</td>
                  <td>
                    <button type="button" className="btn btn-outline btn-sm" onClick={() => startEdit(t)}>
                      Edit
                    </button>{" "}
                    <button type="button" className="btn btn-outline btn-sm" onClick={() => remove(t.id)}>
                      Del
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
