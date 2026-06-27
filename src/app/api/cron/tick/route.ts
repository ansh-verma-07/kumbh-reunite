// POST/GET /api/cron/tick[?accelerate=1]
// Stand-in for Cloud Scheduler. Processes: PA twice-broadcast + node expansion,
// dhash same-photo conflict detection (PRD §8.3), long-duration escalation
// (Flow E). ?accelerate=1 treats day-thresholds as minutes so escalation is
// demoable. A production deploy points Cloud Scheduler at this route.
import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase/admin";
import { sendSms } from "@/lib/sms";
import { TRANSFER_NODES } from "@/lib/constants";

export const runtime = "nodejs";

const ROUND2_DELAY_MS = 15 * 60 * 1000;
const EXPAND_DELAY_MS = 2 * 60 * 60 * 1000;

async function tick(accelerate: boolean) {
  const db = getAdminDb();
  const now = Date.now();
  const actions = {
    paRound2: 0,
    paExpanded: 0,
    conflicts: 0,
    archived: 0,
    bureau: 0,
    national: 0,
    reconfirm: 0,
  };

  // ---- PA re-broadcasts ----
  const paSnap = await db.collection("paQueue").where("status", "==", "broadcasting").get();
  for (const d of paSnap.docs) {
    const pa = d.data();
    const rounds = pa.broadcasts?.length ?? 0;
    if (pa.nextBroadcastAt && pa.nextBroadcastAt <= now && rounds < 2) {
      await d.ref.update({
        broadcasts: FieldValue.arrayUnion({ node: pa.node, at: now, round: 2 }),
        nextBroadcastAt: FieldValue.delete(),
      });
      actions.paRound2++;
    } else if (!pa.expandedAt && pa.createdAt + EXPAND_DELAY_MS <= now) {
      const second = TRANSFER_NODES.find((n) => n !== pa.node) ?? pa.node;
      await d.ref.update({
        broadcasts: FieldValue.arrayUnion({ node: second, at: now, round: rounds + 1 }),
        expandedAt: now,
      });
      actions.paExpanded++;
    }
  }

  // ---- Open cases: conflict detection + escalation ----
  const openSnap = await db
    .collection("cases")
    .where("status", "in", ["missing", "found"])
    .limit(2000)
    .get();

  // dhash same-photo at two centres -> mergeReview (PRD §8.3)
  const byHash = new Map<string, FirebaseFirestore.QueryDocumentSnapshot[]>();
  for (const d of openSnap.docs) {
    const h = d.data().dhash as string | undefined;
    if (!h) continue;
    if (!byHash.has(h)) byHash.set(h, []);
    byHash.get(h)!.push(d);
  }
  for (const [, docs] of byHash) {
    if (docs.length < 2) continue;
    const centres = new Set(docs.map((d) => d.data().centreId));
    if (centres.size < 2) continue; // same centre re-upload isn't a cross-centre conflict
    for (const d of docs) {
      if (!d.data().mergeReview) {
        await d.ref.update({
          mergeReview: true,
          conflictWith: docs.find((x) => x.id !== d.id)?.id ?? null,
        });
        actions.conflicts++;
      }
    }
  }

  // Escalation thresholds (accelerate -> days become minutes for demos)
  const DAY = 24 * 60 * 60 * 1000 * (accelerate ? 1 / (24 * 60) : 1);
  const archiveAfter = 3 * DAY;
  const bureauAfter = 30 * DAY;
  const nationalAfter = 180 * DAY;
  const reconfirmEvery = 90 * DAY;

  for (const d of openSnap.docs) {
    const c = d.data();
    const age = now - (c.createdAt ?? now);
    const stage = c.escalationStage ?? "active";
    if (stage === "active" && age >= archiveAfter) {
      await d.ref.update({ escalationStage: "archived", archivedAt: now });
      if (c.shareLinkId) {
        await db
          .collection("shareLinks")
          .doc(c.shareLinkId)
          .update({ expiresAt: now + 30 * 24 * 60 * 60 * 1000 })
          .catch(() => {});
      }
      actions.archived++;
    } else if (stage === "archived" && age >= bureauAfter) {
      await d.ref.update({ escalationStage: "bureau", lastReconfirmAt: now });
      await sendSms(c.reporterMobile, `Case ${c.caseId} forwarded to Maharashtra Missing Persons Bureau. Reply to update details.`);
      actions.bureau++;
    } else if (stage === "bureau" && age >= nationalAfter) {
      await d.ref.update({ escalationStage: "national" });
      actions.national++;
    } else if ((stage === "bureau" || stage === "national") && now - (c.lastReconfirmAt ?? 0) >= reconfirmEvery) {
      await d.ref.update({ lastReconfirmAt: now });
      await sendSms(c.reporterMobile, `Case ${c.caseId} is still active. Tap to update the photo or add new details.`);
      actions.reconfirm++;
    }
  }

  return actions;
}

export async function POST(req: Request) {
  const accelerate = new URL(req.url).searchParams.get("accelerate") === "1";
  return NextResponse.json({ ok: true, actions: await tick(accelerate) });
}

export const GET = POST;
