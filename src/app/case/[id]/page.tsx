"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { getCase, setCaseStatus } from "@/lib/cases";
import type { CaseDoc } from "@/lib/types";

export default function CaseDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [c, setC] = useState<CaseDoc | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    setLoading(true);
    try {
      setC(await getCase(id));
    } catch (e) {
      setError(String((e as Error)?.message ?? e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (id) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function setStatus(status: CaseDoc["status"]) {
    setBusy(true);
    try {
      await setCaseStatus(id, status);
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function reEnrich() {
    setBusy(true);
    try {
      await fetch(`/api/cases/${id}/enrich`, { method: "POST" });
      await load();
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <p className="font-bold">Loading…</p>;
  if (error) return <p className="nb-badge bg-[var(--danger)] text-white">{error}</p>;
  if (!c) return <p className="font-bold">Case not found.</p>;

  const s = c.descriptionStructured;
  const statusColor =
    c.status === "missing"
      ? "var(--danger)"
      : c.status === "found"
        ? "var(--warning)"
        : c.status === "resolved"
          ? "var(--success)"
          : "#ccc";

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="nb-card p-5 flex items-start gap-4">
        {c.photoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={c.photoUrl} alt="" className="h-24 w-24 object-cover border-[3px] border-ink" />
        )}
        <div className="flex-1">
          <div className="flex items-center justify-between gap-3">
            <h1 className="text-3xl uppercase">{c.name || "(no name)"}</h1>
            <span className="nb-badge" style={{ background: statusColor, color: c.status === "missing" ? "#fff" : "var(--ink)" }}>
              {c.status}
            </span>
          </div>
          <div className="font-mono font-bold opacity-60">{c.caseId}</div>
          {c.colourSignature && c.colourSignature.length > 0 && (
            <div className="flex gap-1 mt-2">
              {c.colourSignature.map((hex) => (
                <span key={hex} title={hex} className="h-7 w-7 border-[3px] border-ink" style={{ background: hex }} />
              ))}
            </div>
          )}
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm font-semibold nb-card-flat p-4">
        <Row k="Kind" v={c.kind} />
        <Row k="Centre" v={c.centreId} />
        <Row k="Language" v={c.language} />
        <Row k="Age band" v={c.ageBand ?? "—"} />
        <Row k="Gender" v={c.gender} />
        <Row k="Last seen" v={c.lastSeenZone ?? "—"} />
        <Row k="Enriched" v={c.embeddedAt ? "yes" : "pending (offline?)"} />
        <Row k="Share link" v={c.shareLinkId ? `/find/${c.shareLinkId}` : "—"} />
      </dl>

      {c.descriptionRaw && (
        <div className="nb-card-flat p-4">
          <h2 className="nb-label">Description (original)</h2>
          <p className="text-sm font-semibold mt-1">{c.descriptionRaw}</p>
        </div>
      )}

      {s && (
        <div className="nb-card-flat p-4">
          <h2 className="nb-label mb-2">Structured (Gemini)</h2>
          <div className="flex flex-wrap gap-1.5">
            {[
              ...s.clothingColours.map((x) => ["colour", x] as const),
              ...s.garmentTypes.map((x) => ["garment", x] as const),
              ...s.distinguishingMarks.map((x) => ["mark", x] as const),
              ...s.healthIndicators.map((x) => ["health", x] as const),
              ...s.destinationMentioned.map((x) => ["destination", x] as const),
            ].map(([t, x], i) => (
              <span key={i} className="nb-chip bg-[var(--cyan)]">
                <span className="opacity-60">{t}:</span> {x}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        {c.status !== "resolved" && (
          <button onClick={() => setStatus("resolved")} disabled={busy} className="nb-btn nb-btn-success">
            Mark reunited
          </button>
        )}
        {!c.embeddedAt && (
          <button onClick={reEnrich} disabled={busy} className="nb-btn">
            Run enrichment now
          </button>
        )}
        <Link href="/search" className="nb-btn">
          Back to search
        </Link>
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <>
      <dt className="uppercase text-xs opacity-60">{k}</dt>
      <dd className="text-right sm:text-left">{v}</dd>
    </>
  );
}
