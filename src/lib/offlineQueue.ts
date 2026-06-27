// Offline-first case creation: when the network is down, queue the case in
// localStorage and flush to the server on reconnect. Restores the PRD offline
// NFR ("case creation never blocked by network") without needing client rules.
"use client";

import type { NewCaseInput } from "@/lib/cases";

const KEY = "kr_pending_cases";

export interface PendingCase {
  tempId: string;
  input: NewCaseInput;
  createdAt: number;
}

export function getPending(): PendingCase[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(KEY) || "[]");
  } catch {
    return [];
  }
}

function save(list: PendingCase[]) {
  localStorage.setItem(KEY, JSON.stringify(list));
  window.dispatchEvent(new CustomEvent("kr-pending-changed", { detail: list.length }));
}

export function enqueue(input: NewCaseInput): string {
  const list = getPending();
  const tempId = `local-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  list.push({ tempId, input, createdAt: Date.now() });
  save(list);
  return tempId;
}

/** Try to POST every queued case; keep the ones that fail. Returns # synced. */
export async function flush(): Promise<number> {
  const list = getPending();
  if (!list.length) return 0;
  const remaining: PendingCase[] = [];
  let done = 0;
  for (const p of list) {
    try {
      const res = await fetch("/api/cases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(p.input),
      });
      if (res.ok) {
        done++;
        const created = await res.json();
        // Fire-and-forget enrichment (embedding, duplicate check, PA).
        fetch(`/api/cases/${created.id}/enrich`, { method: "POST" }).catch(() => {});
      } else {
        remaining.push(p);
      }
    } catch {
      remaining.push(p);
    }
  }
  save(remaining);
  return done;
}
