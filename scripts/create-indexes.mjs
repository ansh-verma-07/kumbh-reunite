// Create the Firestore composite indexes (incl. the vector index) via the
// Firestore Admin REST API using the service account — no firebase/gcloud CLI.
// Run: node --env-file=.env.local scripts/create-indexes.mjs
import { initializeApp, cert, getApps } from "firebase-admin/app";

const b64 = process.env.FIREBASE_SERVICE_ACCOUNT_B64;
if (!b64) throw new Error("FIREBASE_SERVICE_ACCOUNT_B64 missing (use --env-file=.env.local)");
const sa = JSON.parse(Buffer.from(b64, "base64").toString("utf8"));
const projectId = sa.project_id;
const credential = cert(sa);
const app = getApps().length ? getApps()[0] : initializeApp({ credential });

const { access_token } = await app.options.credential.getAccessToken();

const base = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/collectionGroups/cases/indexes`;

const indexes = [
  {
    label: "vector(status, embedding[768])",
    body: {
      queryScope: "COLLECTION",
      fields: [
        { fieldPath: "status", order: "ASCENDING" },
        { fieldPath: "embedding", vectorConfig: { dimension: 768, flat: {} } },
      ],
    },
  },
  {
    label: "composite(status ASC, createdAt DESC)",
    body: {
      queryScope: "COLLECTION",
      fields: [
        { fieldPath: "status", order: "ASCENDING" },
        { fieldPath: "createdAt", order: "DESCENDING" },
      ],
    },
  },
];

for (const idx of indexes) {
  const res = await fetch(base, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${access_token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(idx.body),
  });
  const text = await res.text();
  if (res.ok) {
    console.log(`OK   ${idx.label} — index build started`);
  } else if (text.includes("ALREADY_EXISTS") || res.status === 409) {
    console.log(`SKIP ${idx.label} — already exists`);
  } else {
    console.log(`FAIL ${idx.label} — ${res.status}: ${text}`);
  }
}
process.exit(0);
