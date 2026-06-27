// Client helpers for police/supervisor operations: zones (risk), PA queue,
// tips, merges, and the scheduler tick.
"use client";

import type { PaQueueDoc, TipDoc } from "@/lib/types";

export interface ZoneRisk {
  id: string;
  name: string;
  lat: number;
  lng: number;
  cameraCount: number;
  chokepointCount: number;
  activeCases: number;
  cctvGap: number;
  riskScore: number;
  riskBand: "critical" | "elevated" | "moderate" | "low";
}

export async function getZones(): Promise<ZoneRisk[]> {
  const res = await fetch("/api/zones");
  if (!res.ok) throw new Error(`zones failed (${res.status})`);
  return (await res.json()).zones as ZoneRisk[];
}

export async function listPa(status?: string): Promise<PaQueueDoc[]> {
  const res = await fetch(`/api/pa${status ? `?status=${status}` : ""}`);
  if (!res.ok) throw new Error(`pa list failed (${res.status})`);
  return (await res.json()).items as PaQueueDoc[];
}

export async function paAction(
  id: string,
  action: "approve" | "broadcast" | "cancel",
): Promise<void> {
  const res = await fetch(`/api/pa/${id}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action }),
  });
  if (!res.ok) throw new Error(`pa ${action} failed (${res.status})`);
}

export async function listTips(status?: string): Promise<TipDoc[]> {
  const res = await fetch(`/api/tips${status ? `?status=${status}` : ""}`);
  if (!res.ok) throw new Error(`tips failed (${res.status})`);
  return (await res.json()).tips as TipDoc[];
}

export async function mergeCase(id: string, intoCaseId: string): Promise<void> {
  const res = await fetch(`/api/cases/${id}/merge`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ intoCaseId }),
  });
  if (!res.ok) throw new Error(`merge failed (${res.status})`);
}

export async function runTick(accelerate = false): Promise<Record<string, number>> {
  const res = await fetch(`/api/cron/tick${accelerate ? "?accelerate=1" : ""}`, {
    method: "POST",
  });
  if (!res.ok) throw new Error(`tick failed (${res.status})`);
  return (await res.json()).actions;
}
