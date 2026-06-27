// POST /api/sharelinks/[linkId]/renew
// Reporter requests a new 7-day share link. Old UUID is invalidated by
// setting expiresAt to now; a new UUID is created and attached to the case.
import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getAdminDb } from "@/lib/firebase/admin";
import type { ShareLinkDoc } from "@/lib/types";

export const runtime = "nodejs";

const SHARE_LINK_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ linkId: string }> },
) {
  const { linkId } = await params;
  const db = getAdminDb();
  const now = Date.now();

  const linkSnap = await db.collection("shareLinks").doc(linkId).get();
  if (!linkSnap.exists) {
    return NextResponse.json({ error: "link not found" }, { status: 404 });
  }
  const link = linkSnap.data() as ShareLinkDoc;

  // Invalidate old link.
  await linkSnap.ref.update({ expiresAt: now });

  // Create new link.
  const newLinkId = randomUUID().replace(/-/g, "");
  await db.collection("shareLinks").doc(newLinkId).set({
    id: newLinkId,
    caseId: link.caseId,
    expiresAt: now + SHARE_LINK_TTL_MS,
    createdAt: now,
    renewedFrom: linkId,
  });

  // Update the case to point to the new link.
  await db.collection("cases").doc(link.caseId).update({
    shareLinkId: newLinkId,
    updatedAt: now,
  });

  return NextResponse.json({ newLinkId });
}
