"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { useClientAuth, canManageWhatsAppApi } from "@/lib/auth-store";

type Assignment = {
  configured: boolean;
  provider: string | null;
  providerLabel: string | null;
  providerDescription?: string;
  dailyLimit: number;
  sentToday: number;
  status: string;
  lastUsedAt: string | null;
  message: string | null;
};

export default function MyWhatsAppPage() {
  const { role, ready: authReady } = useClientAuth();
  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [error, setError] = useState("");
  const [mediaCfg, setMediaCfg] = useState<{ publicBase: string; whatsappPhotoNote?: string } | null>(
    null
  );

  useEffect(() => {
    api<{ assignment: Assignment }>("/whatsapp/my-assignment")
      .then((r) => setAssignment(r.assignment))
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load"));
    api<{ publicBase: string; whatsappPhotoNote?: string }>("/media/config").then(setMediaCfg).catch(() => {});
  }, []);

  const isAdmin = authReady && canManageWhatsAppApi(role);

  return (
    <>
      {error && <div className="alert-error">{error}</div>}

      {isAdmin && (
        <div className="card" style={{ marginBottom: "1rem", borderLeft: "4px solid var(--wa-green)" }}>
          <p style={{ margin: 0 }}>
            <strong>Admin:</strong> Har user ka API assign / edit karne ke liye{" "}
            <Link href="/settings/team" style={{ color: "var(--wa-green)" }}>
              Team WhatsApp API
            </Link>{" "}
            page kholo (sab users + apna khud).
          </p>
        </div>
      )}

      <div className="card" style={{ maxWidth: 520 }}>
        <h3 style={{ marginTop: 0 }}>My WhatsApp API</h3>
        <p className="wa-hint" style={{ marginTop: 0 }}>
          Admin ne jo API assign kiya hai wahi aap use karenge. Yahan sirf dekh sakte hain — change nahi.
        </p>

        {!assignment ? (
          <p>Loading…</p>
        ) : !assignment.configured ? (
          <>
            <div className="alert-error" style={{ marginBottom: "1rem" }}>
              {assignment.message ?? "WhatsApp API abhi assign nahi hua."}
            </div>
            <p className="wa-hint">Admin se boliye: Users → Team WhatsApp API se aapka API set karein.</p>
          </>
        ) : (
          <dl className="wa-dl">
            <dt>Assigned API</dt>
            <dd>
              <span className="badge badge-success">{assignment.providerLabel}</span>
            </dd>
            {assignment.providerDescription && (
              <>
                <dt>Details</dt>
                <dd>{assignment.providerDescription}</dd>
              </>
            )}
            <dt>Connection status</dt>
            <dd>
              <span
                className={`badge ${assignment.status === "active" ? "badge-success" : "badge-stage"}`}
              >
                {assignment.status === "active" ? "Active" : assignment.status}
              </span>
            </dd>
            <dt>Sent today</dt>
            <dd>
              {assignment.sentToday} / {assignment.dailyLimit}
            </dd>
            <dt>Last used</dt>
            <dd>
              {assignment.lastUsedAt
                ? new Date(assignment.lastUsedAt).toLocaleString()
                : "—"}
            </dd>
          </dl>
        )}
      </div>

      {mediaCfg && (
        <div className="card" style={{ marginTop: "1rem", maxWidth: 520 }}>
          <h4 style={{ marginTop: 0 }}>Photos (Browse from PC)</h4>
          <p style={{ margin: 0, fontSize: "0.9rem" }}>
            Server: <strong>{mediaCfg.publicBase}</strong>
            <br />
            <span className="wa-hint">
              {mediaCfg.whatsappPhotoNote ??
                "Bulk / lead messages mein photo bhejne ke liye yahi server use hota hai."}
            </span>
          </p>
        </div>
      )}
    </>
  );
}
