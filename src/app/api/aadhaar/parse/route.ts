// POST /api/aadhaar/parse  { raw }  ->  { name?, gender?, dob?, ageBand? }
// Best-effort decode of an Aadhaar QR. Handles the legacy XML attribute format
// and the numeric Secure-QR (BigInt -> gunzip -> 0xFF-delimited fields).
// PRIVACY: only name / DOB / gender are extracted. The Aadhaar number is never
// parsed, returned, or stored (PRD §7).
import { NextResponse } from "next/server";
import zlib from "node:zlib";
import { AGE_BANDS } from "@/lib/types";

export const runtime = "nodejs";

const THIS_YEAR = 2026;

function ageBandFromDob(dob?: string): string | undefined {
  if (!dob) return undefined;
  const ym = dob.match(/(\d{4})/g);
  if (!ym) return undefined;
  const year = Number(ym[ym.length - 1]);
  if (!year || year < 1900 || year > THIS_YEAR) return undefined;
  const age = THIS_YEAR - year;
  const band = AGE_BANDS.find((b) => {
    if (b === "71+") return age >= 71;
    const [lo, hi] = b.split("-").map(Number);
    return age >= lo && age <= hi;
  });
  return band;
}

function secureQrTokens(raw: string): string[] {
  const big = BigInt(raw);
  let hex = big.toString(16);
  if (hex.length % 2) hex = "0" + hex;
  const bytes = Buffer.from(hex, "hex");
  let buf: Buffer = bytes;
  try {
    buf = zlib.gunzipSync(bytes);
  } catch {
    try {
      buf = zlib.inflateSync(bytes);
    } catch {
      buf = bytes;
    }
  }
  const tokens: string[] = [];
  let start = 0;
  for (let i = 0; i < buf.length; i++) {
    if (buf[i] === 0xff) {
      tokens.push(buf.subarray(start, i).toString("utf8"));
      start = i + 1;
    }
  }
  tokens.push(buf.subarray(start).toString("utf8"));
  return tokens;
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
    else if (!dob && /\d{2}[-/]\d{2}[-/]\d{4}/.test(t)) dob = t.match(/\d{2}[-/]\d{2}[-/]\d{4}/)![0];
    else if (!dob && /^(19|20)\d{2}$/.test(t)) dob = t;
    else if (!name && /^[A-Za-z][A-Za-z .]{2,}$/.test(t)) name = t;
  }
  return { name, dob, gender };
}

export async function POST(req: Request) {
  const { raw } = await req.json();
  if (!raw || typeof raw !== "string") {
    return NextResponse.json({ error: "raw required" }, { status: 400 });
  }

  let name: string | undefined;
  let dob: string | undefined;
  let gender: string | undefined;

  try {
    if (/<\?xml|PrintLetterBarcodeData|name=/.test(raw)) {
      name = raw.match(/name="([^"]+)"/)?.[1];
      gender = normGender(raw.match(/gender="([^"]+)"/)?.[1]);
      dob = raw.match(/dob="([^"]+)"/)?.[1] ?? raw.match(/yob="(\d{4})"/)?.[1];
    } else if (/^\d{6,}$/.test(raw.trim())) {
      ({ name, dob, gender } = extractFromTokens(secureQrTokens(raw.trim())));
    } else {
      // plain delimited or JSON fallback
      try {
        const j = JSON.parse(raw);
        name = j.name;
        gender = normGender(j.gender);
        dob = j.dob;
      } catch {
        ({ name, dob, gender } = extractFromTokens(raw.split(/[|,;￿\xff]/)));
      }
    }
  } catch (e) {
    console.error("aadhaar parse failed", e);
  }

  return NextResponse.json({ name, gender, dob, ageBand: ageBandFromDob(dob) });
}
