// POST /api/pa/[id]  { action: "approve" | "broadcast" | "cancel" }
// Twice-broadcast policy: approve broadcasts round 1 now and schedules round 2
// (+15 min); the cron tick fires round 2 and expands to a 2nd node after 2 h.
import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase/admin";
import type { PaBroadcast, PaQueueDoc } from "@/lib/types";

export const runtime = "nodejs";

export const ROUND2_DELAY_MS = 15 * 60 * 1000;
export const EXPAND_DELAY_MS = 2 * 60 * 60 * 1000;

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { action } = await req.json();
  const db = getAdminDb();
  const ref = db.collection("paQueue").doc(id);
  const snap = await ref.get();
  if (!snap.exists) return NextResponse.json({ error: "not found" }, { status: 404 });
  const pa = snap.data() as PaQueueDoc;
  const now = Date.now();

  if (action === "cancel") {
    await ref.update({ status: "cancelled" });
    return NextResponse.json({ ok: true });
  }

  if (action === "approve") {
    const b: PaBroadcast = { node: pa.node, at: now, round: 1 };
    await ref.update({
      status: "broadcasting",
      broadcasts: FieldValue.arrayUnion(b),
      nextBroadcastAt: now + ROUND2_DELAY_MS,
    });
    return NextResponse.json({ ok: true, broadcast: b });
  }

  if (action === "broadcast") {
    const round = (pa.broadcasts?.length ?? 0) + 1;
    const b: PaBroadcast = { node: pa.node, at: now, round };
    await ref.update({
      status: "broadcasting",
      broadcasts: FieldValue.arrayUnion(b),
    });
    return NextResponse.json({ ok: true, broadcast: b });
  }

  return NextResponse.json({ error: "unknown action" }, { status: 400 });
}
