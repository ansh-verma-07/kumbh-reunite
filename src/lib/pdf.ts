// Shift-briefing PDF export (client-side, jsPDF). PRD Flow D / HTML Layer 5.
"use client";

import { jsPDF } from "jspdf";
import type { ZoneRisk } from "@/lib/ops";
import type { CaseDoc, PaQueueDoc, TipDoc } from "@/lib/types";

export function exportBriefing(opts: {
  zones: ZoneRisk[];
  cases: CaseDoc[];
  pa: PaQueueDoc[];
  tips: TipDoc[];
}) {
  const { zones, cases, pa, tips } = opts;
  const doc = new jsPDF();
  let y = 16;
  const line = (text: string, size = 11, bold = false) => {
    doc.setFontSize(size);
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.text(text, 14, y);
    y += size * 0.6;
  };

  line("KUMBH REUNITE — SHIFT BRIEFING", 18, true);
  line(new Date().toLocaleString(), 10);
  y += 4;

  const missing = cases.filter((c) => c.status === "missing").length;
  const found = cases.filter((c) => c.status === "found").length;
  const pendingPa = pa.filter((p) => p.status === "pending" || p.status === "broadcasting").length;
  const conflicts = cases.filter((c) => c.mergeReview).length;
  const unverified = tips.filter((t) => t.status === "unverified").length;

  line("SUMMARY", 13, true);
  line(`Open missing: ${missing}    Open found: ${found}    Total open: ${cases.length}`);
  line(`Pending PA: ${pendingPa}    Conflicts: ${conflicts}    Unverified tips: ${unverified}`);
  y += 4;

  line("RISK BY ZONE (highest first)", 13, true);
  for (const z of zones.slice(0, 8)) {
    line(
      `${z.riskBand.toUpperCase().padEnd(9)} ${z.riskScore.toFixed(2)}  ${z.name}  ` +
        `(${z.activeCases} cases, ${z.cameraCount} cams, ${z.chokepointCount} choke)`,
      10,
    );
  }
  y += 4;

  line("PENDING PA ANNOUNCEMENTS", 13, true);
  const pend = pa.filter((p) => p.status === "pending" || p.status === "broadcasting");
  if (!pend.length) line("None", 10);
  for (const p of pend.slice(0, 10)) {
    line(`${p.caseHumanId}  [${p.status}]  node: ${p.node}  (${p.broadcasts?.length ?? 0}x)`, 10);
  }
  y += 4;

  line("MERGE CONFLICTS", 13, true);
  const conf = cases.filter((c) => c.mergeReview);
  if (!conf.length) line("None", 10);
  for (const c of conf.slice(0, 10)) {
    line(`${c.caseId}  ${c.name || "(no name)"}  @ ${c.centreId}`, 10);
  }

  doc.save(`kumbh-shift-briefing-${Date.now()}.pdf`);
}
