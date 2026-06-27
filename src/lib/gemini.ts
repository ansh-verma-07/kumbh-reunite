// Gemini server-side helpers (API key stays server-only).
// Replaces the Claude/LaBSE design: Gemini handles BOTH text normalization
// AND multilingual embeddings, so no self-hosted LaBSE / Cloud Run is needed.
import "server-only";

import { GoogleGenAI, Type } from "@google/genai";
import type { Language, StructuredDescription } from "@/lib/types";

const TEXT_MODEL = process.env.GEMINI_TEXT_MODEL || "gemini-2.0-flash";
const EMBED_MODEL = process.env.GEMINI_EMBED_MODEL || "gemini-embedding-001";
export const EMBED_DIM = Number(process.env.GEMINI_EMBED_DIM || 768);

let _ai: GoogleGenAI | null = null;
function ai(): GoogleGenAI {
  if (!_ai) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("GEMINI_API_KEY is not set");
    _ai = new GoogleGenAI({ apiKey });
  }
  return _ai;
}

/**
 * Normalize free-text physical/clothing description into structured fields.
 * The original raw text is never discarded by the caller — this only enriches.
 */
export async function normalizeDescription(
  rawText: string,
): Promise<StructuredDescription> {
  const res = await ai().models.generateContent({
    model: TEXT_MODEL,
    contents: `Extract structured attributes from this missing/found person description. It may be in any Indian language. Description: """${rawText}"""`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          clothingColours: { type: Type.ARRAY, items: { type: Type.STRING } },
          garmentTypes: { type: Type.ARRAY, items: { type: Type.STRING } },
          distinguishingMarks: { type: Type.ARRAY, items: { type: Type.STRING } },
          healthIndicators: { type: Type.ARRAY, items: { type: Type.STRING } },
          destinationMentioned: { type: Type.ARRAY, items: { type: Type.STRING } },
        },
        required: [
          "clothingColours",
          "garmentTypes",
          "distinguishingMarks",
          "healthIndicators",
          "destinationMentioned",
        ],
      },
    },
  });
  const text = res.text ?? "{}";
  const parsed = JSON.parse(text) as Partial<StructuredDescription>;
  return {
    clothingColours: parsed.clothingColours ?? [],
    garmentTypes: parsed.garmentTypes ?? [],
    distinguishingMarks: parsed.distinguishingMarks ?? [],
    healthIndicators: parsed.healthIndicators ?? [],
    destinationMentioned: parsed.destinationMentioned ?? [],
  };
}

/**
 * Multilingual embedding for duplicate / found-person matching.
 * gemini-embedding-001 is trained across 100+ languages, covering all 10
 * dataset languages with no translation step.
 */
export async function embedText(text: string): Promise<number[]> {
  const res = await ai().models.embedContent({
    model: EMBED_MODEL,
    contents: text,
    config: { outputDimensionality: EMBED_DIM },
  });
  const values = res.embeddings?.[0]?.values;
  if (!values) throw new Error("Gemini returned no embedding");
  return values;
}

/** Generate a PA announcement in the case's language (twice-broadcast policy). */
export async function generateAnnouncement(opts: {
  language: Language;
  name?: string;
  ageBand?: string;
  gender?: string;
  clothing?: string[];
  lastSeenZone?: string;
}): Promise<string> {
  const { language, name, ageBand, gender, clothing, lastSeenZone } = opts;
  const res = await ai().models.generateContent({
    model: TEXT_MODEL,
    contents: `Write a short, clear public-address announcement in ${language} for a missing person at the Kumbh Mela. Keep it under 40 words, calm and respectful. Details — name: ${name ?? "unknown"}; age band: ${ageBand ?? "unknown"}; gender: ${gender ?? "unknown"}; clothing: ${(clothing ?? []).join(", ") || "unknown"}; last seen near: ${lastSeenZone ?? "unknown"}. Tell anyone who sees this person to bring them to the nearest Kho-Ya-Paya help centre. Output only the announcement text in ${language}.`,
  });
  return (res.text ?? "").trim();
}
