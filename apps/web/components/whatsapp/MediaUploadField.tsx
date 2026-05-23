"use client";

import { useEffect, useRef, useState } from "react";
import { api, apiUpload } from "@/lib/api";

type MediaConfig = {
  enabled: boolean;
  publicBase: string;
  whatsappPhotoNote?: string;
};

type Props = {
  value: string;
  onChange: (url: string) => void;
  label?: string;
};

export function MediaUploadField({ value, onChange, label }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [config, setConfig] = useState<MediaConfig | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [fileName, setFileName] = useState("");

  useEffect(() => {
    api<MediaConfig>("/media/config")
      .then(setConfig)
      .catch(() =>
        setConfig({
          enabled: true,
          publicBase: process.env.NEXT_PUBLIC_API_URL ?? "https://pss-crm-api.onrender.com",
          whatsappPhotoNote: "",
        })
      );
  }, []);

  async function onPick(file: File) {
    setBusy(true);
    setError("");
    setFileName(file.name);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const r = await apiUpload<{ url: string }>("/media/upload", fd);
      onChange(r.url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
      setFileName("");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="media-upload">
      <label>{label ?? "Photo (marble / catalog)"}</label>

      <div className="media-upload-actions">
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/quicktime,video/3gpp,video/x-msvideo,video/mpeg"
          className="media-upload-input-hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onPick(f);
            e.target.value = "";
          }}
        />
        <button
          type="button"
          className="btn btn-wa btn-sm"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
        >
          {busy ? "Uploading…" : "Browse photo / video"}
        </button>
        {value && (
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => { onChange(""); setFileName(""); }}>
            Remove
          </button>
        )}
      </div>

      {fileName && <small className="wa-hint">Selected: {fileName}</small>}

      {config?.whatsappPhotoNote && (
        <p className="media-upload-info">{config.whatsappPhotoNote}</p>
      )}

      {value && (
        <div className="media-preview">
          {/\.(mp4|mov|avi|3gp|mpeg|m4v)(\?|$)/i.test(value) ? (
            <video src={value} controls style={{ width: "100%", display: "block" }} />
          ) : (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={value} alt="Attachment" />
          )}
        </div>
      )}

      {error && <p className="wa-result-err">{error}</p>}
    </div>
  );
}
