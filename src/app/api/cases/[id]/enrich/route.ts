// POST /api/cases/[id]/enrich
// Server-side enrichment: Gemini normalizes description + produces a
// multilingual embedding. Matching pipeline (Flow B) runs colour+gender+age
// filter FIRST to narrow the candidate pool, then cosine similarity ranks the
// filtered set. Humans confirm — this endpoint only suggests. (PRD §4 Flow A/B.)
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

function cosineSim(a: number[], b: number[]): number {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb) || 1);
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

  // PRD Flow B matching pipeline:
  // Step 1 — colour + gender + age filter narrows open missing cases (~20).
  // Step 2 — cosine similarity on the filtered set ranks them.
  // This ensures expensive similarity runs only on plausible candidates.
  const DUP_THRESHOLD = 0.78;
  const WINDOW_MS = 72 * 60 * 60 * 1000;
  let candidates: DuplicateCandidate[] = [];

  try {
    // Fetch all open missing cases within the 72-hour window.
    const openSnap = await adminDb
      .collection("cases")
      .where("status", "==", "missing")
      .limit(2000)
      .get();

    const now = Date.now();
    // Step 1: colour + gender + age pre-filter.
    const preFiltered = openSnap.docs.filter((d) => {
      if (d.id === id) return false;
      const c = d.data() as CaseDoc & { embedding?: number[] };
      if (!c.embedding) return false;
      if (c.createdAt && now - c.createdAt > WINDOW_MS) return false;
      if (data.gender !== "unknown" && c.gender !== "unknown" && c.gender !== data.gender) return false;
      if (data.ageBand && c.ageBand && data.ageBand !== c.ageBand) return false;
      // Colour overlap: keep if no signature on either side OR overlap > 0.
      if (data.colourSignature?.length && c.colourSignature?.length) {
        if (colourOverlap(data.colourSignature, c.colourSignature) === 0) return false;
      }
      return true;
    });

    // Step 2: cosine similarity on the pre-filtered set.
    for (const d of preFiltered) {
      const c = d.data() as CaseDoc & { embedding?: number[] };
      const similarity = cosineSim(vector, c.embedding!);
      if (similarity < DUP_THRESHOLD) continue;
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

    // Top 5 ranked by similarity then colour overlap.
    candidates = candidates
      .sort((a, b) => b.similarity - a.similarity || b.colourOverlap - a.colourOverlap)
      .slice(0, 5);
  } catch (e) {
    console.error("candidate search failed", e);
  }

  // PA announcement (Flow A step 7): generate once for missing cases with
  // enough info. Twice-broadcast scheduling handled on approve + cron tick.
  try {
    if (data.kind === "missing" && (data.name || data.descriptionRaw)) {
      const existing = await adminDb
        .collection("paQueue")
        .where("caseId", "==", id)
        .limit(1)
        .get();
      if (existing.empty) {
        const paText = await generateAnnouncement({
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
          text: paText,
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
