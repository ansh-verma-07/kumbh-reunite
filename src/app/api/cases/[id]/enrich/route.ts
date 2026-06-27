// POST /api/cases/[id]/enrich
// Server-side enrichment (runs when online; offline-created docs are enriched
// on reconnect). Gemini normalizes the description + produces a multilingual
// embedding; Firestore findNearest surfaces duplicate/match candidates.
// Humans confirm — this endpoint only suggests. (PRD §4 Flow A/B.)
import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase/admin";
import { normalizeDescription, embedText, generateAnnouncement } from "@/lib/gemini";
import { nearestTransferNode } from "@/lib/constants";
import type { CaseDoc, DuplicateCandidate } from "@/lib/types";

export const runtime = "nodejs";

function colourOverlap(a: string[] = [], b: string[] = []): number {
  if (!a.length || !b.length) return 0;
  const px = (s: string, i: number) => parseInt(s.slice(i, i + 2), 16);
  const close = (x: string, y: string) =>
    Math.sqrt(
      (px(x, 1) - px(y, 1)) ** 2 + (px(x, 3) - px(y, 3)) ** 2 + (px(x, 5) - px(y, 5)) ** 2,
    ) < 60;
  let m = 0;
  for (const x of a) if (b.some((y) => close(x, y))) m++;
  return m / Math.max(a.length, b.length);
}

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const adminDb = getAdminDb();
  const ref = adminDb.collection("cases").doc(id);
  const snap = await ref.get();
  if (!snap.exists) {
    return NextResponse.json({ error: "case not found" }, { status: 404 });
  }
  const data = snap.data() as Omit<CaseDoc, "id">;

  // Build the text to normalize + embed (handles all 10 languages natively).
  const parts = [data.name, data.descriptionRaw, (data.conditionTags ?? []).join(" ")]
    .filter(Boolean)
    .join(". ");
  const text = parts || data.gender || "unknown";

  let structured = data.descriptionStructured;
  try {
    if (data.descriptionRaw) structured = await normalizeDescription(data.descriptionRaw);
  } catch (e) {
    console.error("normalize failed", e);
  }

  const vector = await embedText(text);

  await ref.update({
    ...(structured ? { descriptionStructured: structured } : {}),
    embedding: FieldValue.vector(vector),
    embeddedAt: Date.now(),
    updatedAt: Date.now(),
  });

  // Duplicate / match candidates: nearest OPEN 'missing' cases.
  // (Missing case -> other missing = duplicate; Found case -> missing = match.)
  const candidates: DuplicateCandidate[] = [];
  try {
    const vq = adminDb
      .collection("cases")
      .where("status", "==", "missing")
      .findNearest({
        vectorField: "embedding",
        queryVector: FieldValue.vector(vector),
        limit: 5,
        distanceMeasure: "COSINE",
        distanceResultField: "_distance",
      });
    const res = await vq.get();
    for (const d of res.docs) {
      if (d.id === id) continue; // skip self
      const c = d.data() as CaseDoc & { _distance?: number };
      const similarity = 1 - (c._distance ?? 1); // COSINE distance -> similarity
      if (similarity < 0.6) continue;
      candidates.push({
        caseId: d.id,
        name: c.name,
        centreId: c.centreId,
        ageBand: c.ageBand,
        gender: c.gender,
        similarity,
        colourOverlap: colourOverlap(data.colourSignature, c.colourSignature),
      });
    }
  } catch (e) {
    // findNearest needs the vector index deployed; degrade gracefully.
    console.error("findNearest failed (is the vector index deployed?)", e);
  }

  // PA announcement (Flow A step 7): generate once for missing cases with
  // enough info. Twice-broadcast scheduling is handled on approve + the cron tick.
  try {
    if (data.kind === "missing" && (data.name || data.descriptionRaw)) {
      const existing = await adminDb
        .collection("paQueue")
        .where("caseId", "==", id)
        .limit(1)
        .get();
      if (existing.empty) {
        const text = await generateAnnouncement({
          language: data.language,
          name: data.name,
          ageBand: data.ageBand,
          gender: data.gender,
          clothing: structured?.clothingColours,
          lastSeenZone: data.lastSeenZone,
        });
        await adminDb.collection("paQueue").add({
          caseId: id,
          caseHumanId: data.caseId,
          language: data.language,
          text,
          node: nearestTransferNode(data.lastSeenZone),
          status: "pending",
          broadcasts: [],
          createdAt: Date.now(),
        });
      }
    }
  } catch (e) {
    console.error("PA generation failed", e);
  }

  return NextResponse.json({ structured, candidates });
}
