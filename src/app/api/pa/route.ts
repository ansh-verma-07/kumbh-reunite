// GET /api/pa[?status=pending] -> { items: PaQueueDoc[] }
import { NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase/admin";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const status = new URL(req.url).searchParams.get("status");
  const snap = await getAdminDb().collection("paQueue").limit(500).get();
  let items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  if (status) items = items.filter((i) => (i as { status?: string }).status === status);
  items.sort(
    (a, b) =>
      ((b as { createdAt?: number }).createdAt ?? 0) -
      ((a as { createdAt?: number }).createdAt ?? 0),
  );
  return NextResponse.json({ items });
}
