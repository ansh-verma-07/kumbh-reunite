// Client-side photo processing — runs entirely in the browser, offline-capable.
// NO face recognition: only (1) k-means dominant-colour signature and
// (2) dhash perceptual hash for same-photo duplicate detection. (PRD §2, §8.)
"use client";

async function fileToImageData(file: File, w: number, h: number): Promise<ImageData> {
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(bitmap, 0, 0, w, h);
  return ctx.getImageData(0, 0, w, h);
}

function toHex(r: number, g: number, b: number): string {
  const h = (n: number) => n.toString(16).padStart(2, "0");
  return `#${h(r)}${h(g)}${h(b)}`;
}

/** Extract 3-5 dominant clothing colours via a small k-means pass. */
export async function extractColourSignature(file: File, k = 4): Promise<string[]> {
  const { data } = await fileToImageData(file, 64, 64);
  const pixels: number[][] = [];
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 128) continue; // skip transparent
    pixels.push([data[i], data[i + 1], data[i + 2]]);
  }
  if (pixels.length === 0) return [];

  // Deterministic seeding: evenly spaced samples (no Math.random — reproducible).
  let centroids: number[][] = Array.from({ length: k }, (_, c) =>
    pixels[Math.floor((c * pixels.length) / k)].slice(),
  );

  for (let iter = 0; iter < 8; iter++) {
    const sums: number[][] = Array.from({ length: k }, () => [0, 0, 0, 0]);
    for (const p of pixels) {
      let best = 0;
      let bestD = Infinity;
      for (let c = 0; c < k; c++) {
        const dr = p[0] - centroids[c][0];
        const dg = p[1] - centroids[c][1];
        const dbl = p[2] - centroids[c][2];
        const d = dr * dr + dg * dg + dbl * dbl;
        if (d < bestD) {
          bestD = d;
          best = c;
        }
      }
      sums[best][0] += p[0];
      sums[best][1] += p[1];
      sums[best][2] += p[2];
      sums[best][3] += 1;
    }
    centroids = sums.map((s, c) =>
      s[3] ? [s[0] / s[3], s[1] / s[3], s[2] / s[3]] : centroids[c],
    );
  }

  // Order by cluster size (most dominant first).
  const counts = Array.from({ length: k }, () => 0);
  for (const p of pixels) {
    let best = 0;
    let bestD = Infinity;
    for (let c = 0; c < k; c++) {
      const dr = p[0] - centroids[c][0];
      const dg = p[1] - centroids[c][1];
      const dbl = p[2] - centroids[c][2];
      const d = dr * dr + dg * dg + dbl * dbl;
      if (d < bestD) {
        bestD = d;
        best = c;
      }
    }
    counts[best]++;
  }
  return centroids
    .map((c, i) => ({ c, n: counts[i] }))
    .sort((a, b) => b.n - a.n)
    .filter((x) => x.n > 0)
    .map((x) => toHex(Math.round(x.c[0]), Math.round(x.c[1]), Math.round(x.c[2])));
}

/** 64-bit dhash (9x8 grayscale difference hash) as a 16-char hex string. */
export async function computeDhash(file: File): Promise<string> {
  const { data } = await fileToImageData(file, 9, 8);
  const gray: number[] = [];
  for (let i = 0; i < data.length; i += 4) {
    gray.push(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
  }
  let bits = "";
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const left = gray[row * 9 + col];
      const right = gray[row * 9 + col + 1];
      bits += left > right ? "1" : "0";
    }
  }
  let hex = "";
  for (let i = 0; i < 64; i += 4) {
    hex += parseInt(bits.slice(i, i + 4), 2).toString(16);
  }
  return hex;
}

/** Hamming distance between two dhash hex strings (0 = identical photo). */
export function dhashDistance(a: string, b: string): number {
  if (a.length !== b.length) return 64;
  let dist = 0;
  for (let i = 0; i < a.length; i++) {
    let x = parseInt(a[i], 16) ^ parseInt(b[i], 16);
    while (x) {
      dist += x & 1;
      x >>= 1;
    }
  }
  return dist;
}
