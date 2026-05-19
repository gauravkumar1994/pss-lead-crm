"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { LEAD_STAGES, LEAD_TYPES, MAX_BULK_SIZE, MESSAGE_TOKENS } from "@/lib/constants";
import { useMessageTemplates } from "@/lib/use-templates";
import { MediaUploadField } from "@/components/whatsapp/MediaUploadField";

type LeadRow = {
  id: string;
  leadCode: string;
  name: string;
  mobile: string;
  city?: string;
  stage: string;
  leadType: string;
};

const STEPS = ["Filter", "Select", "Compose", "Preview", "Send"];

export default function BulkWhatsAppPage() {
  const [step, setStep] = useState(0);
  const [filters, setFilters] = useState({
    stage: "",
    leadType: "",
    city: "",
    fromDate: "",
    toDate: "",
    search: "",
  });
  const [leads, setLeads] = useState<LeadRow[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [name, setName] = useState("");
  const [message, setMessage] = useState("Hi {name}, greetings from PSS CRM.");
  const [mediaUrl, setMediaUrl] = useState("");
  const [campaignId, setCampaignId] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<{
    percent: number;
    sent: number;
    failed: number;
    pending: number;
    done: boolean;
  } | null>(null);
  const { templates } = useMessageTemplates();

  async function loadLeads() {
    setLoading(true);
    setError("");
    try {
      const body: Record<string, string> = {};
      if (filters.stage) body.stage = filters.stage;
      if (filters.leadType) body.leadType = filters.leadType;
      if (filters.city) body.city = filters.city;
      if (filters.fromDate) body.fromDate = filters.fromDate;
      if (filters.toDate) body.toDate = filters.toDate;
      if (filters.search) body.search = filters.search;
      const r = await api<{ items: LeadRow[]; count: number }>("/campaigns/filter-leads", {
        method: "POST",
        body: JSON.stringify(body),
      });
      setLeads(r.items);
      setSelected(new Set(r.items.map((l) => l.id)));
      setStep(1);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Filter failed");
    } finally {
      setLoading(false);
    }
  }

  function toggle(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else if (next.size < MAX_BULK_SIZE) next.add(id);
    setSelected(next);
  }

  function selectAll() {
    setSelected(new Set(leads.slice(0, MAX_BULK_SIZE).map((l) => l.id)));
  }

  function personalize(text: string, lead: LeadRow) {
    return text
      .replace(/\{name\}/gi, lead.name)
      .replace(/\{city\}/gi, lead.city ?? "")
      .replace(/\{mobile\}/gi, lead.mobile);
  }

  const selectedLeads = leads.filter((l) => selected.has(l.id));

  async function prepare() {
    setLoading(true);
    setError("");
    try {
      const c = await api<{ id: string }>("/campaigns/prepare", {
        method: "POST",
        body: JSON.stringify({
          name,
          message,
          mediaUrl: mediaUrl || null,
          leadIds: [...selected],
        }),
      });
      setCampaignId(c.id);
      setStep(4);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Prepare failed");
    } finally {
      setLoading(false);
    }
  }

  async function execute() {
    setLoading(true);
    setProgress(null);
    try {
      const r = await api<{ queued: number }>(`/campaigns/${campaignId}/execute`, {
        method: "POST",
      });
      setStatus(`Campaign started — ${r.queued} messages queued (3s delay each)`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Send failed");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!campaignId || step !== 4) return;
    const poll = setInterval(async () => {
      try {
        const p = await api<{
          percent: number;
          sent: number;
          failed: number;
          pending: number;
          done: boolean;
        }>(`/campaigns/${campaignId}/progress`);
        setProgress(p);
        if (p.done) clearInterval(poll);
      } catch {
        /* ignore */
      }
    }, 2000);
    return () => clearInterval(poll);
  }, [campaignId, step]);

  return (
    <>
      <p className="page-intro">
        PSS SOLUTION — max {MAX_BULK_SIZE} leads per campaign · 3s delay · tokens:{" "}
        {MESSAGE_TOKENS.join(" ")}
      </p>
      <div className="wizard-steps">
        {STEPS.map((s, i) => (
          <div key={s} className={`wizard-step ${i === step ? "active" : i < step ? "done" : ""}`}>
            {i + 1}. {s}
          </div>
        ))}
      </div>

      {error && <div className="alert-error" style={{ marginBottom: "1rem" }}>{error}</div>}

      <div className="card">
        {step === 0 && (
          <>
            <h3>Step 1 — Filter leads</h3>
            <div className="form-row">
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
              <div className="form-group">
                <label>From date</label>
                <input
                  type="date"
                  className="form-control"
                  value={filters.fromDate}
                  onChange={(e) => setFilters({ ...filters, fromDate: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>To date</label>
                <input
                  type="date"
                  className="form-control"
                  value={filters.toDate}
                  onChange={(e) => setFilters({ ...filters, toDate: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>Search</label>
                <input
                  className="form-control"
                  placeholder="Name or mobile"
                  value={filters.search}
                  onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                />
              </div>
            </div>
            <button type="button" className="btn btn-wa" onClick={loadLeads} disabled={loading}>
              {loading ? "Loading…" : "Load leads"}
            </button>
          </>
        )}

        {step === 1 && (
          <>
            <h3>
              Step 2 — Select leads (max {MAX_BULK_SIZE}) — {selected.size} selected
            </h3>
            <button type="button" className="btn btn-outline btn-sm" onClick={selectAll} style={{ marginBottom: "0.75rem" }}>
              Select all (up to {MAX_BULK_SIZE})
            </button>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th></th>
                    <th>Code</th>
                    <th>Name</th>
                    <th>Mobile</th>
                    <th>City</th>
                  </tr>
                </thead>
                <tbody>
                  {leads.map((l) => (
                    <tr key={l.id}>
                      <td>
                        <input
                          type="checkbox"
                          checked={selected.has(l.id)}
                          onChange={() => toggle(l.id)}
                        />
                      </td>
                      <td>{l.leadCode}</td>
                      <td>{l.name}</td>
                      <td>{l.mobile}</td>
                      <td>{l.city ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ marginTop: "1rem", display: "flex", gap: "0.5rem" }}>
              <button type="button" className="btn btn-outline" onClick={() => setStep(0)}>
                Back
              </button>
              <button
                type="button"
                className="btn btn-wa"
                disabled={selected.size === 0}
                onClick={() => setStep(2)}
              >
                Next
              </button>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <h3>Step 3 — Compose message</h3>
            <p style={{ color: "var(--wa-muted)", fontSize: "0.85rem" }}>
              Tokens: {MESSAGE_TOKENS.join(", ")}
            </p>
            <div className="form-group">
              <label>Campaign name</label>
              <input className="form-control" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            {templates.length > 0 && (
              <div className="wa-templates" style={{ marginBottom: "0.75rem" }}>
                {templates.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    className="wa-template-chip"
                    onClick={() => setMessage(t.body)}
                  >
                    {t.name}
                  </button>
                ))}
              </div>
            )}
            <div className="form-group">
              <label>Message</label>
              <textarea
                className="form-control"
                rows={5}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
              />
            </div>
            <MediaUploadField
              value={mediaUrl}
              onChange={setMediaUrl}
              label="Campaign photo (same image to all leads)"
            />
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <button type="button" className="btn btn-outline" onClick={() => setStep(1)}>
                Back
              </button>
              <button type="button" className="btn btn-wa" disabled={!name} onClick={() => setStep(3)}>
                Preview
              </button>
            </div>
          </>
        )}

        {step === 3 && (
          <>
            <h3>Step 4 — Preview ({selectedLeads.length} leads)</h3>
            {mediaUrl && (
              <div className="media-preview" style={{ marginBottom: "1rem" }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={mediaUrl} alt="Campaign attachment" />
                <p className="wa-hint">Photo will be sent with every message in this campaign.</p>
              </div>
            )}
            <div style={{ maxHeight: 320, overflowY: "auto" }}>
              {selectedLeads.slice(0, 10).map((l) => (
                <div key={l.id} style={{ padding: "0.75rem", background: "var(--wa-bg)", marginBottom: "0.5rem", borderRadius: 8 }}>
                  <strong>{l.name}</strong> ({l.mobile})
                  <br />
                  <small>{personalize(message, l)}</small>
                </div>
              ))}
              {selectedLeads.length > 10 && (
                <p style={{ color: "var(--wa-muted)" }}>+ {selectedLeads.length - 10} more…</p>
              )}
            </div>
            <div style={{ display: "flex", gap: "0.5rem", marginTop: "1rem" }}>
              <button type="button" className="btn btn-outline" onClick={() => setStep(2)}>
                Back
              </button>
              <button type="button" className="btn btn-wa" onClick={prepare} disabled={loading}>
                Prepare campaign
              </button>
            </div>
          </>
        )}

        {step === 4 && (
          <>
            <h3>Step 5 — Send</h3>
            <p>
              Ready to send to <strong>{selectedLeads.length}</strong> leads.
            </p>
            <button type="button" className="btn btn-wa" onClick={execute} disabled={loading}>
              {loading ? "Starting…" : "Start bulk send"}
            </button>
            {status && <p style={{ color: "var(--wa-green-dark)", marginTop: "1rem" }}>{status}</p>}
            {progress && (
              <div className="campaign-progress card" style={{ marginTop: "1rem" }}>
                <div className="progress-bar-wrap">
                  <div className="progress-bar-fill" style={{ width: `${progress.percent}%` }} />
                </div>
                <p>
                  {progress.percent}% — Sent: {progress.sent}, Failed: {progress.failed}, Pending:{" "}
                  {progress.pending}
                  {progress.done ? " — Complete!" : ""}
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}

