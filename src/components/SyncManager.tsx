"use client";

import { useEffect, useState } from "react";
import { flush, getPending } from "@/lib/offlineQueue";

// Flushes the offline case queue on reconnect / interval, and shows a small
// badge while cases are pending sync.
export function SyncManager() {
  const [pending, setPending] = useState(0);
  const [online, setOnline] = useState(true);

  useEffect(() => {
    setPending(getPending().length);
    setOnline(navigator.onLine);

    const refresh = () => setPending(getPending().length);
    const onOnline = async () => {
      setOnline(true);
      await flush();
      refresh();
    };
    const onOffline = () => setOnline(false);

    window.addEventListener("kr-pending-changed", refresh);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    if (navigator.onLine) flush().then(refresh);
    const iv = setInterval(() => navigator.onLine && flush().then(refresh), 20000);

    return () => {
      window.removeEventListener("kr-pending-changed", refresh);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      clearInterval(iv);
    };
  }, []);

  if (pending === 0 && online) return null;

  return (
    <div
      className="fixed bottom-4 right-4 z-50 nb-card-flat px-3 py-2 text-xs font-extrabold"
      style={{ background: online ? "var(--cyan)" : "var(--warning)" }}
    >
      {online ? `Syncing ${pending} case${pending === 1 ? "" : "s"}…` : "OFFLINE"}
      {!online && pending > 0 ? ` · ${pending} queued` : ""}
    </div>
  );
}
