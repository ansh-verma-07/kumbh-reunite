// GET /api/zones -> { zones: [...] }
// Live risk score per PRD §5. case_density comes from open cases grouped by
// lastSeenZone; chokepoint/CCTV come from static zone data. Computed at request
// time (a Cloud Scheduler recompute-and-store would be the production path).
import { NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase/admin";
import { ZONE_DATA } from "@/lib/constants";

export const runtime = "nodejs";

function band(score: number): "critical" | "elevated" | "moderate" | "low" {
  if (score >= 0.7) return "critical";
  if (score >= 0.45) return "elevated";
  if (score >= 0.2) return "moderate";
  return "low";
}

export async function GET() {
  const db = getAdminDb();
  const snap = await db
    .collection("cases")
    .where("status", "in", ["missing", "found"])
    .limit(2000)
    .get();

  const activeByZone = new Map<string, number>();
  for (const d of snap.docs) {
    const z = (d.data().lastSeenZone as string | undefined)?.trim();
    if (!z) continue;
    // Match the free-text zone against a known zone by loose contains.
    const meta = ZONE_DATA.find(
      (m) => m.name.toLowerCase() === z.toLowerCase() ||
        m.name.toLowerCase().includes(z.toLowerCase()) ||
        z.toLowerCase().includes(m.name.toLowerCase()),
    );
    const key = meta?.name ?? z;
    activeByZone.set(key, (activeByZone.get(key) ?? 0) + 1);
  }

  const maxCases = Math.max(1, ...ZONE_DATA.map((z) => activeByZone.get(z.name) ?? 0));
  const maxCameras = Math.max(1, ...ZONE_DATA.map((z) => z.cameraCount));
  const maxChoke = Math.max(1, ...ZONE_DATA.map((z) => z.chokepointCount));

  const zones = ZONE_DATA.map((z) => {
    const active = activeByZone.get(z.name) ?? 0;
    const caseDensity = active / maxCases;
    const chokeProximity = z.chokepointCount / maxChoke;
    const cctvGap = 1 - z.cameraCount / maxCameras;
    const riskScore = caseDensity * 0.5 + chokeProximity * 0.3 + cctvGap * 0.2;
    return {
      ...z,
      activeCases: active,
      cctvGap: Number(cctvGap.toFixed(2)),
      riskScore: Number(riskScore.toFixed(3)),
      riskBand: band(riskScore),
    };
  }).sort((a, b) => b.riskScore - a.riskScore);

  return NextResponse.json({ zones });
}
