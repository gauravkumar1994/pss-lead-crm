"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { LEAD_STAGES } from "@/lib/constants";
import { PageSpinner } from "@/components/ui/PageSpinner";

type LeadMini = {
  id: string;
  leadCode: string;
  name: string;
  mobile: string;
  stage: string;
  leadType: string;
  city?: string;
};

export default function PipelinePage() {
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [byStage, setByStage] = useState<Record<string, LeadMini[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  function load() {
    setLoading(true);
    setError("");
    api<{
      stages: { stage: string; count: number }[];
      byStage: Record<string, LeadMini[]>;
    }>("/leads/pipeline/board")
      .then((pipe) => {
        const map: Record<string, number> = {};
        pipe.stages.forEach((s) => {
          map[s.stage] = s.count;
        });
        setCounts(map);
        setByStage(pipe.byStage);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load pipeline"))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <>
      <div className="followup-hero card">
        <p className="page-intro" style={{ margin: 0 }}>
          Kanban by stage — tap a card to open lead. Swipe columns on mobile.
        </p>
        <button type="button" className="btn btn-outline btn-sm" onClick={load} disabled={loading}>
          Refresh
        </button>
      </div>
      {error && <div className="alert-error">{error}</div>}
      {loading ? (
        <PageSpinner label="Loading pipeline…" />
      ) : (
        <div className="pipeline-board">
          {LEAD_STAGES.map((stage) => (
            <div key={stage} className="pipeline-column card">
              <div className="pipeline-col-header">
                <h4>{stage}</h4>
                <span className="tab-count">{counts[stage] ?? 0}</span>
              </div>
              <div className="pipeline-cards">
                {(byStage[stage] ?? []).map((l) => (
                  <Link key={l.id} href={`/leads/${l.id}`} className="pipeline-card">
                    <strong>{l.name}</strong>
                    <small>{l.mobile}</small>
                    <span className={`badge badge-${l.leadType.toLowerCase()}`}>{l.leadType}</span>
                    {l.city && <small>{l.city}</small>}
                  </Link>
                ))}
                {!byStage[stage]?.length && (
                  <p className="empty-hint">No leads</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
