"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { SingleWhatsAppPanel } from "@/components/whatsapp/SingleWhatsAppPanel";

type RecentItem = {
  id: string;
  content: string;
  createdAt: string;
  lead: {
    id: string;
    name: string;
    mobile: string;
    city?: string;
    leadCode: string;
    whatsappCount: number;
  };
};

type SearchLead = {
  id: string;
  name: string;
  mobile: string;
  city?: string;
  leadCode: string;
  whatsappCount: number;
};

export default function QuickSendPage() {
  const [recent, setRecent] = useState<RecentItem[]>([]);
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<SearchLead[]>([]);
  const [active, setActive] = useState<SearchLead | null>(null);

  function loadRecent() {
    api<{ items: RecentItem[] }>("/whatsapp/recent").then((r) => setRecent(r.items));
  }

  useEffect(() => {
    loadRecent();
  }, []);

  useEffect(() => {
    if (search.length < 2) {
      setResults([]);
      return;
    }
    const t = setTimeout(() => {
      api<{ items: SearchLead[] }>(`/leads?search=${encodeURIComponent(search)}&limit=15`).then(
        (r) => setResults(r.items)
      );
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  return (
    <>
      <div className="quick-send-layout">
        <div className="quick-send-sidebar card">
          <h3>Quick WhatsApp Send</h3>
          <div className="form-group">
            <label>Search lead</label>
            <input
              className="form-control"
              placeholder="Name or mobile…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="quick-search-results">
            {results.map((l) => (
              <button
                key={l.id}
                type="button"
                className={`quick-chat-item ${active?.id === l.id ? "active" : ""}`}
                onClick={() => setActive(l)}
              >
                <strong>{l.name}</strong>
                <small>{l.mobile} · {l.leadCode}</small>
              </button>
            ))}
          </div>
          <h4 className="quick-section-title">Recent WhatsApp</h4>
          <div className="quick-recent-list">
            {recent.map((r) => (
              <button
                key={r.id}
                type="button"
                className={`quick-chat-item ${active?.id === r.lead.id ? "active" : ""}`}
                onClick={() => setActive(r.lead)}
              >
                <strong>{r.lead.name}</strong>
                <small>{new Date(r.createdAt).toLocaleString()}</small>
                <p className="quick-snippet">{r.content.slice(0, 60)}…</p>
              </button>
            ))}
            {!recent.length && <p className="empty-hint">No messages sent yet today.</p>}
          </div>
        </div>

        <div className="quick-send-main">
          {active ? (
            <SingleWhatsAppPanel
              lead={active}
              onSent={() => {
                loadRecent();
                setActive({ ...active, whatsappCount: (active.whatsappCount ?? 0) + 1 });
              }}
            />
          ) : (
            <div className="card wa-empty-state">
              <span className="wa-panel-icon">💬</span>
              <h3>Select a lead to send WhatsApp</h3>
              <p>Search on the left or pick from recent messages.</p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
