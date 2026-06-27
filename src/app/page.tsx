"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { listOpenCases } from "@/lib/cases";
import { AGE_BANDS } from "@/lib/types";
import type { CaseDoc } from "@/lib/types";

// ---------------------------------------------------------------------------
// Demo fallback — illustrative figures derived from the 2,500-record synthetic
// dataset patterns (Claude Impact Lab). Shown only when the live Firestore
// registry is empty, so the dashboard reads well during review. The moment real
// cases load, every panel switches to live values automatically.
// ---------------------------------------------------------------------------
const DEMO = {
  total: 2500,
  reunited: 1978,
  pending: 344,
  transferred: 104,
  unresolved: 74,
  duplicates: 200,
  centres: 8,
  medianReuniteH: 4.9,
  noNamePct: 18,
  noContactPct: 22,
  cctv: 1280,
  zones: 32,
  police: 14,
  chokepoints: 85,
};

const DEMO_STATUS: Bar[] = [
  { label: "Reunited", value: DEMO.reunited, color: "var(--success)" },
  { label: "Pending", value: DEMO.pending, color: "var(--warning)" },
  { label: "Transferred", value: DEMO.transferred, color: "var(--cyan)" },
  { label: "Unresolved", value: DEMO.unresolved, color: "var(--danger)" },
];

const DEMO_AGE: Bar[] = [
  { label: "0-12", value: 161 },
  { label: "13-17", value: 94 },
  { label: "18-40", value: 359 },
  { label: "41-60", value: 475 },
  { label: "61-70", value: 761 },
  { label: "71-80", value: 432 },
  { label: "80+", value: 218 },
];

const DEMO_CENTRES: [string, number][] = [
  ["Ramkund", 612],
  ["Trimbakeshwar", 498],
  ["Tapovan", 401],
  ["Panchavati", 339],
  ["Sadhugram", 268],
  ["Nashik Road", 201],
  ["CBS / Central Bus Stand", 121],
  ["Madsangvi Transit", 60],
];

// Illustrative reports-per-day series — 4–5× spikes land on Amrit Snan days,
// exactly when networks fail and separations peak (dataset key pattern).
const DEMO_DAILY = [
  32, 38, 29, 41, 35, 44, 210, 39, 33, 46, 31, 37, 42, 198,
  34, 40, 36, 45, 30, 43, 232, 38, 35, 41, 33, 47, 39, 221,
];
const SNAN_DAYS = new Set([6, 13, 20, 27]);

interface Bar {
  label: string;
  value: number;
  color?: string;
}

export default function Dashboard() {
  const [cases, setCases] = useState<CaseDoc[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    listOpenCases()
      .then(setCases)
      .catch((e) => setError(String(e?.message ?? e)))
      .finally(() => setLoaded(true));
  }, []);

  // ---- Live computations (unchanged from the original dashboard) ----
  const missing = cases.filter((c) => c.status === "missing").length;
  const found = cases.filter((c) => c.status === "found").length;
  const byCentre = new Map<string, number>();
  for (const c of cases) byCentre.set(c.centreId, (byCentre.get(c.centreId) ?? 0) + 1);

  // Demo mode kicks in only once the load settled with no live cases.
  const live = cases.length > 0;
  const demo = loaded && !live;

  // KPI cards: existing live fields are preserved; demo surfaces the
  // registry-wide outcome picture from the synthetic sample.
  const kpis: { label: string; value: string; sub: string; color: string }[] = live
    ? [
        { label: "Open missing", value: String(missing), sub: "active searches", color: "var(--danger)" },
        { label: "Open found", value: String(found), sub: "awaiting family", color: "var(--success)" },
        { label: "Total open", value: String(cases.length), sub: "across all centres", color: "var(--cyan)" },
        { label: "Centres reporting", value: String(byCentre.size), sub: "of 10 centres", color: "var(--accent)" },
      ]
    : [
        { label: "Reunited", value: `${Math.round((DEMO.reunited / DEMO.total) * 100)}%`, sub: `${DEMO.reunited} people`, color: "var(--success)" },
        { label: "Still pending", value: String(DEMO.pending), sub: "open searches", color: "var(--warning)" },
        { label: "Unresolved", value: String(DEMO.unresolved), sub: "need escalation", color: "var(--danger)" },
        { label: "Cross-centre duplicates", value: String(DEMO.duplicates), sub: "the core problem", color: "var(--accent)" },
      ];

  const statusBars: Bar[] = live
    ? [
        { label: "Open missing", value: missing, color: "var(--danger)" },
        { label: "Open found", value: found, color: "var(--success)" },
      ]
    : DEMO_STATUS;

  const ageBars: Bar[] = live
    ? AGE_BANDS.map((b) => ({ label: b, value: cases.filter((c) => c.ageBand === b).length }))
    : DEMO_AGE;

  const centreRows: [string, number][] = live
    ? [...byCentre.entries()].sort((a, b) => b[1] - a[1])
    : DEMO_CENTRES;

  const totalLabel = live ? cases.length : DEMO.total;
  const centresLabel = live ? byCentre.size : DEMO.centres;

  const maxStatus = Math.max(1, ...statusBars.map((b) => b.value));
  const maxAge = Math.max(1, ...ageBars.map((b) => b.value));
  const maxCentre = Math.max(1, ...centreRows.map(([, n]) => n));
  const maxDaily = Math.max(...DEMO_DAILY);

  return (
    <div className="space-y-8">
      {/* ---- Header ---- */}
      <section className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-4xl uppercase">Command dashboard</h1>
          <p className="mt-2 font-semibold max-w-xl">
            One shared registry across all 10 Kho-Ya-Paya centres. A person found at one
            centre is visible to a family searching at another.
          </p>
        </div>
        <span
          className="nb-badge shrink-0"
          style={{
            background: demo ? "var(--warning)" : "var(--lime)",
          }}
          title={demo ? "Showing the synthetic 2,500-record sample" : "Connected to the live registry"}
        >
          ● {demo ? "Demo data · synthetic sample" : "Live registry"}
        </span>
      </section>

      {demo && error && (
        <p className="text-xs font-bold opacity-60">
          Live registry not connected — showing demo figures. Configure{" "}
          <code>.env.local</code> + Firestore rules (see <code>SETUP.md</code>) for live data.
        </p>
      )}

      {/* ---- KPI hero row ---- */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((s) => (
          <div key={s.label} className="nb-card p-4" style={{ background: s.color }}>
            <div className="text-xs font-extrabold uppercase opacity-80">{s.label}</div>
            <div className="text-4xl font-extrabold mt-1 leading-none">{s.value}</div>
            <div className="text-[11px] font-bold uppercase mt-2 opacity-70">{s.sub}</div>
          </div>
        ))}
      </section>

      {/* ---- Primary actions ---- */}
      <section className="flex flex-wrap gap-3">
        <Link href="/new" className="nb-btn nb-btn-primary">
          + File a new case
        </Link>
        <Link href="/search" className="nb-btn">
          Search registry
        </Link>
      </section>

      {/* ---- Analytics grid ---- */}
      <section className="grid lg:grid-cols-3 gap-6">
        {/* Left column (2/3) — trends + demographics */}
        <div className="lg:col-span-2 space-y-6">
          {demo && (
            <div className="nb-card p-4">
              <h2 className="nb-label">Reports per day · spikes on Amrit Snan</h2>
              <div className="mt-4 flex items-end gap-1 h-36">
                {DEMO_DAILY.map((v, i) => (
                  <div
                    key={i}
                    className="flex-1 border-[2px] border-ink"
                    style={{
                      height: `${(v / maxDaily) * 100}%`,
                      background: SNAN_DAYS.has(i) ? "var(--warning)" : "var(--cyan)",
                    }}
                    title={`Day ${i + 1}: ${v} reports`}
                  />
                ))}
              </div>
              <p className="mt-3 text-xs font-bold opacity-70">
                Amrit Snan days carry a 4–5× surge — exactly when networks fail and
                separations peak, so the registry must work offline.
              </p>
            </div>
          )}

          <div className="nb-card p-4">
            <h2 className="nb-label">Who goes missing · by age band</h2>
            <div className="mt-4 space-y-2">
              {ageBars.map((b) => (
                <div key={b.label} className="flex items-center gap-3 text-sm font-bold">
                  <span className="w-14 shrink-0 tabular-nums">{b.label}</span>
                  <div className="flex-1 bg-[var(--bg)] border-[2px] border-ink h-5">
                    <div
                      className="h-full"
                      style={{
                        width: `${(b.value / maxAge) * 100}%`,
                        background: "var(--primary)",
                      }}
                    />
                  </div>
                  <span className="w-12 text-right tabular-nums">{b.value}</span>
                </div>
              ))}
            </div>
            {demo && (
              <p className="mt-3 text-xs font-bold opacity-70">
                The 61–70 band is the largest — elderly pilgrims separated from family.
              </p>
            )}
            {live && ageBars.every((b) => b.value === 0) && (
              <p className="mt-3 text-xs font-bold opacity-60">No age data on open cases yet.</p>
            )}
          </div>
        </div>

        {/* Right column (1/3) — status + infra + privacy */}
        <div className="space-y-6">
          <div className="nb-card p-4">
            <h2 className="nb-label">Status breakdown</h2>
            <div className="mt-4 space-y-3">
              {statusBars.map((b) => (
                <div key={b.label}>
                  <div className="flex justify-between text-xs font-extrabold uppercase">
                    <span>{b.label}</span>
                    <span className="tabular-nums">{b.value}</span>
                  </div>
                  <div className="mt-1 bg-[var(--bg)] border-[2px] border-ink h-3">
                    <div
                      className="h-full"
                      style={{ width: `${(b.value / maxStatus) * 100}%`, background: b.color }}
                    />
                  </div>
                </div>
              ))}
            </div>
            {demo && (
              <dl className="mt-4 pt-3 border-t-[2px] border-ink space-y-1.5 text-sm font-bold">
                <div className="flex justify-between">
                  <dt className="opacity-70">Median time to reunite</dt>
                  <dd>{DEMO.medianReuniteH}h</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="opacity-70">No name on file</dt>
                  <dd>{DEMO.noNamePct}%</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="opacity-70">No contact number</dt>
                  <dd>{DEMO.noContactPct}%</dd>
                </div>
              </dl>
            )}
          </div>

          <div className="nb-card p-4">
            <h2 className="nb-label">Infrastructure coverage</h2>
            <div className="mt-4 grid grid-cols-2 gap-3">
              {[
                { v: DEMO.cctv.toLocaleString(), l: "CCTV cameras", c: "var(--cyan)" },
                { v: String(DEMO.zones), l: "zones mapped", c: "var(--lime)" },
                { v: String(DEMO.police), l: "police help points", c: "var(--accent)" },
                { v: String(DEMO.chokepoints), l: "crowd chokepoints", c: "var(--warning)" },
              ].map((x) => (
                <div key={x.l} className="nb-card-flat p-2.5" style={{ background: x.c }}>
                  <div className="text-2xl font-extrabold leading-none">{x.v}</div>
                  <div className="text-[10px] font-extrabold uppercase mt-1 opacity-80">{x.l}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="nb-card p-4">
            <h2 className="nb-label">Privacy by design</h2>
            <ul className="mt-3 space-y-1.5 text-sm font-bold">
              {[
                "Contact numbers masked in every view",
                "Only identity-relevant fields sent to AI",
                "Synthetic data — no real personal records",
                "Resolved cases minimized after reunion",
              ].map((t) => (
                <li key={t} className="flex gap-2">
                  <span className="text-[var(--success)]">✓</span>
                  <span className="opacity-80">{t}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ---- Cases by centre ---- */}
      <section>
        <h2 className="nb-label mb-2">
          Cases by centre · {totalLabel} reports across {centresLabel} centres
        </h2>
        <div className="nb-card divide-y-[3px] divide-ink">
          {centreRows.map(([centre, n]) => (
            <div key={centre} className="flex items-center gap-3 px-4 py-2.5 text-sm font-bold">
              <span className="w-44 shrink-0 truncate">{centre}</span>
              <div className="flex-1 bg-[var(--bg)] border-[2px] border-ink h-4">
                <div
                  className="h-full"
                  style={{ width: `${(n / maxCentre) * 100}%`, background: "var(--lime)" }}
                />
              </div>
              <span className="nb-chip bg-white tabular-nums">{n}</span>
            </div>
          ))}
          {centreRows.length === 0 && (
            <div className="px-4 py-8 text-center text-sm font-bold opacity-60">
              No cases yet.
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
