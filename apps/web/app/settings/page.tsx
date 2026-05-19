"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";

type ProviderMeta = {
  id: string;
  label: string;
  description: string;
  supportsMedia: boolean;
  mediaNote?: string;
  fields: { key: string; label: string; type: string; required: boolean; placeholder?: string; help?: string }[];
};

export default function SettingsPage() {
  const [providers, setProviders] = useState<ProviderMeta[]>([]);
  const [provider, setProvider] = useState("ULTRAMSG");
  const [fields, setFields] = useState<Record<string, string>>({});
  const [testTo, setTestTo] = useState("");
  const [msg, setMsg] = useState("");
  const [mediaCfg, setMediaCfg] = useState<{
    publicBase: string;
    whatsappPhotoNote?: string;
  } | null>(null);

  useEffect(() => {
    api<{ providers: ProviderMeta[] }>("/whatsapp/providers").then((r) => setProviders(r.providers));
    api<{ publicBase: string; whatsappPhotoNote?: string }>("/media/config").then(setMediaCfg);
    api<{ integration: { provider: string; instanceId: string; baseUrl?: string } | null }>(
      "/whatsapp/integration"
    ).then((r) => {
      if (r.integration) {
        setProvider(r.integration.provider);
        setFields({
          instanceId: r.integration.instanceId,
          baseUrl: r.integration.baseUrl ?? "",
        });
      }
    });
  }, []);

  const meta = providers.find((p) => p.id === provider);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    await api("/whatsapp/integration", {
      method: "PUT",
      body: JSON.stringify({
        provider,
        instanceId: fields.instanceId,
        accessToken: fields.accessToken,
        baseUrl: fields.baseUrl || null,
        phone: fields.phone,
        dailyLimit: fields.dailyLimit ? Number(fields.dailyLimit) : 1000,
      }),
    });
    setMsg("Settings saved successfully");
  }

  async function testSend() {
    const r = await api<{ success: boolean; error?: string }>("/whatsapp/test", {
      method: "POST",
      body: JSON.stringify({ to: testTo }),
    });
    setMsg(r.success ? "Test message sent" : r.error ?? "Failed");
  }

  return (
    <>
      {msg && (
        <div className="card" style={{ marginBottom: "1rem", borderLeft: "4px solid var(--wa-green)" }}>
          {msg}
        </div>
      )}

      {mediaCfg && (
        <div className="card" style={{ marginBottom: "1rem", borderLeft: "4px solid var(--wa-green)" }}>
          <h3 style={{ marginTop: 0 }}>Marble photos (Browse from PC)</h3>
          <p style={{ margin: 0 }}>
            Server: <strong>{mediaCfg.publicBase}</strong>
            <br />
            {mediaCfg.whatsappPhotoNote ??
              "Set PUBLIC_API_URL in apps/api/.env to your PC LAN IP (e.g. http://192.168.1.5:4000)."}
          </p>
        </div>
      )}

      <div className="provider-grid">
        {providers.map((p) => (
          <div
            key={p.id}
            className={`provider-card ${provider === p.id ? "selected" : ""}`}
            onClick={() => setProvider(p.id)}
            role="button"
          >
            <h4>{p.label}</h4>
            <p style={{ fontSize: "0.85rem", color: "var(--wa-muted)", margin: 0 }}>{p.description}</p>
            {p.mediaNote && (
              <small style={{ color: "var(--wa-warning)" }}>{p.mediaNote}</small>
            )}
          </div>
        ))}
      </div>

      <div className="card" style={{ maxWidth: 560 }}>
        <h3 style={{ marginTop: 0 }}>API credentials — {meta?.label}</h3>
        <form onSubmit={save}>
          {meta?.fields.map((f) => (
            <div key={f.key} className="form-group">
              <label>{f.label}{f.required ? " *" : ""}</label>
              <input
                type={f.type === "password" ? "password" : "text"}
                className="form-control"
                required={f.required}
                placeholder={f.placeholder}
                value={fields[f.key] ?? ""}
                onChange={(e) => setFields({ ...fields, [f.key]: e.target.value })}
              />
              {f.help && <small style={{ color: "var(--wa-muted)" }}>{f.help}</small>}
            </div>
          ))}
          <button type="submit" className="btn btn-wa">
            Save settings
          </button>
        </form>

        <hr style={{ borderColor: "var(--wa-border)", margin: "1.5rem 0" }} />

        <h4>Test connection</h4>
        <div className="form-group">
          <label>Test mobile number</label>
          <input className="form-control" value={testTo} onChange={(e) => setTestTo(e.target.value)} />
        </div>
        <button type="button" className="btn btn-outline" onClick={testSend}>
          Send test message
        </button>
      </div>
    </>
  );
}
