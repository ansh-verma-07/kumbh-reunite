"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { listOpenCases } from "@/lib/cases";
import type { CaseDoc } from "@/lib/types";

const STAT_COLORS = ["var(--danger)", "var(--success)", "var(--cyan)", "var(--accent)"];

export default function Dashboard() {
  const [cases, setCases] = useState<CaseDoc[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listOpenCases()
      .then(setCases)
      .catch((e) => setError(String(e?.message ?? e)));
  }, []);

  const missing = cases.filter((c) => c.status === "missing").length;
  const found = cases.filter((c) => c.status === "found").length;
  const byCentre = new Map<string, number>();
  for (const c of cases) byCentre.set(c.centreId, (byCentre.get(c.centreId) ?? 0) + 1);

  const stats = [
    { label: "Open missing", value: missing },
    { label: "Open found", value: found },
    { label: "Total open", value: cases.length },
    { label: "Centres reporting", value: byCentre.size },
  ];

  return (
    <div className="space-y-8">
      <section>
        <h1 className="text-4xl uppercase">Command dashboard</h1>
        <p className="mt-2 font-semibold max-w-xl">
          One shared registry across all 10 Kho-Ya-Paya centres. A person found at one
          centre is visible to a family searching at another.
        </p>
      </section>

      {error && (
        <div className="nb-card-flat bg-[var(--warning)] p-3 font-bold text-sm">
          Could not load cases: {error}. Check <code>.env.local</code> + Firestore rules.
          See <code>SETUP.md</code>.
        </div>
      )}

      <section className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {stats.map((s, i) => (
          <div
            key={s.label}
            className="nb-card p-4"
            style={{ background: STAT_COLORS[i % STAT_COLORS.length] }}
          >
            <div className="text-4xl font-extrabold">{s.value}</div>
            <div className="text-xs font-extrabold uppercase mt-1">{s.label}</div>
          </div>
        ))}
      </section>

      <section className="flex flex-wrap gap-3">
        <Link href="/new" className="nb-btn nb-btn-primary">
          + File a new case
        </Link>
        <Link href="/search" className="nb-btn">
          Search registry
        </Link>
      </section>

      <section>
        <h2 className="nb-label mb-2">Cases by centre</h2>
        <div className="nb-card divide-y-[3px] divide-ink">
          {[...byCentre.entries()]
            .sort((a, b) => b[1] - a[1])
            .map(([centre, n]) => (
              <div
                key={centre}
                className="flex justify-between px-4 py-2.5 text-sm font-bold"
              >
                <span>{centre}</span>
                <span className="nb-chip bg-[var(--lime)]">{n}</span>
              </div>
            ))}
          {byCentre.size === 0 && (
            <div className="px-4 py-8 text-center text-sm font-bold opacity-60">
              No cases yet.
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
