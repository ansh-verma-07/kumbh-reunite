"use client";

import { useEffect } from "react";

// Registers the service worker in production only (so it doesn't interfere with
// dev HMR). Enables installable PWA + offline shell on 3G.
export function SWRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);
  return null;
}
