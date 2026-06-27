// POST /api/tips  { caseId, location?, note? }  -> { id }
// Public sighting submission (server-side, Admin SDK).
// App Check token verified when FIREBASE_APP_CHECK_ENABLED=true; degrades
// gracefully in dev so the rest of the system works without the config.
import { NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase/admin";
import { sendSms } from "@/lib/sms";

export const runtime = "nodejs";

async function verifyAppCheck(req: Request): Promise<boolean> {
  if (process.env.FIREBASE_APP_CHECK_ENABLED !== "true") return true;
  const token = req.headers.get("X-Firebase-AppCheck");
  if (!token) return false;
  try {
    const { getAppCheck } = await import("firebase-admin/app-check");
    const { getAdminDb: _unused, ...rest } = await import("@/lib/firebase/admin");
    void _unused; void rest;
    // getAdminDb() ensures the Admin app is initialised before getAppCheck().
    const { getApps } = await import("firebase-admin/app");
    await getAppCheck(getApps()[0]).verifyToken(token);
    return true;
  } catch {
    return false;
  }
}

export async function GET(req: Request) {
  const status = new URL(req.url).searchParams.get("status");
  const snap = await getAdminDb().collection("tips").limit(500).get();
  let tips = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  if (status) tips = tips.filter((t) => (t as { status?: string }).status === status);
  tips.sort(
    (a, b) =>
      ((b as { createdAt?: number }).createdAt ?? 0) -
      ((a as { createdAt?: number }).createdAt ?? 0),
  );
  return NextResponse.json({ tips });
}

export async function POST(req: Request) {
  const appCheckOk = await verifyAppCheck(req);
  if (!appCheckOk) {
    return NextResponse.json({ error: "App Check verification failed" }, { status: 401 });
  }

  const { caseId, location, note } = await req.json();
  if (!caseId) return NextResponse.json({ error: "caseId required" }, { status: 400 });
  const db = getAdminDb();
  const ref = await db.collection("tips").add({
    caseId,
    location: location || null,
    note: note || null,
    status: "unverified",
    createdAt: Date.now(),
  });
  try {
    const c = (await db.collection("cases").doc(caseId).get()).data();
    await sendSms(
      c?.reporterMobile,
      `A possible sighting for case ${c?.caseId} was reported. A volunteer is verifying it now.`,
    );
  } catch {
    /* best-effort */
  }
  return NextResponse.json({ id: ref.id });
}
