// Bulk-seed all 2,500 cases from Synthetic_Missing_Persons_2500.csv into Firestore.
// Run: node --env-file=.env.local scripts/seed.mjs
//
// Flags:
//   --dry-run   Parse CSV and print first 5 rows; no Firestore writes.
//   --limit N   Only import the first N rows (useful for smoke-testing).
//
// Firestore batches are capped at 500 writes each.

import { createReadStream } from "fs";
import { createInterface } from "readline";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CSV_PATH = resolve(
  __dirname,
  "../data sets/data/Synthetic_Missing_Persons_2500.csv",
);

const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
const limitIdx = args.indexOf("--limit");
const LIMIT = limitIdx !== -1 ? parseInt(args[limitIdx + 1], 10) : Infinity;

// ── CSV parser (handles double-quoted fields with embedded commas) ────────────
function parseLine(line) {
  const fields = [];
  let cur = "", inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (inQ && line[i + 1] === '"') { cur += '"'; i++; }
      else { inQ = !inQ; }
    } else if (c === "," && !inQ) {
      fields.push(cur);
      cur = "";
    } else {
      cur += c;
    }
  }
  fields.push(cur);
  return fields;
}

// ── Field mappers ─────────────────────────────────────────────────────────────

// CSV age bands → CaseDoc AgeBand (types.ts AGE_BANDS)
function mapAgeBand(csv) {
  switch (csv) {
    case "0-12":  return "0-10";
    case "13-17": return "11-20";
    case "18-40": return "31-40";
    case "41-60": return "51-60";
    case "61-70": return "61-70";
    case "71-80": return "71+";
    case "80+":   return "71+";
    default:      return undefined;
  }
}

function mapGender(csv) {
  switch (csv?.toLowerCase()) {
    case "male":   return "male";
    case "female": return "female";
    default:       return "unknown";
  }
}

// CSV status → CaseDoc CaseStatus
function mapStatus(csv) {
  switch (csv?.trim()) {
    case "Reunited":              return "resolved";
    case "Transferred to hospital": return "resolved";
    case "Unresolved":            return "archived";
    default:                      return "missing"; // Pending or blank
  }
}

// "2027-07-28 06:01" → epoch ms (treat as UTC)
function parseDate(str) {
  if (!str) return Date.now();
  const d = new Date(str.trim().replace(" ", "T") + ":00Z");
  return isNaN(d.getTime()) ? Date.now() : d.getTime();
}

function rowToCase(row) {
  const reportedAt = parseDate(row.reported_at);
  const resHours = parseFloat(row.resolution_hours);
  const resolvedAt = isNaN(resHours) ? undefined : reportedAt + resHours * 3_600_000;
  const status = mapStatus(row.status);

  const doc = {
    caseId:      row.case_id,
    kind:        "missing",
    status,
    centreId:    row.reporting_center,
    language:    row.language,
    gender:      mapGender(row.gender),
    createdAt:   reportedAt,
    updatedAt:   reportedAt,
  };

  if (row.missing_person_name) doc.name = row.missing_person_name;
  const band = mapAgeBand(row.age_band);
  if (band)                    doc.ageBand = band;
  if (row.physical_description) doc.descriptionRaw = row.physical_description;
  if (row.last_seen_location)   doc.lastSeenZone = row.last_seen_location;
  if (row.reporter_mobile)      doc.reporterMobile = row.reporter_mobile;
  if (resolvedAt)               doc.resolvedAt = resolvedAt;
  if (row.remarks)              doc.conditionTags = [row.remarks];

  // Escalation stage derived from status
  if (status === "archived")  doc.escalationStage = "bureau";
  else if (status === "resolved") doc.escalationStage = "active";
  else                            doc.escalationStage = "active";

  // Flag true duplicates for supervisor merge-review queue
  if (row.is_duplicate_report === "True" && status === "missing") {
    doc.mergeReview = true;
  }

  return doc;
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  let db;
  if (!DRY_RUN) {
    const b64 = process.env.FIREBASE_SERVICE_ACCOUNT_B64;
    if (!b64) throw new Error("FIREBASE_SERVICE_ACCOUNT_B64 missing");
    const { initializeApp, cert, getApps } = await import("firebase-admin/app");
    const { getFirestore } = await import("firebase-admin/firestore");
    const credential = cert(JSON.parse(Buffer.from(b64, "base64").toString("utf8")));
    const app = getApps().length ? getApps()[0] : initializeApp({ credential });
    db = getFirestore(app);
  }

  const rl = createInterface({
    input: createReadStream(CSV_PATH),
    crlfDelay: Infinity,
  });

  let headers = null;
  const rows = [];

  for await (const line of rl) {
    if (!line.trim()) continue;
    if (!headers) {
      headers = parseLine(line);
      continue;
    }
    const vals = parseLine(line);
    const row = Object.fromEntries(headers.map((h, i) => [h, vals[i] ?? ""]));
    rows.push(row);
    if (rows.length >= LIMIT) break;
  }

  console.log(`Parsed ${rows.length} rows from CSV.`);

  if (DRY_RUN) {
    console.log("DRY RUN — first 5 mapped docs:");
    rows.slice(0, 5).forEach((r) => console.log(JSON.stringify(rowToCase(r), null, 2)));
    return;
  }

  // Batch write: Firestore max 500 ops/batch
  const BATCH_SIZE = 499;
  let written = 0;
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const chunk = rows.slice(i, i + BATCH_SIZE);
    const batch = db.batch();
    for (const row of chunk) {
      const doc = rowToCase(row);
      const ref = db.collection("cases").doc(); // auto-id
      batch.set(ref, doc);
    }
    await batch.commit();
    written += chunk.length;
    console.log(`  committed ${written}/${rows.length}`);
  }

  console.log(`Done. ${written} cases written to Firestore.`);
  process.exit(0);
}

main().catch((err) => { console.error(err); process.exit(1); });
