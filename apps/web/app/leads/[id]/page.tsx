"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import { usePageTitle } from "@/lib/page-title-context";
import { REMARK_TYPES } from "@/lib/constants";
import { CallLogModal } from "@/components/calls/CallLogModal";
import { SingleWhatsAppPanel } from "@/components/whatsapp/SingleWhatsAppPanel";
import { canAssignLeads, useClientAuth } from "@/lib/auth-store";

type LeadDetail = {
  id: string;
  leadCode: string;
  name: string;
  mobile: string;
  email?: string;
  city?: string;
  state?: string;
  stage: string;
  leadType: string;
  leadSource?: string;
  product?: string;
  followupNotes?: string;
  nextFollowup?: string;
  whatsappCount: number;
  assignedUser?: { id: string; fullName: string };
  activities: {
    id: string;
    type: string;
    remarkType?: string;
    content: string;
    createdAt: string;
    user: { fullName: string };
  }[];
  calls: { id: string; outcome: string; notes: string; createdAt: string; user: { fullName: string } }[];
};

type UserOpt = { id: string; fullName: string };

export default function LeadDetailPage() {
  const { id } = useParams<{ id: string }>();
  const setPageTitle = usePageTitle();
  const { role, ready: authReady } = useClientAuth();
  const [lead, setLead] = useState<LeadDetail | null>(null);
  const [tab, setTab] = useState<"info" | "activity" | "calls">("info");
  const [remark, setRemark] = useState({ remarkType: "General", content: "", nextDate: "" });
  const [showCall, setShowCall] = useState(false);
  const [showAssign, setShowAssign] = useState(false);
  const [users, setUsers] = useState<UserOpt[]>([]);
  const [assignId, setAssignId] = useState("");

  function load() {
    api<LeadDetail>(`/leads/${id}`).then(setLead);
  }

  useEffect(() => {
    if (id) load();
  }, [id]);

  useEffect(() => {
    if (lead) setPageTitle(lead.name);
  }, [lead, setPageTitle]);

  useEffect(() => {
    if (!authReady || !canAssignLeads(role)) return;
    api<{ items: UserOpt[] }>("/users/active").then((r) => setUsers(r.items));
  }, [authReady, role]);

  async function saveAssign(e: React.FormEvent) {
    e.preventDefault();
    await api(`/leads/${id}/assign`, {
      method: "POST",
      body: JSON.stringify({ assignedUserId: assignId }),
    });
    setShowAssign(false);
    load();
  }

  async function addRemark(e: React.FormEvent) {
    e.preventDefault();
    await api(`/leads/${id}/remarks`, {
      method: "POST",
      body: JSON.stringify({
        remarkType: remark.remarkType,
        content: remark.content,
        nextDate: remark.nextDate ? new Date(remark.nextDate).toISOString() : undefined,
      }),
    });
    setRemark({ remarkType: "General", content: "", nextDate: "" });
    load();
  }

  if (!lead) return <p>Loading…</p>;

  return (
    <>
      <div style={{ marginBottom: "1rem" }}>
        <Link href="/leads">← Back to leads</Link>
      </div>

      <div className="card" style={{ marginBottom: "1rem" }}>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          <button type="button" className={`btn ${tab === "info" ? "btn-wa" : "btn-outline"}`} onClick={() => setTab("info")}>
            Lead info
          </button>
          <button type="button" className={`btn ${tab === "activity" ? "btn-wa" : "btn-outline"}`} onClick={() => setTab("activity")}>
            Follow-up & remarks
          </button>
          <button type="button" className={`btn ${tab === "calls" ? "btn-wa" : "btn-outline"}`} onClick={() => setTab("calls")}>
            Call history
          </button>
          <button type="button" className="btn btn-icon-call" onClick={() => setShowCall(true)}>
            📞 Call + log
          </button>
          {canAssignLeads(role) && (
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => {
                setAssignId(lead.assignedUser?.id ?? "");
                setShowAssign(true);
              }}
            >
              Assign user
            </button>
          )}
        </div>
      </div>

      {tab === "info" && (
        <div className="grid-2">
          <div className="card">
            <h3>Contact</h3>
            <p>
              <strong>Mobile:</strong> {lead.mobile}
            </p>
            <p>
              <strong>Email:</strong> {lead.email ?? "—"}
            </p>
            <p>
              <strong>City:</strong> {lead.city ?? "—"} {lead.state ? `, ${lead.state}` : ""}
            </p>
            <p>
              <strong>Assigned:</strong> {lead.assignedUser?.fullName ?? "—"}
            </p>
            <p>
              <strong>WhatsApp sent:</strong> {lead.whatsappCount}
            </p>
          </div>
          <div className="card">
            <h3>Pipeline</h3>
            <p>
              <span className="badge badge-stage">{lead.stage}</span>{" "}
              <span className={`badge badge-${lead.leadType.toLowerCase()}`}>{lead.leadType}</span>
            </p>
            <p>
              <strong>Source:</strong> {lead.leadSource ?? "—"}
            </p>
            <p>
              <strong>Product:</strong> {lead.product ?? "—"}
            </p>
            <p>
              <strong>Next follow-up:</strong>{" "}
              {lead.nextFollowup ? new Date(lead.nextFollowup).toLocaleString() : "—"}
            </p>
          </div>
          <div style={{ gridColumn: "1 / -1" }}>
            <SingleWhatsAppPanel lead={lead} onSent={load} />
          </div>
        </div>
      )}

      {tab === "activity" && (
        <div className="grid-2">
          <div className="card">
            <h3>Add remark</h3>
            <form onSubmit={addRemark}>
              <div className="form-group">
                <label>Type</label>
                <select className="form-control" value={remark.remarkType} onChange={(e) => setRemark({ ...remark, remarkType: e.target.value })}>
                  {REMARK_TYPES.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Remark</label>
                <textarea className="form-control" required rows={3} value={remark.content} onChange={(e) => setRemark({ ...remark, content: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Next follow-up</label>
                <input type="datetime-local" className="form-control" value={remark.nextDate} onChange={(e) => setRemark({ ...remark, nextDate: e.target.value })} />
              </div>
              <button type="submit" className="btn btn-wa">Save</button>
            </form>
          </div>
          <div className="card">
            <h3>History timeline</h3>
            <ul className="timeline">
              {lead.activities.map((a) => (
                <li key={a.id}>
                  <strong>{a.user.fullName}</strong> · {a.remarkType ?? a.type}
                  <br />
                  {a.content}
                  <div className="meta">{new Date(a.createdAt).toLocaleString()}</div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {tab === "calls" && (
        <div className="card">
          <ul className="timeline">
            {lead.calls.map((c) => (
              <li key={c.id}>
                <strong>{c.outcome}</strong> — {c.user.fullName}
                <br />
                {c.notes}
                <div className="meta">{new Date(c.createdAt).toLocaleString()}</div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {showCall && (
        <CallLogModal lead={lead} onClose={() => setShowCall(false)} onSaved={() => load()} />
      )}

      {showAssign && (
        <div className="modal-backdrop" onClick={() => setShowAssign(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Assign lead — {lead.name}</h3>
              <button type="button" className="btn btn-outline btn-sm" onClick={() => setShowAssign(false)}>
                ✕
              </button>
            </div>
            <div className="modal-body">
              <form onSubmit={saveAssign}>
                <div className="form-group">
                  <label>Sales user</label>
                  <select
                    className="form-control"
                    value={assignId}
                    onChange={(e) => setAssignId(e.target.value)}
                    required
                  >
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.fullName}
                      </option>
                    ))}
                  </select>
                </div>
                <button type="submit" className="btn btn-wa">
                  Save assignment
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
