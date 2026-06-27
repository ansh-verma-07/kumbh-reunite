// Single case endpoints (server-side, Admin SDK).
//   GET    /api/cases/[id]                                   -> { case: CaseDoc }
//   PATCH  /api/cases/[id]  { status? , probable?, probableMatchId? } -> { ok }
//   DELETE /api/cases/[id]  (reporter or supervisor only)    -> { ok }
import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase/admin";
import { verifyRequest, AuthError } from "@/lib/auth";
import { sendSms } from "@/lib/sms";
import type { CaseStatus } from "@/lib/types";

export const runtime = "nodejs";

function clean(id: string, data: FirebaseFirestore.DocumentData, role: string) {
  const { embedding, serverCreatedAt, ...rest } = data;
  void embedding;
  void serverCreatedAt;
  if (role === "police") delete rest.reporterMobile;
  return { id, ...rest };
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let role = "volunteer";
  try {
    const auth = await verifyRequest(req);
    role = auth?.role ?? "volunteer";
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
  }

  const snap = await getAdminDb().collection("cases").doc(id).get();
  if (!snap.exists) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ case: clean(snap.id, snap.data()!, role) });
}

const VALID: CaseStatus[] = ["missing", "found", "resolved", "archived"];

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    await verifyRequest(req);
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
  }

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

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let auth = null;
  try {
    auth = await verifyRequest(req);
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
  }

  const db = getAdminDb();
  const ref = db.collection("cases").doc(id);
  const snap = await ref.get();
  if (!snap.exists) return NextResponse.json({ error: "not found" }, { status: 404 });

  const c = snap.data()!;

  // Only the original reporter (by UID) or a supervisor may delete.
  const isSupervisor = auth?.role === "supervisor";
  const isReporter = auth?.uid && auth.uid !== "anon" && c.reporterUid === auth.uid;
  if (!isSupervisor && !isReporter) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  // Block deletion after bureau escalation (Day 30+).
  if (c.escalationStage && !["active"].includes(c.escalationStage)) {
    return NextResponse.json(
      { error: "case has been escalated to state bureau — contact authorities to withdraw" },
      { status: 409 },
    );
  }

  // Cancel PA queue entries.
  const paSnap = await db.collection("paQueue").where("caseId", "==", id).get();
  await Promise.all(
    paSnap.docs
      .filter((d) => d.data().status !== "done")
      .map((d) => d.ref.update({ status: "cancelled" })),
  );

  // Invalidate share link.
  if (c.shareLinkId) {
    await db.collection("shareLinks").doc(c.shareLinkId).update({
      expiresAt: FieldValue.delete(),
    }).catch(() => {});
  }

  // Soft-delete: mark archived + flag deleted rather than hard-delete
  // (audit trail required under DPDP Act 2023).
  await ref.update({
    status: "archived",
    deletedByReporter: true,
    deletedAt: Date.now(),
    updatedAt: Date.now(),
    reporterMobile: FieldValue.delete(),
    reporterUid: FieldValue.delete(),
  });

  return NextResponse.json({ ok: true });
}
