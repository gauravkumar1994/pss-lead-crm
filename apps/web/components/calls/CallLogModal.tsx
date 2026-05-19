"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { CALL_OUTCOMES } from "@/lib/constants";

type Lead = { id: string; name: string; mobile: string };

export function CallLogModal({
  lead,
  onClose,
  onSaved,
}: {
  lead: Lead;
  onClose: () => void;
  onSaved: (todayCount?: number) => void;
}) {
  const [step, setStep] = useState<"dial" | "log">("dial");
  const [outcome, setOutcome] = useState("Connected");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  function startCall() {
    window.location.href = `tel:${lead.mobile}`;
    setStep("log");
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await api("/calls", {
        method: "POST",
        body: JSON.stringify({ leadId: lead.id, outcome, notes }),
      });
      const stats = await api<{ myCallsToday: number }>("/dashboard/stats");
      onSaved(stats.myCallsToday);
      onClose();
    } catch {
      setSaving(false);
    }
  }

  function copyNumber() {
    navigator.clipboard?.writeText(lead.mobile);
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal call-modal animate-scale-in" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>📞 Call — {lead.name}</h3>
          <button type="button" className="btn btn-outline btn-sm" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="modal-body">
          <div className="call-number-box">
            <span className="call-number">{lead.mobile}</span>
            <button type="button" className="btn btn-outline btn-sm" onClick={copyNumber}>
              Copy
            </button>
          </div>

          {step === "dial" && (
            <div className="call-step-dial">
              <p className="call-hint">Call log mandatory — pehle dial karo, phir notes save karo.</p>
              <button type="button" className="btn btn-call btn-send-pulse" onClick={startCall}>
                Open phone dialer
              </button>
            </div>
          )}

          {step === "log" && (
            <form onSubmit={save} className="animate-fade-in">
              <div className="form-group">
                <label>Outcome *</label>
                <select
                  className="form-control"
                  value={outcome}
                  onChange={(e) => setOutcome(e.target.value)}
                >
                  {CALL_OUTCOMES.map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Call notes *</label>
                <textarea
                  className="form-control"
                  required
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="What was discussed?"
                />
              </div>
              <button type="submit" className="btn btn-wa" disabled={saving}>
                {saving ? "Saving…" : "Save call log"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
