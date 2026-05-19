"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { MESSAGE_TOKENS } from "@/lib/constants";
import { useMessageTemplates } from "@/lib/use-templates";
import { MediaUploadField } from "@/components/whatsapp/MediaUploadField";

type Lead = { id: string; name: string; mobile: string; city?: string; whatsappCount?: number };

function personalize(text: string, lead: Lead) {
  return text
    .replace(/\{name\}/gi, lead.name)
    .replace(/\{city\}/gi, lead.city ?? "")
    .replace(/\{mobile\}/gi, lead.mobile);
}

export function SingleWhatsAppPanel({
  lead,
  onSent,
  compact,
}: {
  lead: Lead;
  onSent?: () => void;
  compact?: boolean;
}) {
  const { templates } = useMessageTemplates();
  const [message, setMessage] = useState(`Hi ${lead.name},`);
  const [mediaUrl, setMediaUrl] = useState("");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);

  function applyTemplate(text: string) {
    setMessage(personalize(text, lead));
  }

  async function send() {
    setSending(true);
    setResult(null);
    try {
      const r = await api<{ success: boolean; error?: string }>("/whatsapp/send", {
        method: "POST",
        body: JSON.stringify({
          leadId: lead.id,
          message: personalize(message, lead),
          mediaUrl: mediaUrl.trim() || null,
        }),
      });
      if (r.success) {
        setResult({ ok: true, text: "Message sent successfully" });
        onSent?.();
      } else {
        setResult({ ok: false, text: r.error ?? "Send failed" });
      }
    } catch (e) {
      setResult({ ok: false, text: e instanceof Error ? e.message : "Error" });
    } finally {
      setSending(false);
    }
  }

  return (
    <div className={`wa-panel ${compact ? "wa-panel-compact" : ""}`}>
      <div className="wa-panel-header">
        <span className="wa-panel-icon">💬</span>
        <div>
          <strong>Single WhatsApp</strong>
          <small>
            {lead.name} · {lead.mobile}
            {lead.whatsappCount != null && (
              <span className="wa-count-badge"> Sent: {lead.whatsappCount}</span>
            )}
          </small>
        </div>
      </div>

      {!compact && templates.length > 0 && (
        <div className="wa-templates">
          {templates.map((t) => (
            <button
              key={t.id}
              type="button"
              className="wa-template-chip"
              onClick={() => applyTemplate(t.body)}
              title={t.body.slice(0, 80)}
            >
              {t.name}
            </button>
          ))}
        </div>
      )}

      <div className="form-group">
        <label>Message</label>
        <textarea
          className="form-control wa-textarea"
          rows={compact ? 3 : 4}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
        />
        <small className="wa-hint">
          Tokens: {MESSAGE_TOKENS.join(" ")} · {message.length} chars
        </small>
      </div>

      <MediaUploadField
        value={mediaUrl}
        onChange={setMediaUrl}
        label="Marble / catalog photo"
      />

      <div className="wa-preview">
        <span className="wa-preview-label">Preview</span>
        <p>{personalize(message, lead)}</p>
        {mediaUrl && (
          <div className="media-preview media-preview-sm">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={mediaUrl} alt="Will send with message" />
          </div>
        )}
      </div>

      <button
        type="button"
        className="btn btn-wa btn-send-pulse"
        disabled={sending || !message.trim()}
        onClick={send}
      >
        {sending ? "Sending…" : mediaUrl ? "Send photo + message" : "Send WhatsApp"}
      </button>

      {result && <p className={result.ok ? "wa-result-ok" : "wa-result-err"}>{result.text}</p>}
    </div>
  );
}
