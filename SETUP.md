# Kumbh Reunite — Setup

Next.js 16 (App Router, PWA) + Firebase (Firestore, Auth, Storage) + **Gemini** for AI
(text normalization, multilingual embeddings, PA-announcement text). Gemini replaces
the Claude/LaBSE design — no self-hosted embedding model.

## 1. Create a Firebase project
1. https://console.firebase.google.com → Add project.
2. **Build → Firestore Database → Create database** (production mode). Firestore vector
   search (`findNearest`) is used for duplicate detection.
3. **Build → Authentication → Get started →** enable **Anonymous** (dev) and later
   Email/Password for staff.
4. **Build → Storage → Get started** (for case photos — upload wiring is a TODO).

## 2. Get the Web config + service account
- **Project settings → General → Your apps → Web app** → copy the config values.
- **Project settings → Service accounts → Generate new private key** → download JSON.
  Base64-encode it for the server env:
  - PowerShell: `[Convert]::ToBase64String([IO.File]::ReadAllBytes("serviceAccount.json"))`

## 3. Get a Gemini API key
- https://aistudio.google.com/apikey → create key.

## 4. Configure env
Copy `.env.local.example` to `.env.local` and fill in:
```
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=...
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
NEXT_PUBLIC_FIREBASE_APP_ID=...
FIREBASE_SERVICE_ACCOUNT_B64=...     # base64 of the service-account JSON
GEMINI_API_KEY=...
```
Keep `GEMINI_EMBED_DIM=768` in sync with the vector index dimension below.

## 5. Deploy Firestore rules + the vector index
Install the CLI and log in (one time):
```
npm i -g firebase-tools
firebase login
firebase use --add        # pick your project
firebase deploy --only firestore:rules,firestore:indexes,storage
```
The vector index in `firestore.indexes.json` (dimension 768, COSINE) is **required** for
duplicate detection. Without it, case creation still works but the duplicate panel is empty.

> Vector indexes can also be created with:
> `gcloud firestore indexes composite create --collection-group=cases --query-scope=COLLECTION --field-config=field-path=embedding,vector-config='{"dimension":768,"flat":"{}"}'`

## 6. Grant a staff role
Firestore rules require a `role` custom claim (`volunteer` / `supervisor` / `police`).
After signing in (the app signs in anonymously on load), set the claim once with the
Admin SDK — quickest via a Node one-off:
```js
// node set-role.js <uid> <role>   (run with GOOGLE_APPLICATION_CREDENTIALS set)
const admin = require("firebase-admin");
admin.initializeApp();
admin.auth().setCustomUserClaims(process.argv[2], { role: process.argv[3] }).then(() => process.exit());
```
The user must sign out/in (or refresh the ID token) for the claim to take effect.

## 7. Run
```
cd kumbh-reunite
npm run dev
```
Open http://localhost:3000 — Dashboard, **New case** (kiosk), **Search**.
Share links render at `/find/<linkId>` (public, no login).

## What works today (MVP slice)
- Unified cross-centre registry, search, dashboard counts.
- Kiosk case intake (missing/found), 10 languages, optional everything.
- On-device photo processing: k-means colour signature + dhash (offline-capable).
- Gemini enrichment: structured description + multilingual embedding.
- Duplicate / found-match detection via Firestore `findNearest` (human-confirmed).
- 7-day WhatsApp share link + public case view + sighting tips.
- Offline persistence (Firestore) for the kiosk on flaky 3G.

## Not yet built (next milestones — see ../kumbh_reunite_PRD.md)
- Photo upload to Firebase Storage (colours/hash already computed client-side).
- PA-announcement queue (Gemini text gen helper exists in `src/lib/gemini.ts`).
- Police hotspot map + scheduled risk-score recompute (geohash).
- Aadhaar QR scan intake.
- Long-duration escalation jobs (Cloud Scheduler).
- Email/password staff auth UI + role bootstrap UI.
