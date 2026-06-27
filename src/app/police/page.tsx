"use client";

import { useCallback, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { listOpenCases } from "@/lib/cases";
import {
  getZones,
  listPa,
  listTips,
  paAction,
  mergeCase,
  clearProbable,
  runTick,
  enrichBatch,
  type ZoneRisk,
} from "@/lib/ops";
import { exportBriefing } from "@/lib/pdf";
import type { CaseDoc, PaQueueDoc, TipDoc } from "@/lib/types";

const HotspotMap = dynamic(() => import("@/components/HotspotMap"), { ssr: false });

const BAND_BG: Record<string, string> = {
  critical: "var(--danger)",
  elevated: "var(--warning)",
  moderate: "var(--cyan)",
  low: "var(--lime)",
};

export default function PolicePage() {
  const [zones, setZones] = useState<ZoneRisk[]>([]);
  const [cases, setCases] = useState<CaseDoc[]>([]);
  const [pa, setPa] = useState<PaQueueDoc[]>([]);
  const [tips, setTips] = useState<TipDoc[]>([]);
  const [busy, setBusy] = useState(false);
  const [tickMsg, setTickMsg] = useState<string | null>(null);
  const [enrichMsg, setEnrichMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [z, c, p, t] = await Promise.all([
      getZones().catch(() => []),
      listOpenCases().catch(() => []),
      listPa().catch(() => []),
      listTips().catch(() => []),
    ]);
    setZones(z);
    setCases(c);
    setPa(p);
    setTips(t);
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, 30_000);
    return () => clearInterval(interval);
  }, [load]);

  const conflicts = cases.filter((c) => c.mergeReview);
  const probables = cases.filter((c) => c.probable);
  const pendingPa = pa.filter((p) => p.status === "pending" || p.status === "broadcasting");
  const unverifiedTips = tips.filter((t) => t.status === "unverified");
  const activeLinks = cases.filter((c) => c.shareLinkId && c.status !== "resolved").length;
  const escalated = cases.filter((c) => c.escalationStage && c.escalationStage !== "active");

  async function act(id: string, action: "approve" | "broadcast" | "cancel") {
    setBusy(true);
    try {
      await paAction(id, action);
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function doMerge(id: string, into?: string) {
    if (!into) return;
    setBusy(true);
    try {
      await mergeCase(id, into);
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function rejectProbable(id: string) {
    setBusy(true);
    try {
      await clearProbable(id);
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function tick() {
    setBusy(true);
    setTickMsg(null);
    try {
      const a = await runTick(true);
      setTickMsg(
        `tick: PA round2 ${a.paRound2}, expanded ${a.paExpanded}, conflicts ${a.conflicts}, archived ${a.archived}, bureau ${a.bureau}, national ${a.national}`,
      );
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function runEnrichBatch() {
    setBusy(true);
    setEnrichMsg("Starting enrichment…");
    let totalEnriched = 0;
    let totalFailed = 0;
    try {
      let remaining = Infinity;
      while (remaining > 0) {
        const r = await enrichBatch();
        totalEnriched += r.enriched;
        totalFailed += r.failed;
        remaining = r.remaining;
        setEnrichMsg(
          `Enriching… ${totalEnriched} done${totalFailed ? `, ${totalFailed} failed` : ""}${remaining > 0 ? `, ${remaining} remaining` : " — complete!"}`,
        );
      }
      await load();
    } catch (e) {
      setEnrichMsg(`Error: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  const stats = [
    { label: "Open cases", value: cases.length, bg: "var(--danger)" },
    { label: "Pending PA", value: pendingPa.length, bg: "var(--warning)" },
    { label: "Active links", value: activeLinks, bg: "var(--cyan)" },
    { label: "Unverified tips", value: unverifiedTips.length, bg: "var(--accent)" },
  ];

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-baseline gap-3">
          <h1 className="text-4xl uppercase">Command</h1>
          <span className="text-xs font-extrabold uppercase tracking-widest opacity-60">
            Live · 30 s
          </span>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => exportBriefing({ zones, cases, pa, tips })}
            className="nb-btn"
          >
            Export briefing PDF
          </button>
          <button onClick={tick} disabled={busy} className="nb-btn nb-btn-warning">
            Run scheduler tick ⚡
          </button>
          <button onClick={runEnrichBatch} disabled={busy} className="nb-btn">
            Enrich all cases (Gemini)
          </button>
        </div>
      </div>
      {tickMsg && <div className="nb-card-flat p-2 text-xs font-bold">{tickMsg}</div>}
      {enrichMsg && <div className="nb-card-flat p-2 text-xs font-bold">{enrichMsg}</div>}

      <section className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {stats.map((s) => (
          <div key={s.label} className="nb-card p-4" style={{ background: s.bg }}>
            <div className="text-4xl font-extrabold">{s.value}</div>
            <div className="text-xs font-extrabold uppercase mt-1">{s.label}</div>
          </div>
        ))}
      </section>

      <section className="space-y-3">
        <h2 className="nb-label">Hotspot map · risk by zone</h2>
        <HotspotMap zones={zones} />
        <div className="nb-card divide-y-[3px] divide-ink">
          {zones.map((z) => (
            <div key={z.id} className="flex items-center justify-between px-4 py-2 text-sm font-bold">
              <span>{z.name}</span>
              <span className="flex items-center gap-3">
                <span className="opacity-60 text-xs">
                  {z.activeCases} cases · {z.cameraCount} cams · {z.chokepointCount} choke
                </span>
                <span className="nb-badge" style={{ background: BAND_BG[z.riskBand] }}>
                  {z.riskScore.toFixed(2)} {z.riskBand}
                </span>
              </span>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="nb-label">PA announcement queue</h2>
        <div className="space-y-3">
          {pa.length === 0 && (
            <div className="nb-card-flat p-4 text-sm font-bold opacity-60">
              No announcements yet. Create a missing-person case with a name/description.
            </div>
          )}
          {pa.map((p) => (
            <div key={p.id} className="nb-card p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-mono font-bold">{p.caseHumanId}</span>
                <span className="nb-badge bg-[var(--cyan)]">{p.status}</span>
              </div>
              <div className="text-xs font-bold opacity-60">
                {p.language} · node: {p.node} · {p.broadcasts?.length ?? 0}× broadcast
                {(p.broadcasts?.length ?? 0) > 0 &&
                  ` (rounds: ${p.broadcasts.map((b) => `${b.round}@${b.node}`).join(", ")})`}
              </div>
              <p className="text-sm font-semibold border-l-[3px] border-ink pl-2">{p.text}</p>
              <div className="flex gap-2">
                {p.status === "pending" && (
                  <button onClick={() => act(p.id, "approve")} disabled={busy} className="nb-btn nb-btn-success text-xs py-1">
                    Approve & broadcast ×2
                  </button>
                )}
                {p.status === "broadcasting" && (
                  <button onClick={() => act(p.id, "broadcast")} disabled={busy} className="nb-btn text-xs py-1">
                    Broadcast now
                  </button>
                )}
                {p.status !== "cancelled" && p.status !== "done" && (
                  <button onClick={() => act(p.id, "cancel")} disabled={busy} className="nb-btn text-xs py-1">
                    Cancel
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="nb-label">Conflict queue · same photo at two centres</h2>
        {conflicts.length === 0 ? (
          <div className="nb-card-flat p-4 text-sm font-bold opacity-60">No merge conflicts.</div>
        ) : (
          <div className="space-y-2">
            {conflicts.map((c) => (
              <div key={c.id} className="nb-card p-4 flex items-center justify-between gap-3">
                <div className="text-sm font-bold">
                  <Link href={`/case/${c.id}`} className="underline">
                    {c.name || "(no name)"} · {c.caseId}
                  </Link>
                  <div className="text-xs opacity-60">
                    {c.centreId} · conflicts with {c.conflictWith ?? "?"}
                  </div>
                </div>
                {c.conflictWith && (
                  <button onClick={() => doMerge(c.id, c.conflictWith)} disabled={busy} className="nb-btn nb-btn-success text-xs py-1">
                    Confirm merge
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="nb-label">Probable matches · supervisor review</h2>
        {probables.length === 0 ? (
          <div className="nb-card-flat p-4 text-sm font-bold opacity-60">
            No probable matches awaiting review.
          </div>
        ) : (
          <div className="space-y-2">
            {probables.map((c) => (
              <div key={c.id} className="nb-card p-4 flex items-center justify-between gap-3">
                <div className="text-sm font-bold">
                  <Link href={`/case/${c.id}`} className="underline">
                    {c.name || "(no name)"} · {c.caseId}
                  </Link>
                  <div className="text-xs opacity-60">
                    {c.centreId} · probable match for {c.probableMatchId ?? "?"}
                  </div>
                </div>
                <div className="flex gap-2">
                  {c.probableMatchId && (
                    <button
                      onClick={() => doMerge(c.id, c.probableMatchId)}
                      disabled={busy}
                      className="nb-btn nb-btn-success text-xs py-1"
                    >
                      Confirm
                    </button>
                  )}
                  <button onClick={() => rejectProbable(c.id)} disabled={busy} className="nb-btn text-xs py-1">
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="grid sm:grid-cols-2 gap-6">
        <div className="space-y-2">
          <h2 className="nb-label">Unverified sighting tips</h2>
          {unverifiedTips.length === 0 ? (
            <div className="nb-card-flat p-4 text-sm font-bold opacity-60">No tips.</div>
          ) : (
            <div className="nb-card divide-y-[3px] divide-ink">
              {unverifiedTips.map((t) => (
                <div key={t.id} className="px-4 py-2 text-sm font-bold">
                  <Link href={`/case/${t.caseId}`} className="underline">
                    case {t.caseId.slice(0, 6)}…
                  </Link>
                  <span className="opacity-60"> · {t.location || "no location"}</span>
                  {t.note && <div className="text-xs opacity-60">{t.note}</div>}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-2">
          <h2 className="nb-label">Long-duration / escalated</h2>
          {escalated.length === 0 ? (
            <div className="nb-card-flat p-4 text-sm font-bold opacity-60">
              None. Run the scheduler tick ⚡ to advance escalation.
            </div>
          ) : (
            <div className="nb-card divide-y-[3px] divide-ink">
              {escalated.map((c) => (
                <div key={c.id} className="px-4 py-2 text-sm font-bold flex justify-between">
                  <Link href={`/case/${c.id}`} className="underline">
                    {c.name || "(no name)"} · {c.caseId}
                  </Link>
                  <span className="nb-chip bg-[var(--warning)]">{c.escalationStage}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
