"use client";

import { useEffect, useRef, useState } from "react";
import type { Html5Qrcode } from "html5-qrcode";
import { AGE_BANDS } from "@/lib/types";

export interface AadhaarFields {
  name?: string;
  gender?: string;
  ageBand?: string;
  dob?: string;
}

// ── offline parse helpers (mirrors /api/aadhaar/parse but runs in the browser) ──

const THIS_YEAR = 2026;

function ageBandFromDob(dob?: string): string | undefined {
  if (!dob) return undefined;
  const ym = dob.match(/(\d{4})/g);
  if (!ym) return undefined;
  const year = Number(ym[ym.length - 1]);
  if (!year || year < 1900 || year > THIS_YEAR) return undefined;
  const age = THIS_YEAR - year;
  return AGE_BANDS.find((b) => {
    if (b === "71+") return age >= 71;
    const [lo, hi] = b.split("-").map(Number);
    return age >= lo && age <= hi;
  });
}

function normGender(s?: string): string | undefined {
  if (!s) return undefined;
  const t = s.trim().toUpperCase();
  if (t === "M" || t === "MALE") return "male";
  if (t === "F" || t === "FEMALE") return "female";
  if (t === "T" || t === "O") return "other";
  return undefined;
}

function extractFromTokens(tokens: string[]) {
  let name: string | undefined;
  let dob: string | undefined;
  let gender: string | undefined;
  for (const tok of tokens) {
    const t = tok.trim();
    if (!gender && /^(M|F|T|MALE|FEMALE)$/i.test(t)) gender = normGender(t);
    else if (!dob && /\d{2}[-/]\d{2}[-/]\d{4}/.test(t))
      dob = t.match(/\d{2}[-/]\d{2}[-/]\d{4}/)![0];
    else if (!dob && /^(19|20)\d{2}$/.test(t)) dob = t;
    else if (!name && /^[A-Za-z][A-Za-z .]{2,}$/.test(t)) name = t;
  }
  return { name, dob, gender };
}

async function decompressBytes(
  bytes: Uint8Array<ArrayBufferLike>,
  format: CompressionFormat,
): Promise<Uint8Array<ArrayBuffer>> {
  // Copy into a plain ArrayBuffer-backed Uint8Array — required by DecompressionStream.
  const copy = new Uint8Array(bytes.length);
  copy.set(bytes);
  const ds = new DecompressionStream(format);
  const writer = ds.writable.getWriter();
  writer.write(copy);
  writer.close();
  const chunks: Uint8Array<ArrayBuffer>[] = [];
  const reader = ds.readable.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }
  const total = chunks.reduce((n, c) => n + c.length, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) {
    out.set(c, off);
    off += c.length;
  }
  return out;
}

async function parseAadhaar(raw: string): Promise<AadhaarFields> {
  let name: string | undefined;
  let dob: string | undefined;
  let gender: string | undefined;

  try {
    if (/<\?xml|PrintLetterBarcodeData|name=/.test(raw)) {
      // Legacy XML attribute format — regex is enough (no DOM needed).
      name = raw.match(/name="([^"]+)"/)?.[1];
      gender = normGender(raw.match(/gender="([^"]+)"/)?.[1]);
      dob =
        raw.match(/dob="([^"]+)"/)?.[1] ?? raw.match(/yob="(\d{4})"/)?.[1];
    } else if (/^\d{6,}$/.test(raw.trim())) {
      // Secure QR: BigInt -> hex -> Uint8Array -> gunzip -> 0xFF-delimited tokens.
      const big = BigInt(raw.trim());
      let hex = big.toString(16);
      if (hex.length % 2) hex = "0" + hex;
      const pairs = hex.match(/.{2}/g) ?? [];
      let buf = new Uint8Array(pairs.map((b) => parseInt(b, 16)));

      // Try gzip first, then deflate-raw.
      for (const fmt of ["gzip", "deflate-raw"] as CompressionFormat[]) {
        try {
          buf = await decompressBytes(buf, fmt);
          break;
        } catch {
          // try next
        }
      }

      const dec = new TextDecoder("utf-8");
      const tokens: string[] = [];
      let start = 0;
      for (let i = 0; i < buf.length; i++) {
        if (buf[i] === 0xff) {
          tokens.push(dec.decode(buf.subarray(start, i)));
          start = i + 1;
        }
      }
      tokens.push(dec.decode(buf.subarray(start)));
      ({ name, dob, gender } = extractFromTokens(tokens));
    } else {
      // JSON or delimiter fallback.
      try {
        const j = JSON.parse(raw);
        name = j.name;
        gender = normGender(j.gender);
        dob = j.dob;
      } catch {
        ({ name, dob, gender } = extractFromTokens(raw.split(/[|,;￿\xff]/)));
      }
    }
  } catch {
    // best-effort — caller falls back to manual entry
  }

  return { name, gender, dob, ageBand: ageBandFromDob(dob) };
}

// ── component ────────────────────────────────────────────────────────────────

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
            // Parse entirely offline — no server round-trip.
            const f = await parseAadhaar(text);
            onFields(f);
            setStatus(
              f.name
                ? `Filled: ${f.name}`
                : "Scanned — no fields parsed (manual entry)",
            );
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
        Reads name / DOB / gender entirely on-device — no server call, works
        offline. Aadhaar number is never stored. Works for the ~20–30% of
        pilgrims who carry their card.
      </p>
    </div>
  );
}
