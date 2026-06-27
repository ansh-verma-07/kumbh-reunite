"use client";

import { useEffect, useRef, useState } from "react";
import type { Html5Qrcode } from "html5-qrcode";

export interface AadhaarFields {
  name?: string;
  gender?: string;
  ageBand?: string;
  dob?: string;
}

export function AadhaarScan({ onFields }: { onFields: (f: AadhaarFields) => void }) {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setStatus("Starting camera…");

    (async () => {
      const { Html5Qrcode } = await import("html5-qrcode");
      if (cancelled) return;
      const scanner = new Html5Qrcode("aadhaar-reader");
      scannerRef.current = scanner;
      try {
        await scanner.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: 250 },
          async (text) => {
            setStatus("Reading Aadhaar…");
            await scanner.stop().catch(() => {});
            try {
              const res = await fetch("/api/aadhaar/parse", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ raw: text }),
              });
              const f: AadhaarFields = await res.json();
              onFields(f);
              setStatus(f.name ? `Filled: ${f.name}` : "Scanned — no fields parsed (manual entry)");
            } catch {
              setStatus("Parse failed — enter manually");
            }
            setOpen(false);
          },
          () => {},
        );
      } catch (e) {
        setStatus("Camera error: " + (e as Error).message);
        setOpen(false);
      }
    })();

    return () => {
      cancelled = true;
      const s = scannerRef.current;
      if (s) s.stop().catch(() => {});
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="nb-btn nb-btn-warning"
        >
          {open ? "Stop scan" : "Scan Aadhaar QR"}
        </button>
        {status && <span className="text-xs font-bold">{status}</span>}
      </div>
      {open && <div id="aadhaar-reader" className="border-[3px] border-ink max-w-xs" />}
      <p className="text-[11px] font-semibold opacity-60">
        Reads name / DOB / gender offline. Aadhaar number is never stored. Works for the
        ~20–30% of pilgrims who carry their card.
      </p>
    </div>
  );
}
