// Case collection endpoints (server-side, Admin SDK — bypasses Security Rules).
//   GET  /api/cases        -> { cases: CaseDoc[] }  (open cases)
//   POST /api/cases  body=NewCaseInput -> { id, caseId, shareLinkId? }
import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getAdminDb } from "@/lib/firebase/admin";

export const runtime = "nodejs";

const SHARE_LINK_TTL_MS = 7 * 24 * 60 * 60 * 1000;

// Strip non-JSON-serializable / internal fields before returning to the client.
function clean(id: string, data: FirebaseFirestore.DocumentData): Record<string, unknown> {
  const { embedding, serverCreatedAt, ...rest } = data;
  void embedding;
  void serverCreatedAt;
  return { id, ...rest };
}

export async function GET() {
  const db = getAdminDb();
  // Single-field `in` filter (no composite index needed); sort in memory.
  const snap = await db
    .collection("cases")
    .where("status", "in", ["missing", "found"])
    .limit(500)
    .get();
  const cases = snap.docs
    .map((d) => clean(d.id, d.data()))
    .sort((a, b) => (Number(b.createdAt) || 0) - (Number(a.createdAt) || 0));
  return NextResponse.json({ cases });
}

const OPTIONAL_KEYS = [
  "name",
  "ageBand",
  "descriptionRaw",
  "colourSignature",
  "dhash",
  "photoUrl",
  "lastSeenZone",
  "conditionTags",
  "reporterMobile",
] as const;

export async function POST(req: Request) {
  const db = getAdminDb();
  const input = await req.json();
  if (!input?.kind || !input?.centreId) {
    return NextResponse.json({ error: "kind and centreId required" }, { status: 400 });
  }

  const caseId = `KMP-2027-${Math.floor(Math.random() * 90000) + 10000}`;
  const now = Date.now();
  const payload: Record<string, unknown> = {
    caseId,
    kind: input.kind,
    status: input.kind,
    centreId: input.centreId,
    language: input.language,
    gender: input.gender ?? "unknown",
    createdAt: now,
    updatedAt: now,
  };
  for (const k of OPTIONAL_KEYS) {
    const v = input[k];
    if (v !== undefined && v !== "" && !(Array.isArray(v) && v.length === 0)) {
      payload[k] = v;
    }
  }

  const ref = await db.collection("cases").add(payload);

  let shareLinkId: string | undefined;
  if (input.kind === "missing") {
    shareLinkId = randomUUID().replace(/-/g, "").slice(0, 12);
    await db.collection("shareLinks").doc(shareLinkId).set({
      id: shareLinkId,
      caseId: ref.id,
      expiresAt: now + SHARE_LINK_TTL_MS,
      createdAt: now,
    });
    await ref.update({ shareLinkId });
  }

  return NextResponse.json({ id: ref.id, caseId, shareLinkId });
}
