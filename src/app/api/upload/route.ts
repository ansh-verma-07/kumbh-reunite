// POST /api/upload  { imageBase64: string }  ->  { url, deleteUrl }
// Hosts the case photo on imgbb (free, no Firebase Storage). The API key stays
// server-side. Base64 must be raw (no "data:image/...;base64," prefix).
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const key = process.env.IMGBB_API_KEY;
  if (!key) {
    return NextResponse.json({ error: "IMGBB_API_KEY not set" }, { status: 500 });
  }

  let imageBase64: string;
  try {
    ({ imageBase64 } = await req.json());
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }
  if (!imageBase64) {
    return NextResponse.json({ error: "imageBase64 required" }, { status: 400 });
  }
  // Strip a data-URL prefix if the client left one on.
  imageBase64 = imageBase64.replace(/^data:image\/[a-zA-Z+]+;base64,/, "");

  const form = new URLSearchParams();
  form.set("key", key);
  form.set("image", imageBase64);

  const res = await fetch("https://api.imgbb.com/1/upload", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form,
  });
  const json = await res.json();
  if (!res.ok || !json?.data?.url) {
    return NextResponse.json(
      { error: json?.error?.message ?? "imgbb upload failed" },
      { status: 502 },
    );
  }
  return NextResponse.json({
    url: json.data.url as string,
    deleteUrl: json.data.delete_url as string,
  });
}
