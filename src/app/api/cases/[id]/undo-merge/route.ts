// POST /api/cases/[id]/undo-merge
// Supervisor-only: restores both cases from the preMergeSnapshot saved at
// merge time. Re-queues a PA if the missing case had enough info.
import { NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase/admin";
import { verifyRequest, AuthError } from "@/lib/auth";
import { nearestTransferNode } from "@/lib/constants";
import type { CaseDoc } from "@/lib/types";

export const runtime = "nodejs";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let auth = null;
  try {
    auth = await verifyRequest(req);
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
  }
  if (auth?.role !== "supervisor") {
    return NextResponse.json({ error: "supervisor role required" }, { status: 403 });
  }

  const db = getAdminDb();

  // Find the snapshot where this case was the child.
  const snapQuery = await db
    .collection("mergeSnapshots")
    .where("childId", "==", id)
    .orderBy("mergedAt", "desc")
    .limit(1)
    .get();

  if (snapQuery.empty) {
    // Also try where this case was the master.
    const snapQuery2 = await db
      .collection("mergeSnapshots")
      .where("masterId", "==", id)
      .orderBy("mergedAt", "desc")
      .limit(1)
      .get();
    if (snapQuery2.empty) {
      return NextResponse.json({ error: "no merge snapshot found" }, { status: 404 });
    }
  }

  const snapshotDoc = snapQuery.empty
    ? (
        await db
          .collection("mergeSnapshots")
          .where("masterId", "==", id)
          .orderBy("mergedAt", "desc")
          .limit(1)
          .get()
      ).docs[0]
    : snapQuery.docs[0];

  const { childId, masterId, childSnap, masterSnap } = snapshotDoc.data() as {
    childId: string;
    masterId: string;
    childSnap: Omit<CaseDoc, "id">;
    masterSnap: Omit<CaseDoc, "id">;
  };

  const now = Date.now();

  // Restore child case.
  await db
    .collection("cases")
    .doc(childId)
    .set({ ...childSnap, updatedAt: now });

  // Restore master case — remove the childId from childCaseIds and clear resolved state.
  const masterRestored = { ...masterSnap, updatedAt: now };
  await db.collection("cases").doc(masterId).set(masterRestored);

  // Re-queue PA for the missing case if it had enough info and no active PA.
  const missingCase = childSnap.kind === "missing" ? childSnap : masterSnap;
  const missingId = childSnap.kind === "missing" ? childId : masterId;
  if (missingCase.kind === "missing" && (missingCase.name || missingCase.descriptionRaw)) {
    const existingPa = await db
      .collection("paQueue")
      .where("caseId", "==", missingId)
      .where("status", "in", ["pending", "broadcasting"])
      .limit(1)
      .get();
    if (existingPa.empty) {
      await db.collection("paQueue").add({
        caseId: missingId,
        caseHumanId: missingCase.caseId,
        language: missingCase.language,
        text: `Attention: ${missingCase.name ?? "unknown"} — case reopened after merge undo.`,
        node: nearestTransferNode(missingCase.lastSeenZone),
        status: "pending",
        broadcasts: [],
        createdAt: now,
      });
    }
  }

  // Mark snapshot as used.
  await snapshotDoc.ref.update({ undoneAt: now });

  return NextResponse.json({ ok: true, childId, masterId });
}
