// Publish Firestore rules via the Firebase Rules REST API using the service
// account. Run: node --env-file=.env.local scripts/deploy-rules.mjs [rulesFile]
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { readFileSync } from "node:fs";

const b64 = process.env.FIREBASE_SERVICE_ACCOUNT_B64;
if (!b64) throw new Error("FIREBASE_SERVICE_ACCOUNT_B64 missing (use --env-file=.env.local)");
const sa = JSON.parse(Buffer.from(b64, "base64").toString("utf8"));
const projectId = sa.project_id;
const app = getApps().length ? getApps()[0] : initializeApp({ credential: cert(sa) });
const { access_token } = await app.options.credential.getAccessToken();

const rulesFile = process.argv[2] || "firestore.dev.rules";
const content = readFileSync(new URL(`../${rulesFile}`, import.meta.url), "utf8");

const headers = {
  Authorization: `Bearer ${access_token}`,
  "Content-Type": "application/json",
};

// 1. Create a ruleset.
const rsRes = await fetch(
  `https://firebaserules.googleapis.com/v1/projects/${projectId}/rulesets`,
  {
    method: "POST",
    headers,
    body: JSON.stringify({
      source: { files: [{ name: "firestore.rules", content }] },
    }),
  },
);
const rsJson = await rsRes.json();
if (!rsRes.ok) {
  console.log(`FAIL create ruleset ${rsRes.status}: ${JSON.stringify(rsJson)}`);
  process.exit(1);
}
const rulesetName = rsJson.name;
console.log(`OK ruleset created: ${rulesetName}`);

// 2. Point the cloud.firestore release at it (create, else patch).
const releaseName = `projects/${projectId}/releases/cloud.firestore`;
let relRes = await fetch(
  `https://firebaserules.googleapis.com/v1/projects/${projectId}/releases`,
  { method: "POST", headers, body: JSON.stringify({ name: releaseName, rulesetName }) },
);
if (relRes.status === 409) {
  relRes = await fetch(`https://firebaserules.googleapis.com/v1/${releaseName}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({ release: { name: releaseName, rulesetName } }),
  });
}
const relJson = await relRes.json();
if (!relRes.ok) {
  console.log(`FAIL release ${relRes.status}: ${JSON.stringify(relJson)}`);
  process.exit(1);
}
console.log(`OK published ${rulesFile} -> cloud.firestore`);
process.exit(0);
