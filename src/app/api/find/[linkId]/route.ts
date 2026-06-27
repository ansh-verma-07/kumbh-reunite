// GET /api/find/[linkId]
// Public, server-side resolver for a share link. Returns ONLY public-safe case
// fields — never reporterMobile or internal flags. Enforces expiry. (PRD §7.)
import { NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase/admin";
import type { CaseDoc, ShareLinkDoc } from "@/lib/types";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ linkId: string }> },
) {
  const { linkId } = await params;
  const db = getAdminDb();

  const linkSnap = await db.collection("shareLinks").doc(linkId).get();
  if (!linkSnap.exists) {
    return NextResponse.json({ error: "link not found" }, { status: 404 });
  }
  const link = linkSnap.data() as ShareLinkDoc;
  if (link.expiresAt < Date.now()) {
    return NextResponse.json({ error: "link expired" }, { status: 410 });
  }

  const caseSnap = await db.collection("cases").doc(link.caseId).get();
  if (!caseSnap.exists) {
    return NextResponse.json({ error: "case not found" }, { status: 404 });
  }
  const c = caseSnap.data() as CaseDoc;

  // Public-safe projection only.
  return NextResponse.json({
    caseDocId: link.caseId,
    caseId: c.caseId,
    status: c.status,
    name: c.name ?? null,
    ageBand: c.ageBand ?? null,
    gender: c.gender,
    descriptionRaw: c.descriptionRaw ?? null,
    colourSignature: c.colourSignature ?? [],
    lastSeenZone: c.lastSeenZone ?? null,
    photoUrl: c.photoUrl ?? null,
  });
}
