"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useDebounced } from "@/lib/use-debounced";
import { LEAD_STAGES, LEAD_TYPES, REMARK_TYPES } from "@/lib/constants";
import { canAssignLeads, useClientAuth } from "@/lib/auth-store";
import { CallLogModal } from "@/components/calls/CallLogModal";
import { WhatsAppSendModal } from "@/components/whatsapp/WhatsAppSendModal";
import { PageSpinner } from "@/components/ui/PageSpinner";

type Lead = {
  id: string;
  leadCode: string;
  name: string;
  mobile: string;
  email?: string;
  city?: string;
  stage: string;
  leadType: string;
  leadSource?: string;
  assignedUser?: { id: string; fullName: string };
  nextFollowup?: string;
  whatsappCount: number;
};

type UserOpt = { id: string; fullName: string };

export default function LeadsPage() {
  const router = useRouter();
  const { role, ready: authReady } = useClientAuth();
  const [items, setItems] = useState<Lead[]>([]);
  const [users, setUsers] = useState<UserOpt[]>([]);
  const [filters, setFilters] = useState({
    search: "",
    stage: "",
    leadType: "",
    city: "",
    assignedUserId: "",
    fromDate: "",
    toDate: "",
  });
  const debouncedFilters = useDebounced(filters, 300);
  const [modal, setModal] = useState<"add" | "edit" | "remark" | "assign" | "import" | null>(null);
  const [active, setActive] = useState<Lead | null>(null);
  const [waModalLead, setWaModalLead] = useState<Lead | null>(null);
  const [callLead, setCallLead] = useState<Lead | null>(null);
  const [form, setForm] = useState({
    name: "",
    mobile: "",
    email: "",
    city: "",
    leadSource: "",
    leadType: "COLD",
    stage: "NEW",
    product: "",
    assignedUserId: "",
  });
  const [remark, setRemark] = useState({ remarkType: "General", content: "", nextDate: "" });
  const [assignId, setAssignId] = useState("");
  const [importText, setImportText] = useState("");
  const [importResult, setImportResult] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    const q = new URLSearchParams();
    if (debouncedFilters.search) q.set("search", debouncedFilters.search);
    if (debouncedFilters.stage) q.set("stage", debouncedFilters.stage);
    if (debouncedFilters.leadType) q.set("leadType", debouncedFilters.leadType);
    if (debouncedFilters.city) q.set("city", debouncedFilters.city);
    if (debouncedFilters.assignedUserId) q.set("assignedUserId", debouncedFilters.assignedUserId);
    if (debouncedFilters.fromDate) q.set("fromDate", debouncedFilters.fromDate);
    if (debouncedFilters.toDate) q.set("toDate", debouncedFilters.toDate);
    api<{ items: Lead[] }>(`/leads?${q}`)
      .then((r) => setItems(r.items))
      .finally(() => setLoading(false));
  }, [debouncedFilters]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!authReady || !canAssignLeads(role)) return;
    api<{ items: UserOpt[] }>("/users/active").then((r) => setUsers(r.items));
  }, [authReady, role]);

  async function addLead(e: React.FormEvent) {
    e.preventDefault();
    await api("/leads", { method: "POST", body: JSON.stringify(form) });
    setModal(null);
    load();
  }

  async function saveRemark(e: React.FormEvent) {
    e.preventDefault();
    if (!active) return;
    await api(`/leads/${active.id}/remarks`, {
      method: "POST",
      body: JSON.stringify({
        remarkType: remark.remarkType,
        content: remark.content,
        nextDate: remark.nextDate ? new Date(remark.nextDate).toISOString() : undefined,
      }),
    });
    setModal(null);
    load();
  }

  async function saveAssign(e: React.FormEvent) {
    e.preventDefault();
    if (!active) return;
    await api(`/leads/${active.id}/assign`, {
      method: "POST",
      body: JSON.stringify({ assignedUserId: assignId }),
    });
    setModal(null);
    load();
  }

  async function openAssignModal(lead: Lead) {
    setActive(lead);
    setAssignId(lead.assignedUser?.id ?? "");
    if (canAssignLeads(role) && users.length === 0) {
      const r = await api<{ items: UserOpt[] }>("/users/active");
      setUsers(r.items);
    }
    setModal("assign");
  }

  function openEdit(l: Lead) {
    setActive(l);
    setForm({
      name: l.name,
      mobile: l.mobile,
      email: l.email ?? "",
      city: l.city ?? "",
      leadSource: l.leadSource ?? "",
      leadType: l.leadType,
      stage: l.stage,
      product: "",
      assignedUserId: l.assignedUser?.id ?? "",
    });
    setModal("edit");
  }

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!active) return;
    await api(`/leads/${active.id}`, {
      method: "PATCH",
      body: JSON.stringify({
        name: form.name,
        mobile: form.mobile,
        email: form.email || undefined,
        city: form.city || undefined,
        leadSource: form.leadSource || undefined,
        leadType: form.leadType,
        stage: form.stage,
        tags: undefined,
      }),
    });
    setModal(null);
    load();
  }

  async function runImport(e: React.FormEvent) {
    e.preventDefault();
    const lines = importText.trim().split(/\r?\n/).filter(Boolean);
    if (lines.length < 2) {
      setImportResult("Add header row + at least one data row");
      return;
    }
    const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
    const nameIdx = headers.indexOf("name");
    const mobileIdx = headers.indexOf("mobile");
    if (nameIdx < 0 || mobileIdx < 0) {
      setImportResult("CSV must have name,mobile columns");
      return;
    }
    const rows = lines.slice(1).map((line) => {
      const cols = line.split(",").map((c) => c.trim());
      const row: Record<string, string> = {
        name: cols[nameIdx] ?? "",
        mobile: cols[mobileIdx] ?? "",
      };
      const cityIdx = headers.indexOf("city");
      const srcIdx = headers.indexOf("leadsource");
      const tagsIdx = headers.indexOf("tags");
      if (cityIdx >= 0) row.city = cols[cityIdx];
      if (srcIdx >= 0) row.leadSource = cols[srcIdx];
      if (tagsIdx >= 0) row.tags = cols[tagsIdx];
      return row;
    });
    const r = await api<{ created: number; skipped: number }>("/leads/import", {
      method: "POST",
      body: JSON.stringify({ rows }),
    });
    setImportResult(`Imported ${r.created}, skipped ${r.skipped}`);
    load();
  }

  return (
    <>
      {callLead && (
        <CallLogModal
          lead={callLead}
          onClose={() => setCallLead(null)}
          onSaved={() => load()}
        />
      )}
      <div className="filter-bar">
        <div className="form-row">
          <div className="form-group">
            <label>Search</label>
            <input
              className="form-control"
              placeholder="Name, mobile, code"
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label>Stage</label>
            <select
              className="form-control"
              value={filters.stage}
              onChange={(e) => setFilters({ ...filters, stage: e.target.value })}
            >
              <option value="">All</option>
              {LEAD_STAGES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>Type</label>
            <select
              className="form-control"
              value={filters.leadType}
              onChange={(e) => setFilters({ ...filters, leadType: e.target.value })}
            >
              <option value="">All</option>
              {LEAD_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>City</label>
            <input
              className="form-control"
              value={filters.city}
              onChange={(e) => setFilters({ ...filters, city: e.target.value })}
            />
          </div>
          {canAssignLeads(role) && (
            <div className="form-group">
              <label>Assigned to</label>
              <select
                className="form-control"
                value={filters.assignedUserId}
                onChange={(e) => setFilters({ ...filters, assignedUserId: e.target.value })}
              >
                <option value="">All users</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.fullName}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="form-group">
            <label>From</label>
            <input
              type="date"
              className="form-control"
              value={filters.fromDate}
              onChange={(e) => setFilters({ ...filters, fromDate: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label>To</label>
            <input
              type="date"
              className="form-control"
              value={filters.toDate}
              onChange={(e) => setFilters({ ...filters, toDate: e.target.value })}
            />
          </div>
        </div>
        <div className="toolbar-row">
          <button type="button" className="btn btn-wa" onClick={load}>
            Apply filters
          </button>
          <button type="button" className="btn btn-wa" onClick={() => setModal("add")}>
            + Add Lead
          </button>
          <button type="button" className="btn btn-outline" onClick={() => { setImportText("name,mobile,city,leadsource,tags\n"); setImportResult(""); setModal("import"); }}>
            Import CSV
          </button>
          <Link href="/bulk" className="btn btn-outline">
            Bulk WhatsApp
          </Link>
        </div>
      </div>

      <div className="card table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Code</th>
              <th>Name</th>
              <th>Mobile</th>
              <th>Stage</th>
              <th>Type</th>
              <th>City</th>
              <th>Assigned</th>
              <th>WA</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && items.length === 0 && (
              <tr>
                <td colSpan={9}>
                  <PageSpinner label="Loading leads…" />
                </td>
              </tr>
            )}
            {!loading && items.length === 0 && (
              <tr>
                <td colSpan={9} className="empty-hint">
                  No leads found. Change filters or add a lead.
                </td>
              </tr>
            )}
            {items.map((l) => (
              <tr key={l.id}>
                <td>
                  <Link href={`/leads/${l.id}`}>{l.leadCode}</Link>
                </td>
                <td>{l.name}</td>
                <td>{l.mobile}</td>
                <td>
                  <span className="badge badge-stage">{l.stage}</span>
                </td>
                <td>
                  <span className={`badge badge-${l.leadType.toLowerCase()}`}>{l.leadType}</span>
                </td>
                <td>{l.city ?? "—"}</td>
                <td>{l.assignedUser?.fullName ?? "—"}</td>
                <td>{l.whatsappCount}</td>
                <td className="actions-cell">
                  <div className="action-btns">
                    <button
                      type="button"
                      className="btn btn-outline btn-sm btn-icon"
                      title="Remark"
                      onClick={() => {
                        setActive(l);
                        setModal("remark");
                      }}
                    >
                      📝
                    </button>
                    <button
                      type="button"
                      className="btn btn-sm btn-wa"
                      title="Single WhatsApp"
                      onClick={() => setWaModalLead(l)}
                    >
                      WhatsApp
                    </button>
                    <button
                      type="button"
                      className="btn btn-icon-call btn-sm btn-icon"
                      title="Call + log"
                      onClick={() => setCallLead(l)}
                    >
                      📞
                    </button>
                    {canAssignLeads(role) && (
                      <button
                        type="button"
                        className="btn btn-outline btn-sm"
                        title="Assign to user"
                        onClick={() => openAssignModal(l)}
                      >
                        Assign
                      </button>
                    )}
                    <button
                      type="button"
                      className="btn btn-outline btn-sm btn-icon"
                      title="Edit"
                      onClick={() => openEdit(l)}
                    >
                      ✏️
                    </button>
                    <button
                      type="button"
                      className="btn btn-outline btn-sm"
                      onClick={() => router.push(`/leads/${l.id}`)}
                    >
                      View
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {waModalLead && (
        <WhatsAppSendModal lead={waModalLead} onClose={() => setWaModalLead(null)} onSent={load} />
      )}

      {modal === "add" && (
        <Modal title="Add Lead" onClose={() => setModal(null)}>
          <form onSubmit={addLead}>
            <div className="form-row">
              <div className="form-group">
                <label>Name *</label>
                <input className="form-control" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Mobile *</label>
                <input className="form-control" required value={form.mobile} onChange={(e) => setForm({ ...form, mobile: e.target.value })} />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Email</label>
                <input className="form-control" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
              <div className="form-group">
                <label>City</label>
                <input className="form-control" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Source</label>
                <input className="form-control" value={form.leadSource} onChange={(e) => setForm({ ...form, leadSource: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Type</label>
                <select className="form-control" value={form.leadType} onChange={(e) => setForm({ ...form, leadType: e.target.value })}>
                  {LEAD_TYPES.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Stage</label>
                <select className="form-control" value={form.stage} onChange={(e) => setForm({ ...form, stage: e.target.value })}>
                  {LEAD_STAGES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
            </div>
            {canAssignLeads(role) && (
              <div className="form-group">
                <label>Assign to</label>
                <select className="form-control" value={form.assignedUserId} onChange={(e) => setForm({ ...form, assignedUserId: e.target.value })}>
                  <option value="">Self</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>{u.fullName}</option>
                  ))}
                </select>
              </div>
            )}
            <button type="submit" className="btn btn-wa">Save lead</button>
          </form>
        </Modal>
      )}

      {modal === "remark" && active && (
        <Modal title={`Remark — ${active.name}`} onClose={() => setModal(null)}>
          <form onSubmit={saveRemark}>
            <div className="form-group">
              <label>Remark type</label>
              <select className="form-control" value={remark.remarkType} onChange={(e) => setRemark({ ...remark, remarkType: e.target.value })}>
                {REMARK_TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Remark *</label>
              <textarea className="form-control" required rows={3} value={remark.content} onChange={(e) => setRemark({ ...remark, content: e.target.value })} />
            </div>
            <div className="form-group">
              <label>Next follow-up</label>
              <input type="datetime-local" className="form-control" value={remark.nextDate} onChange={(e) => setRemark({ ...remark, nextDate: e.target.value })} />
            </div>
            <button type="submit" className="btn btn-wa">Save remark</button>
          </form>
        </Modal>
      )}

      {modal === "edit" && active && (
        <Modal title={`Edit — ${active.name}`} onClose={() => setModal(null)}>
          <form onSubmit={saveEdit}>
            <div className="form-row">
              <div className="form-group">
                <label>Name *</label>
                <input className="form-control" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Mobile *</label>
                <input className="form-control" required value={form.mobile} onChange={(e) => setForm({ ...form, mobile: e.target.value })} />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Email</label>
                <input className="form-control" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
              <div className="form-group">
                <label>City</label>
                <input className="form-control" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Source</label>
                <input className="form-control" value={form.leadSource} onChange={(e) => setForm({ ...form, leadSource: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Type</label>
                <select className="form-control" value={form.leadType} onChange={(e) => setForm({ ...form, leadType: e.target.value })}>
                  {LEAD_TYPES.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Stage</label>
                <select className="form-control" value={form.stage} onChange={(e) => setForm({ ...form, stage: e.target.value })}>
                  {LEAD_STAGES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
            </div>
            <button type="submit" className="btn btn-wa">Save changes</button>
          </form>
        </Modal>
      )}

      {modal === "import" && (
        <Modal title="Import leads (CSV)" onClose={() => setModal(null)}>
          <p className="page-intro">Format: name,mobile,city,leadsource,tags — one lead per line.</p>
          <form onSubmit={runImport}>
            <textarea className="form-control" rows={10} value={importText} onChange={(e) => setImportText(e.target.value)} />
            {importResult && <p className="wa-result-ok">{importResult}</p>}
            <button type="submit" className="btn btn-wa">Import</button>
          </form>
        </Modal>
      )}

      {modal === "assign" && active && (
        <Modal title={`Assign — ${active.name}`} onClose={() => setModal(null)}>
          <form onSubmit={saveAssign}>
            <div className="form-group">
              <label>Assign to</label>
              <select className="form-control" value={assignId} onChange={(e) => setAssignId(e.target.value)} required>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>{u.fullName}</option>
                ))}
              </select>
            </div>
            <button type="submit" className="btn btn-wa">Assign</button>
          </form>
        </Modal>
      )}
    </>
  );
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal modal-lg" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{title}</h3>
          <button type="button" className="btn btn-outline btn-sm" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}

