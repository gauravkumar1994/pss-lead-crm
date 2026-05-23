"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { api, apiUpload } from "@/lib/api";
import { useClientAuth, canManageWhatsAppApi } from "@/lib/auth-store";
import { MediaUploadField } from "@/components/whatsapp/MediaUploadField";

/* PSS Smart Bulk Automation — Excel/Paste + browse photo/video + preview.
   After hitting "Create batch", Render API worker keeps sending in cloud
   per user's 18-min gap / daily target / time window. User can close browser. */

type Batch = {
  id: string;
  batchCode: string;
  name: string;
  status: string;
  total: number;
  sent: number;
  failed: number;
  skipped: number;
  message: string;
  mediaUrl?: string;
  source?: string;
  createdAt: string;
  user?: { id: string; fullName: string; userCode: string };
};

type Profile = {
  enabled: boolean;
  dailyTarget: number;
  gapMinutes: number;
  startHour: number;
  endHour: number;
  sentToday: number;
  lastSentAt?: string | null;
};

type Assignment = {
  configured: boolean;
  providerLabel: string | null;
  status: string;
  message: string | null;
};

type ParsedRow = { mobile: string; name?: string; city?: string };

function parsePastedRows(text: string): ParsedRow[] {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const out: ParsedRow[] = [];
  for (const line of lines) {
    const parts = line.split(/[,|\t]/).map((p) => p.trim());
    const mobile = parts[0]?.replace(/[^\d]/g, "") ?? "";
    if (mobile.length < 8) continue;
    out.push({ mobile, name: parts[1] || undefined, city: parts[2] || undefined });
  }
  const seen = new Set<string>();
  return out.filter((r) => (seen.has(r.mobile) ? false : (seen.add(r.mobile), true)));
}

function personalize(
  template: string,
  row: { mobile: string; name?: string; city?: string } | null
): string {
  if (!row) return template;
  return template
    .replace(/\{name\}/gi, row.name ?? "")
    .replace(/\{city\}/gi, row.city ?? "")
    .replace(/\{mobile\}/gi, row.mobile);
}

function isVideoUrl(url: string) {
  return /\.(mp4|mov|avi|m4v|3gp|mpeg)(\?|$)/i.test(url);
}

export default function BulkAutomationPage() {
  const { user, ready: authReady } = useClientAuth();
  const isAdmin = authReady && canManageWhatsAppApi(user?.role ?? "USER");

  const [profile, setProfile] = useState<Profile | null>(null);
  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [batches, setBatches] = useState<Batch[]>([]);

  // form state
  const [mode, setMode] = useState<"excel" | "paste">("excel");
  const [name, setName] = useState("");
  const [message, setMessage] = useState("Hi {name}, greetings from PSS SOLUTION.");
  const [mediaUrl, setMediaUrl] = useState("");
  const [paste, setPaste] = useState("");
  const [excelFile, setExcelFile] = useState<File | null>(null);
  const [startNow, setStartNow] = useState(true);
  const [busy, setBusy] = useState(false);
  const [info, setInfo] = useState("");
  const [error, setError] = useState("");

  function loadAll() {
    api<{ profile: Profile }>("/bulk-automation/my-profile")
      .then((r) => setProfile(r.profile))
      .catch(() => {});
    api<{ assignment: Assignment }>("/whatsapp/my-assignment")
      .then((r) => setAssignment(r.assignment))
      .catch(() => {});
    api<{ items: Batch[] }>("/bulk-automation/batches")
      .then((r) => setBatches(r.items))
      .catch(() => {});
  }

  useEffect(() => {
    if (!authReady) return;
    loadAll();
    const t = setInterval(loadAll, 15_000);
    return () => clearInterval(t);
  }, [authReady]);

  const parsed = parsePastedRows(paste);
  const canCreatePaste = parsed.length > 0 && name.trim() && message.trim() && !busy;
  const canCreateExcel = excelFile && name.trim() && message.trim() && !busy;

  // Preview: sample first recipient (from paste) OR generic
  const previewRow = useMemo<ParsedRow | null>(() => {
    if (mode === "paste" && parsed.length > 0) return parsed[0];
    return { mobile: "919876543210", name: "Rahul", city: "Delhi" };
  }, [mode, parsed]);

  const previewText = useMemo(
    () => personalize(message, previewRow),
    [message, previewRow]
  );

  async function createPaste(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setInfo("");
    if (parsed.length === 0) {
      setError("Kam se kam ek valid mobile number paste karo");
      return;
    }
    setBusy(true);
    try {
      const r = await api<{ batch: Batch; droppedRows: number }>(
        "/bulk-automation/import",
        {
          method: "POST",
          body: JSON.stringify({
            name: name.trim(),
            message: message.trim(),
            mediaUrl: mediaUrl.trim() || null,
            source: "paste",
            startNow,
            rows: parsed.map((p) => ({ mobile: p.mobile, name: p.name, city: p.city })),
          }),
        }
      );
      setInfo(
        `Batch banaya — ${r.batch.total} numbers cloud queue mein. ${r.droppedRows} duplicate/invalid drop hue. Tum browser band kar sakte ho, server background mein bhejega.`
      );
      setName("");
      setPaste("");
      setMediaUrl("");
      loadAll();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Batch create failed");
    } finally {
      setBusy(false);
    }
  }

  async function createExcel(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setInfo("");
    if (!excelFile) {
      setError("Excel file select karo");
      return;
    }
    setBusy(true);
    try {
      const fd = new FormData();
      fd.set("file", excelFile);
      fd.set("name", name.trim());
      fd.set("message", message.trim());
      if (mediaUrl.trim()) fd.set("mediaUrl", mediaUrl.trim());
      fd.set("startNow", startNow ? "true" : "false");
      fd.set("source", "excel");
      const r = await apiUpload<{
        batch: Batch;
        droppedRows: number;
        parsedCount: number;
        fileName: string;
      }>("/bulk-automation/import-excel", fd);
      setInfo(
        `${r.fileName}: ${r.parsedCount} rows parse hui, ${r.batch.total} cloud queue mein, ${r.droppedRows} duplicate/invalid drop. Browser band kar sakte ho.`
      );
      setName("");
      setExcelFile(null);
      setMediaUrl("");
      const fileInput = document.getElementById("bulk-excel-input") as HTMLInputElement | null;
      if (fileInput) fileInput.value = "";
      loadAll();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  async function batchAction(batchId: string, action: "pause" | "resume" | "cancel" | "start") {
    try {
      await api(`/bulk-automation/batches/${batchId}/${action}`, { method: "POST" });
      loadAll();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action failed");
    }
  }

  const permissionOk = profile?.enabled === true;
  const apiOk = assignment?.configured === true && assignment?.status === "active";
  const inputCount = mode === "excel" ? (excelFile ? "?" : "0") : String(parsed.length);

  return (
    <>
      {error && <div className="alert-error" style={{ marginBottom: "1rem" }}>{error}</div>}
      {info && (
        <div className="card" style={{ borderLeft: "4px solid var(--wa-green)", marginBottom: "1rem" }}>
          {info}
        </div>
      )}

      {/* Status banner */}
      <div className="card" style={{ marginBottom: "1rem" }}>
        <h3 style={{ marginTop: 0 }}>PSS Smart Bulk Automation</h3>
        <p className="wa-hint" style={{ marginTop: 0 }}>
          Numbers Excel se upload karo (ya paste). Message likho. Photo/video browse karke attach
          karo. Preview check karke send. Cloud server (Render API) tumhare 18-min gap, daily target,
          time window ke hisaab se background mein bhejta rahega — browser band karna safe hai.
        </p>
        <div className="bulk-status-grid">
          <div className={`bulk-pill ${apiOk ? "ok" : "bad"}`}>
            <span>WhatsApp API</span>
            <strong>
              {assignment?.configured
                ? `${assignment.providerLabel} · ${assignment.status}`
                : "Not assigned"}
            </strong>
            {!apiOk && <small>Admin se contact karein</small>}
          </div>
          <div className={`bulk-pill ${permissionOk ? "ok" : "bad"}`}>
            <span>Bulk Permission</span>
            <strong>{permissionOk ? "ENABLED" : "DISABLED"}</strong>
            {!permissionOk && (
              <small>
                Admin ne abhi permission nahi di.{" "}
                {isAdmin && (
                  <Link href="/bulk-automation/profiles" style={{ color: "var(--wa-green-bright)" }}>
                    Enable karo →
                  </Link>
                )}
              </small>
            )}
          </div>
          {profile && (
            <>
              <div className="bulk-pill">
                <span>Daily target</span>
                <strong>
                  {profile.sentToday} / {profile.dailyTarget}
                </strong>
                <small>aaj ki sent / max</small>
              </div>
              <div className="bulk-pill">
                <span>Timing</span>
                <strong>
                  {String(profile.startHour).padStart(2, "0")}:00 – {String(profile.endHour).padStart(2, "0")}:00
                </strong>
                <small>
                  {profile.gapMinutes} min gap
                </small>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="grid-2">
        {/* LEFT: create batch */}
        <div className="card">
          <h3 style={{ marginTop: 0 }}>1. Naya batch banao</h3>

          <div className="tab-row" style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem" }}>
            <button
              type="button"
              className={`btn btn-sm ${mode === "excel" ? "btn-wa" : "btn-outline"}`}
              onClick={() => setMode("excel")}
            >
              Excel upload (recommended)
            </button>
            <button
              type="button"
              className={`btn btn-sm ${mode === "paste" ? "btn-wa" : "btn-outline"}`}
              onClick={() => setMode("paste")}
            >
              Paste numbers
            </button>
          </div>

          {/* Shared fields */}
          <div className="form-group">
            <label>Batch ka naam *</label>
            <input
              className="form-control"
              required
              placeholder="e.g. Promo offer 23 May"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label>Message *</label>
            <textarea
              className="form-control"
              required
              rows={5}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
            <small className="wa-hint">
              Tokens: <code>{"{name}"}</code> <code>{"{city}"}</code> <code>{"{mobile}"}</code>
            </small>
          </div>

          {/* Manual photo/video browse — exactly like quick-send */}
          <MediaUploadField
            value={mediaUrl}
            onChange={setMediaUrl}
            label="Photo / video (optional) — browse karke select karo"
          />

          {mode === "excel" ? (
            <form onSubmit={createExcel}>
              <div className="form-group">
                <label>Excel / CSV file *</label>
                <input
                  id="bulk-excel-input"
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  className="form-control"
                  onChange={(e) => setExcelFile(e.target.files?.[0] ?? null)}
                />
                <small className="wa-hint">
                  Columns: <code>name</code>, <code>mobile</code> (header auto-detected). Mobile 10
                  digit ya 91+10 (e.g. 9876543210 ya 919876543210). Max 20 MB.
                </small>
                {excelFile && (
                  <p style={{ marginTop: "0.5rem" }}>
                    <span className="badge badge-success">
                      {excelFile.name} ({(excelFile.size / 1024).toFixed(1)} KB)
                    </span>
                  </p>
                )}
              </div>
              <div className="form-group" style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <input
                  type="checkbox"
                  id="excelStartNow"
                  checked={startNow}
                  onChange={(e) => setStartNow(e.target.checked)}
                />
                <label htmlFor="excelStartNow" style={{ margin: 0 }}>
                  Turant cloud queue mein activate karo
                </label>
              </div>
              <button type="submit" className="btn btn-wa btn-block" disabled={!canCreateExcel}>
                {busy ? "Uploading…" : "Upload + Create batch"}
              </button>
            </form>
          ) : (
            <form onSubmit={createPaste}>
              <div className="form-group">
                <label>Mobile numbers paste karo *</label>
                <textarea
                  className="form-control"
                  rows={8}
                  placeholder={"9876543210\n9123456789, Rahul\n9988776655, Priya, Mumbai"}
                  value={paste}
                  onChange={(e) => setPaste(e.target.value)}
                  style={{ fontFamily: "monospace" }}
                />
                <small className="wa-hint">
                  Ek number per line. Optional: <code>mobile, name, city</code>. Duplicates auto-skip.
                </small>
                {parsed.length > 0 && (
                  <p style={{ marginTop: "0.5rem" }}>
                    <span className="badge badge-success">{parsed.length} valid numbers detected</span>
                  </p>
                )}
              </div>
              <div className="form-group" style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <input
                  type="checkbox"
                  id="pasteStartNow"
                  checked={startNow}
                  onChange={(e) => setStartNow(e.target.checked)}
                />
                <label htmlFor="pasteStartNow" style={{ margin: 0 }}>
                  Turant cloud queue mein activate karo
                </label>
              </div>
              <button type="submit" className="btn btn-wa btn-block" disabled={!canCreatePaste}>
                {busy ? "Saving…" : `Create batch (${parsed.length} numbers)`}
              </button>
            </form>
          )}

          {(!apiOk || !permissionOk) && (
            <p className="wa-hint" style={{ marginTop: "0.75rem" }}>
              Batch banane allowed hai, lekin worker tab hi bhejega jab WhatsApp API + Bulk Permission dono active honge.
            </p>
          )}
        </div>

        {/* RIGHT: preview + queue */}
        <div>
          {/* Preview */}
          <div className="card" style={{ marginBottom: "1rem" }}>
            <h3 style={{ marginTop: 0 }}>2. Preview (jaisa receiver ko dikhega)</h3>
            <div className="wa-preview" style={{ background: "var(--wa-bubble-bg, #075E54)", color: "#fff", padding: "0.75rem 1rem", borderRadius: "12px", maxWidth: "320px", margin: "0.5rem auto" }}>
              {mediaUrl && (
                <div style={{ marginBottom: "0.5rem" }}>
                  {isVideoUrl(mediaUrl) ? (
                    <video
                      src={mediaUrl}
                      controls
                      style={{ maxWidth: "100%", borderRadius: "8px" }}
                    />
                  ) : (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={mediaUrl}
                      alt="preview"
                      style={{ maxWidth: "100%", borderRadius: "8px", display: "block" }}
                    />
                  )}
                </div>
              )}
              <div style={{ whiteSpace: "pre-wrap", fontSize: "0.95em" }}>
                {previewText || <em style={{ opacity: 0.7 }}>Message yahaan dikhega…</em>}
              </div>
              <div style={{ fontSize: "0.7em", opacity: 0.7, textAlign: "right", marginTop: "0.25rem" }}>
                {new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </div>
            </div>
            <small className="wa-hint" style={{ display: "block", marginTop: "0.5rem" }}>
              Sample: <code>{previewRow?.mobile}</code> · {previewRow?.name ?? "—"} · {previewRow?.city ?? "—"}
              {mode === "excel" && " (Excel rows ka real data parsing ke baad use hoga)"}
            </small>
            <small className="wa-hint">
              Total numbers detect: <strong>{inputCount}</strong> · Estimated time:{" "}
              <strong>
                {profile && inputCount !== "?" && parsed.length > 0
                  ? `${((parsed.length * profile.gapMinutes) / 60).toFixed(1)} hours`
                  : "—"}
              </strong>{" "}
              (at {profile?.gapMinutes ?? 18} min gap)
            </small>
          </div>

          {/* Queue */}
          <div className="card">
            <h3 style={{ marginTop: 0 }}>3. {isAdmin ? "Team bulk queue" : "Tumhari bulk queue"}</h3>
            {batches.length === 0 ? (
              <p className="empty-hint">Abhi koi batch nahi. Left side se banao.</p>
            ) : (
              <div className="bulk-batch-list">
                {batches.map((b) => {
                  const pct = b.total > 0 ? Math.round(((b.sent + b.failed) / b.total) * 100) : 0;
                  return (
                    <div key={b.id} className="bulk-batch-row">
                      <div className="bulk-batch-head">
                        <div>
                          <strong>{b.name}</strong>
                          <small>
                            {b.batchCode} ·{" "}
                            {isAdmin && b.user ? `${b.user.fullName} · ` : ""}
                            {new Date(b.createdAt).toLocaleString()}
                          </small>
                        </div>
                        <span className={`badge badge-status-${b.status.toLowerCase()}`}>{b.status}</span>
                      </div>
                      <div className="progress-bar-wrap" style={{ marginTop: "0.5rem" }}>
                        <div className="progress-bar-fill" style={{ width: `${pct}%` }} />
                      </div>
                      <small>
                        Sent: <b>{b.sent}</b> · Failed: <b>{b.failed}</b> · Skipped: <b>{b.skipped}</b> · Total: <b>{b.total}</b>
                      </small>
                      <div className="bulk-batch-actions">
                        {b.status === "PENDING" && (
                          <button type="button" className="btn btn-wa btn-sm" onClick={() => batchAction(b.id, "start")}>
                            Start
                          </button>
                        )}
                        {b.status === "ACTIVE" && (
                          <button type="button" className="btn btn-outline btn-sm" onClick={() => batchAction(b.id, "pause")}>
                            Pause
                          </button>
                        )}
                        {b.status === "PAUSED" && (
                          <button type="button" className="btn btn-wa btn-sm" onClick={() => batchAction(b.id, "resume")}>
                            Resume
                          </button>
                        )}
                        {(b.status === "ACTIVE" || b.status === "PAUSED" || b.status === "PENDING") && (
                          <button type="button" className="btn btn-ghost btn-sm" onClick={() => batchAction(b.id, "cancel")}>
                            Cancel
                          </button>
                        )}
                        <Link href={`/bulk-automation/batches/${b.id}`} className="btn btn-outline btn-sm">
                          Details
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
