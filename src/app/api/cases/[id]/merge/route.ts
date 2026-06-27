// POST /api/cases/[id]/merge  { intoCaseId }
// Human-confirmed merge: saves a preMergeSnapshot for undo, links the two
// cases, resolves both, cancels pending PA, and notifies the reporter by SMS.
import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase/admin";
import { sendSms } from "@/lib/sms";

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

  // Load both cases before mutating so we can snapshot them.
  const [childSnap, masterSnap] = await Promise.all([
    db.collection("cases").doc(id).get(),
    db.collection("cases").doc(intoCaseId).get(),
  ]);
  if (!childSnap.exists || !masterSnap.exists) {
    return NextResponse.json({ error: "case not found" }, { status: 404 });
  }

  // Save preMergeSnapshot so supervisor can undo.
  await db.collection("mergeSnapshots").add({
    childId: id,
    masterId: intoCaseId,
    childSnap: childSnap.data(),
    masterSnap: masterSnap.data(),
    mergedAt: now,
  });

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
    childCaseIds: FieldValue.arrayUnion(id),
  });

  await Promise.all([cancelPa(db, id), cancelPa(db, intoCaseId)]);

  // Notify reporter of the missing case that their person has been reunited.
  const reporterMobile =
    (childSnap.data()?.kind === "missing"
      ? childSnap.data()?.reporterMobile
      : masterSnap.data()?.reporterMobile) as string | undefined;
  const humanId =
    (childSnap.data()?.kind === "missing"
      ? childSnap.data()?.caseId
      : masterSnap.data()?.caseId) as string | undefined;

  await sendSms(
    reporterMobile,
    `Good news — case ${humanId ?? id} has been matched and reunited at a Kho-Ya-Paya centre.`,
  );

  return NextResponse.json({ ok: true });
}
