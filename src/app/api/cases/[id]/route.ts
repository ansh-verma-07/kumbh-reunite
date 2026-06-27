// Single case endpoints (server-side, Admin SDK).
//   GET   /api/cases/[id]                 -> { case: CaseDoc }
//   PATCH /api/cases/[id]  body={status}  -> { ok: true }
import { NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase/admin";
import type { CaseStatus } from "@/lib/types";

export const runtime = "nodejs";

function clean(id: string, data: FirebaseFirestore.DocumentData) {
  const { embedding, serverCreatedAt, ...rest } = data;
  void embedding;
  void serverCreatedAt;
  return { id, ...rest };
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const snap = await getAdminDb().collection("cases").doc(id).get();
  if (!snap.exists) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ case: clean(snap.id, snap.data()!) });
}

const VALID: CaseStatus[] = ["missing", "found", "resolved", "archived"];

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const status = body?.status as CaseStatus;
  if (!VALID.includes(status)) {
    return NextResponse.json({ error: "invalid status" }, { status: 400 });
  }
  const db = getAdminDb();
  await db
    .collection("cases")
    .doc(id)
    .update({
      status,
      updatedAt: Date.now(),
      ...(status === "resolved" ? { resolvedAt: Date.now() } : {}),
    });

  // Cancel pending PA announcements when the case is resolved/archived.
  if (status === "resolved" || status === "archived") {
    const paSnap = await db.collection("paQueue").where("caseId", "==", id).get();
    await Promise.all(
      paSnap.docs
        .filter((d) => d.data().status !== "done")
        .map((d) => d.ref.update({ status: "cancelled" })),
    );
  }
  return NextResponse.json({ ok: true });
}
