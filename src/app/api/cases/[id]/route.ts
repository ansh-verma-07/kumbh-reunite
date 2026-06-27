// Single case endpoints (server-side, Admin SDK).
//   GET   /api/cases/[id]                                   -> { case: CaseDoc }
//   PATCH /api/cases/[id]  { status? , probable?, probableMatchId? } -> { ok }
import { NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase/admin";
import { sendSms } from "@/lib/sms";
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
  const db = getAdminDb();
  const ref = db.collection("cases").doc(id);

  const update: Record<string, unknown> = { updatedAt: Date.now() };

  if (body.status !== undefined) {
    if (!VALID.includes(body.status)) {
      return NextResponse.json({ error: "invalid status" }, { status: 400 });
    }
    update.status = body.status;
    if (body.status === "resolved") update.resolvedAt = Date.now();
  }
  if (body.probable !== undefined) {
    update.probable = !!body.probable;
    update.probableMatchId = body.probable ? body.probableMatchId ?? null : null;
  }

  await ref.update(update);

  // On resolve/archive: cancel pending PA + notify reporter (gap: SMS on resolution).
  if (update.status === "resolved" || update.status === "archived") {
    const paSnap = await db.collection("paQueue").where("caseId", "==", id).get();
    await Promise.all(
      paSnap.docs
        .filter((d) => d.data().status !== "done")
        .map((d) => d.ref.update({ status: "cancelled" })),
    );
    if (update.status === "resolved") {
      const c = (await ref.get()).data();
      await sendSms(
        c?.reporterMobile,
        `Good news — case ${c?.caseId} has been marked reunited at a Kho-Ya-Paya centre.`,
      );
    }
  }
  return NextResponse.json({ ok: true });
}
