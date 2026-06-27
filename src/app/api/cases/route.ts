// Case collection endpoints (server-side, Admin SDK — bypasses Security Rules).
//   GET  /api/cases        -> { cases: CaseDoc[] }  (open cases)
//   POST /api/cases  body=NewCaseInput -> { id, caseId, shareLinkId? }
import { NextResponse, after } from "next/server";
import { randomUUID } from "node:crypto";
import { getAdminDb } from "@/lib/firebase/admin";
import { verifyRequest, AuthError } from "@/lib/auth";
import { normalizeDescription, embedText } from "@/lib/gemini";

export const runtime = "nodejs";

const SHARE_LINK_TTL_MS = 7 * 24 * 60 * 60 * 1000;

// Strip internal fields; police never see reporterMobile.
function clean(
  id: string,
  data: FirebaseFirestore.DocumentData,
  role: string,
): Record<string, unknown> {
  const { embedding, serverCreatedAt, ...rest } = data;
  void embedding;
  void serverCreatedAt;
  if (role === "police") delete rest.reporterMobile;
  return { id, ...rest };
}

export async function GET(req: Request) {
  let role = "volunteer";
  try {
    const auth = await verifyRequest(req);
    role = auth?.role ?? "volunteer";
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
  }

  const db = getAdminDb();
  const snap = await db
    .collection("cases")
    .where("status", "in", ["missing", "found"])
    .limit(500)
    .get();
  const cases = snap.docs
    .map((d) => clean(d.id, d.data(), role))
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
  let uid = "anon";
  try {
    const auth = await verifyRequest(req);
    uid = auth?.uid ?? "anon";
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
  }

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
    reporterUid: uid,
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
    shareLinkId = randomUUID().replace(/-/g, "");
    await db.collection("shareLinks").doc(shareLinkId).set({
      id: shareLinkId,
      caseId: ref.id,
      expiresAt: now + SHARE_LINK_TTL_MS,
      createdAt: now,
    });
    await ref.update({ shareLinkId });
  }

  // Fire enrichment after response so case creation is not blocked.
  after(async () => {
    try {
      const parts = [input.name, input.descriptionRaw, (input.conditionTags ?? []).join(" ")]
        .filter(Boolean)
        .join(". ");
      const text = parts || input.gender || "unknown";
      const [structured, vector] = await Promise.all([
        input.descriptionRaw ? normalizeDescription(input.descriptionRaw) : Promise.resolve(null),
        embedText(text),
      ]);
      await ref.update({
        ...(structured ? { descriptionStructured: structured } : {}),
        embedding: vector,
        embeddedAt: Date.now(),
        updatedAt: Date.now(),
      });
    } catch (e) {
      console.error("post-create enrichment failed", e);
    }
  });

  return NextResponse.json({ id: ref.id, caseId, shareLinkId });
}
