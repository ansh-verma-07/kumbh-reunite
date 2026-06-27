"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { listOpenCases } from "@/lib/cases";
import { AGE_BANDS, type CaseDoc } from "@/lib/types";
import { useTranslation } from "@/components/LanguageProvider";

export default function SearchPage() {
  const { t } = useTranslation();
  const [all, setAll] = useState<CaseDoc[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [gender, setGender] = useState("");
  const [ageBand, setAgeBand] = useState("");
  const [kind, setKind] = useState("");

  useEffect(() => {
    listOpenCases()
      .then(setAll)
      .catch((e) => setError(String(e?.message ?? e)));
  }, []);

  const results = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return all.filter((c) => {
      if (gender && c.gender !== gender) return false;
      if (ageBand && c.ageBand !== ageBand) return false;
      if (kind && c.kind !== kind) return false;
      if (needle) {
        const hay = [
          c.name,
          c.caseId,
          c.descriptionRaw,
          c.centreId,
          c.lastSeenZone,
          ...(c.descriptionStructured?.clothingColours ?? []),
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
  }, [all, q, gender, ageBand, kind]);

  return (
    <div className="space-y-5">
      <h1 className="text-4xl uppercase">{t("search_title")}</h1>

      {error && (
        <div className="nb-card-flat bg-[var(--warning)] p-3 font-bold text-sm">{error}</div>
      )}

      <div className="grid sm:grid-cols-4 gap-3">
        <input
          className="nb-input sm:col-span-2"
          placeholder={t("search_placeholder")}
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <select className="nb-select" value={gender} onChange={(e) => setGender(e.target.value)}>
          <option value="">{t("search_any_gender")}</option>
          <option value="male">{t("search_male")}</option>
          <option value="female">{t("search_female")}</option>
          <option value="other">{t("search_other")}</option>
          <option value="unknown">{t("search_unknown")}</option>
        </select>
        <select className="nb-select" value={ageBand} onChange={(e) => setAgeBand(e.target.value)}>
          <option value="">{t("search_any_age")}</option>
          {AGE_BANDS.map((a) => (
            <option key={a}>{a}</option>
          ))}
        </select>
      </div>

      <div className="flex gap-2 items-center">
        {[
          { v: "", label: t("search_all") },
          { v: "missing", label: t("search_missing") },
          { v: "found", label: t("search_found") },
        ].map((o) => (
          <button
            key={o.v}
            onClick={() => setKind(o.v)}
            className={
              "px-3 py-1 border-[3px] border-ink font-extrabold uppercase text-xs " +
              (kind === o.v ? "bg-ink text-white" : "bg-white")
            }
          >
            {o.label}
          </button>
        ))}
        <span className="ml-auto nb-chip bg-[var(--lime)]">{results.length} {t("search_results")}</span>
      </div>

      <div className="nb-card divide-y-[3px] divide-ink">
        {results.map((c) => (
          <Link key={c.id} href={`/case/${c.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-[var(--bg)]">
            {c.photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={c.photoUrl} alt="" className="h-12 w-12 object-cover border-[3px] border-ink" />
            ) : (
              <div className="flex flex-col gap-0.5">
                {(c.colourSignature ?? []).slice(0, 4).map((hex, i) => (
                  <span key={i} className="h-3 w-12 border-2 border-ink" style={{ background: hex }} />
                ))}
              </div>
            )}
            <div className="flex-1">
              <div className="text-sm font-extrabold">
                {c.name || t("search_no_name")}{" "}
                <span className="opacity-50 font-mono">· {c.caseId}</span>
              </div>
              <div className="text-xs font-semibold opacity-70">
                {c.kind} · {c.centreId} · {c.ageBand ?? "?"} · {c.gender}
                {c.lastSeenZone ? ` · ${t("search_last_seen")} ${c.lastSeenZone}` : ""}
              </div>
            </div>
            <span
              className="nb-badge"
              style={{ background: c.kind === "missing" ? "var(--danger)" : "var(--success)", color: c.kind === "missing" ? "#fff" : "var(--ink)" }}
            >
              {c.status}
            </span>
          </Link>
        ))}
        {results.length === 0 && (
          <div className="px-4 py-10 text-center font-bold opacity-60">{t("search_no_matches")}</div>
        )}
      </div>
    </div>
  );
}
