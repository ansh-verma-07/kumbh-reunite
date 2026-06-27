// POST /api/cases/[id]/merge  { intoCaseId }
// Human-confirmed merge of a duplicate / found-match pair: links the two,
// resolves both, clears any merge-review flag, and cancels pending PA. (Flow B/D)
import { NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase/admin";

export const runtime = "nodejs";

async function cancelPa(db: FirebaseFirestore.Firestore, caseId: string) {
  const snap = await db.collection("paQueue").where("caseId", "==", caseId).get();
  await Promise.all(
    snap.docs
      .filter((d) => d.data().status !== "done")
      .map((d) => d.ref.update({ status: "cancelled" })),
  );
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { intoCaseId } = await req.json();
  if (!intoCaseId) return NextResponse.json({ error: "intoCaseId required" }, { status: 400 });

  const db = getAdminDb();
  const now = Date.now();

  await db.collection("cases").doc(id).update({
    masterCaseId: intoCaseId,
    status: "resolved",
    resolvedAt: now,
    updatedAt: now,
    mergeReview: false,
    probable: false,
  });
  await db.collection("cases").doc(intoCaseId).update({
    status: "resolved",
    resolvedAt: now,
    updatedAt: now,
    mergeReview: false,
  });

  await Promise.all([cancelPa(db, id), cancelPa(db, intoCaseId)]);

  return NextResponse.json({ ok: true });
}
