// Seed a few demo cases via the Admin SDK (bypasses Security Rules).
// Run: node --env-file=.env.local scripts/seed.mjs
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const b64 = process.env.FIREBASE_SERVICE_ACCOUNT_B64;
if (!b64) throw new Error("FIREBASE_SERVICE_ACCOUNT_B64 missing (use --env-file=.env.local)");
const credential = cert(JSON.parse(Buffer.from(b64, "base64").toString("utf8")));
const app = getApps().length ? getApps()[0] : initializeApp({ credential });
const db = getFirestore(app);

const now = Date.now();
const demo = [
  {
    caseId: "KMP-2027-00100",
    kind: "missing",
    status: "missing",
    centreId: "Nashik Road",
    language: "Hindi",
    name: "Ramlal Yadav",
    ageBand: "61-70",
    gender: "male",
    descriptionRaw: "safed kurta, saffron dupatta, rudraksha mala, kamar jhuka hua",
    colourSignature: ["#F0EDE0", "#E07B20", "#8B5A2B"],
    lastSeenZone: "Nashik Road Station",
    conditionTags: ["asks for Ramkund"],
    createdAt: now,
    updatedAt: now,
  },
  {
    // Near-duplicate of the above, filed at a different centre (Hindi).
    caseId: "KMP-2027-00101",
    kind: "missing",
    status: "missing",
    centreId: "Sadhugram",
    language: "Hindi",
    name: "Ram Lal",
    ageBand: "61-70",
    gender: "male",
    descriptionRaw: "buzurg aadmi, safed kurta aur kesari dupatta, rudraksh ki mala",
    colourSignature: ["#EFece1", "#DE7A1E"],
    lastSeenZone: "Nashik Road Station",
    createdAt: now,
    updatedAt: now,
  },
  {
    caseId: "KMP-2027-00200",
    kind: "missing",
    status: "missing",
    centreId: "Ramkund",
    language: "Marathi",
    name: "Sunita Patil",
    ageBand: "31-40",
    gender: "female",
    descriptionRaw: "lal saadi, hirvya bangdya, uncha bandha",
    colourSignature: ["#B3202C", "#1E7A3A"],
    lastSeenZone: "Ramkund Ghat",
    createdAt: now,
    updatedAt: now,
  },
];

for (const c of demo) {
  const ref = await db.collection("cases").add(c);
  console.log(`seeded ${c.caseId} -> ${ref.id}`);
}
console.log("done");
process.exit(0);
