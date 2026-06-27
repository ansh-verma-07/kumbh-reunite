// Client-side case data layer. Reads/writes go through server endpoints that
// use the Admin SDK, so the app does not depend on client Firestore Security
// Rules. (Trade-off vs. offline-first writes — acceptable for the demo.)
"use client";

import type { CaseDoc, CaseKind, CaseStatus } from "@/lib/types";
import { enqueue } from "@/lib/offlineQueue";

export interface NewCaseInput {
  kind: CaseKind;
  centreId: string;
  language: CaseDoc["language"];
  name?: string;
  ageBand?: CaseDoc["ageBand"];
  gender: CaseDoc["gender"];
  descriptionRaw?: string;
  colourSignature?: string[];
  dhash?: string;
  photoUrl?: string;
  lastSeenZone?: string;
  conditionTags?: string[];
  reporterMobile?: string;
}

export type CreateResult =
  | { queued: true }
  | { id: string; caseId: string; shareLinkId?: string };

export async function createCase(input: NewCaseInput): Promise<CreateResult> {
  // Offline → queue locally; SyncManager flushes on reconnect.
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    enqueue(input);
    return { queued: true };
  }
  let res: Response;
  try {
    res = await fetch("/api/cases", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
  } catch {
    // Network failure mid-request → queue rather than lose the case.
    enqueue(input);
    return { queued: true };
  }
  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    throw new Error(e.error ?? `create failed (${res.status})`);
  }
  return res.json();
}

export async function getCase(id: string): Promise<CaseDoc | null> {
  const res = await fetch(`/api/cases/${id}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`load failed (${res.status})`);
  return (await res.json()).case as CaseDoc;
}

export async function listOpenCases(): Promise<CaseDoc[]> {
  const res = await fetch("/api/cases");
  if (!res.ok) throw new Error(`list failed (${res.status})`);
  return (await res.json()).cases as CaseDoc[];
}

export async function setCaseStatus(id: string, status: CaseStatus): Promise<void> {
  const res = await fetch(`/api/cases/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  });
  if (!res.ok) throw new Error(`update failed (${res.status})`);
}

export async function submitTip(
  caseId: string,
  location?: string,
  note?: string,
): Promise<void> {
  const res = await fetch("/api/tips", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ caseId, location, note }),
  });
  if (!res.ok) throw new Error(`tip failed (${res.status})`);
}

/** Jaccard-style overlap of two hex colour signatures (0..1). */
export function colourOverlap(a: string[] = [], b: string[] = []): number {
  if (!a.length || !b.length) return 0;
  const px = (s: string, i: number) => parseInt(s.slice(i, i + 2), 16);
  const close = (x: string, y: string) =>
    Math.sqrt(
      (px(x, 1) - px(y, 1)) ** 2 + (px(x, 3) - px(y, 3)) ** 2 + (px(x, 5) - px(y, 5)) ** 2,
    ) < 60;
  let m = 0;
  for (const x of a) if (b.some((y) => close(x, y))) m++;
  return m / Math.max(a.length, b.length);
}
