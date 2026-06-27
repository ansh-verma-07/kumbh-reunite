// POST /api/tips  { caseId, location?, note? }  -> { id }
// Public sighting submission (server-side, Admin SDK).
import { NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase/admin";

export const runtime = "nodejs";

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
  const { caseId, location, note } = await req.json();
  if (!caseId) return NextResponse.json({ error: "caseId required" }, { status: 400 });
  const ref = await getAdminDb().collection("tips").add({
    caseId,
    location: location || null,
    note: note || null,
    status: "unverified",
    createdAt: Date.now(),
  });
  return NextResponse.json({ id: ref.id });
}
