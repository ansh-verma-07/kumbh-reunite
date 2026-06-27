// POST /api/admin/enrich-batch
// Enriches up to 4 un-enriched cases per call (free-tier Gemini: 5 RPM for
// gemini-2.5-flash). Processes sequentially with a 13-second pause between
// cases to stay under the rate limit. Call repeatedly from the UI until
// `remaining` reaches 0.
import { NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase/admin";
import { normalizeDescription, embedText } from "@/lib/gemini";

export const runtime = "nodejs";
export const maxDuration = 120;

const DELAY_MS = 13_000; // 13s between calls → stays under 5 RPM
const PER_CALL = 4;      // 4 cases × 13s = 52s, safely under 60s timeout

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export async function POST() {
  const db = getAdminDb();
  const snap = await db
    .collection("cases")
    .where("status", "in", ["missing", "found"])
    .limit(500)
    .get();

  const todo = snap.docs.filter((d) => {
    const data = d.data();
    return data.descriptionRaw && !data.descriptionStructured;
  });

  const batch = todo.slice(0, PER_CALL);
  const remaining = todo.length - batch.length;

  let enriched = 0;
  let failed = 0;

  for (let i = 0; i < batch.length; i++) {
    if (i > 0) await sleep(DELAY_MS);
    const d = batch[i];
    const data = d.data();
    try {
      const parts = [data.name, data.descriptionRaw, (data.conditionTags ?? []).join(" ")]
        .filter(Boolean)
        .join(". ");
      const text = parts || data.gender || "unknown";
      const [structured, vector] = await Promise.all([
        normalizeDescription(data.descriptionRaw),
        embedText(text),
      ]);
      await db.collection("cases").doc(d.id).update({
        descriptionStructured: structured,
        embedding: vector,
        embeddedAt: Date.now(),
        updatedAt: Date.now(),
      });
      enriched++;
    } catch (e) {
      failed++;
      console.error(`enrich-batch: failed for ${d.id}`, e);
    }
  }

  return NextResponse.json({ enriched, failed, remaining, total: todo.length });
}
