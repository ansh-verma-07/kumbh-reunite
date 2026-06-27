// Core data model for Kumbh Reunite (Firestore documents).
// See PRD §8.1. Gemini is the AI provider (not Claude).

export const LANGUAGES = [
  "Hindi",
  "Bengali",
  "Kannada",
  "Maithili",
  "Gujarati",
  "Telugu",
  "Bhojpuri",
  "Awadhi",
  "Tamil",
  "Marathi",
] as const;
export type Language = (typeof LANGUAGES)[number];

export type Gender = "male" | "female" | "other" | "unknown";

export const AGE_BANDS = [
  "0-10",
  "11-20",
  "21-30",
  "31-40",
  "41-50",
  "51-60",
  "61-70",
  "71+",
] as const;
export type AgeBand = (typeof AGE_BANDS)[number];

export type CaseStatus = "missing" | "found" | "resolved" | "archived";
export type CaseKind = "missing" | "found"; // what the report represents at intake

export type Role = "volunteer" | "supervisor" | "police";

// Gemini-extracted structured description (normalization layer).
export interface StructuredDescription {
  clothingColours: string[]; // human-readable, e.g. ["white", "saffron"]
  garmentTypes: string[]; // e.g. ["kurta", "dupatta"]
  distinguishingMarks: string[];
  healthIndicators: string[]; // e.g. ["confused", "hearing aid"]
  destinationMentioned: string[]; // e.g. ["Ramkund"]
}

export interface CaseDoc {
  id: string;
  caseId: string; // human-facing, e.g. KMP-2027-04821
  kind: CaseKind;
  status: CaseStatus;

  centreId: string;
  language: Language;

  // Identity (all optional — case creation never blocks on missing fields)
  name?: string;
  ageBand?: AgeBand;
  gender: Gender;

  // Description
  descriptionRaw?: string;
  descriptionStructured?: StructuredDescription;

  // Photo-derived (computed client-side, offline-capable)
  colourSignature?: string[]; // 3-5 hex values from k-means
  dhash?: string; // perceptual hash for same-photo duplicate detection
  photoUrl?: string; // hosted image URL (imgbb — free-plan friendly, no Firebase Storage)

  // Multilingual similarity (Gemini embedding) — used by Firestore findNearest
  embedding?: number[]; // GEMINI_EMBED_DIM length
  embeddedAt?: number; // epoch ms; absent until enriched (offline-created docs)

  // Last seen
  lastSeenZone?: string;
  lastSeenAt?: number;
  conditionTags?: string[];

  // Contact (optional — 19.7% have no phone)
  reporterMobile?: string;

  // Linking / merge
  shareLinkId?: string;
  masterCaseId?: string; // set when merged into another case
  mergeReview?: boolean; // same photo (dhash) seen at two centres — supervisor review
  conflictWith?: string; // the other case id in a merge-review pair
  probable?: boolean; // found-person match flagged "probable", awaiting supervisor
  probableMatchId?: string; // the candidate this case is a probable match for
  childCaseIds?: string[]; // child report ids merged into this master case

  // Long-duration escalation (Flow E)
  escalationStage?: "active" | "archived" | "bureau" | "national";
  archivedAt?: number;
  lastReconfirmAt?: number;

  createdAt: number;
  updatedAt: number;
  resolvedAt?: number;
}

export type PaStatus = "pending" | "broadcasting" | "done" | "cancelled";

export interface PaBroadcast {
  node: string;
  at: number;
  round: number;
}

export interface PaQueueDoc {
  id: string;
  caseId: string;
  caseHumanId: string;
  language: Language;
  text: string;
  node: string; // nearest transfer node
  status: PaStatus;
  broadcasts: PaBroadcast[];
  nextBroadcastAt?: number; // when the next round is due
  expandedAt?: number; // when it expanded to 2 nodes (after 2h no response)
  createdAt: number;
}

export interface ShareLinkDoc {
  id: string; // the UUID in the URL
  caseId: string;
  expiresAt: number; // epoch ms; enforced in Security Rules
  createdAt: number;
}

export interface TipDoc {
  id: string;
  caseId: string;
  location?: string;
  note?: string;
  status: "unverified" | "verified" | "dismissed";
  createdAt: number;
}

export interface ZoneDoc {
  id: string;
  name: string;
  geohash: string;
  centroid: { lat: number; lng: number };
  cameraCount: number;
  chokepointCount: number;
  riskScore: number; // 0..1, recomputed by scheduled job
  riskBand: "critical" | "elevated" | "moderate" | "low";
}

// A duplicate-detection candidate surfaced to the volunteer for confirm/dismiss.
export interface DuplicateCandidate {
  caseId: string;
  name?: string;
  centreId: string;
  ageBand?: AgeBand;
  gender: Gender;
  similarity: number; // 0..1 cosine
  colourOverlap: number; // 0..1
}
