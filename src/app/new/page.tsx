"use client";

import { useState } from "react";
import Link from "next/link";
import { createCase, type NewCaseInput } from "@/lib/cases";
import { extractColourSignature, computeDhash } from "@/lib/photo";
import { LANGUAGES, AGE_BANDS, type DuplicateCandidate } from "@/lib/types";
import { CENTRES, ZONES } from "@/lib/constants";
import { AadhaarScan, type AadhaarFields } from "@/components/AadhaarScan";
import { mergeCase } from "@/lib/ops";

type Phase = "form" | "submitting" | "done";

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(",")[1] ?? "");
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

export default function NewCasePage() {
  const [kind, setKind] = useState<"missing" | "found">("missing");
  const [centreId, setCentreId] = useState<string>(CENTRES[0]);
  const [language, setLanguage] = useState<(typeof LANGUAGES)[number]>("Hindi");
  const [name, setName] = useState("");
  const [ageBand, setAgeBand] = useState<string>("");
  const [gender, setGender] = useState<NewCaseInput["gender"]>("unknown");
  const [description, setDescription] = useState("");
  const [lastSeenZone, setLastSeenZone] = useState("");
  const [conditions, setConditions] = useState("");
  const [mobile, setMobile] = useState("");

  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [colours, setColours] = useState<string[]>([]);
  const [dhash, setDhash] = useState<string>("");
  const [photoBusy, setPhotoBusy] = useState(false);

  const [phase, setPhase] = useState<Phase>("form");
  const [result, setResult] = useState<{
    caseId: string;
    id: string;
    shareLinkId?: string;
    candidates: DuplicateCandidate[];
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  function applyAadhaar(f: AadhaarFields) {
    if (f.name) setName(f.name);
    if (f.gender) setGender(f.gender as NewCaseInput["gender"]);
    if (f.ageBand) setAgeBand(f.ageBand);
  }

  async function onPhoto(file: File | undefined) {
    if (!file) return;
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
    setPhotoBusy(true);
    try {
      const [sig, hash] = await Promise.all([
        extractColourSignature(file),
        computeDhash(file),
      ]);
      setColours(sig);
      setDhash(hash);
    } catch (e) {
      console.error(e);
    } finally {
      setPhotoBusy(false);
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPhase("submitting");
    setError(null);
    try {
      // Upload photo to imgbb (best-effort; skipped offline).
      let photoUrl: string | undefined;
      if (photoFile) {
        try {
          const imageBase64 = await fileToBase64(photoFile);
          const up = await fetch("/api/upload", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ imageBase64 }),
          });
          if (up.ok) photoUrl = (await up.json()).url;
        } catch {
          /* offline / imgbb down — proceed without a hosted photo */
        }
      }

      const input: NewCaseInput = {
        kind,
        centreId,
        language,
        gender,
        name: name || undefined,
        ageBand: (ageBand || undefined) as NewCaseInput["ageBand"],
        descriptionRaw: description || undefined,
        colourSignature: colours.length ? colours : undefined,
        dhash: dhash || undefined,
        photoUrl,
        lastSeenZone: lastSeenZone || undefined,
        conditionTags: conditions
          ? conditions.split(",").map((s) => s.trim()).filter(Boolean)
          : undefined,
        reporterMobile: mobile || undefined,
      };
      const created = await createCase(input);

      let candidates: DuplicateCandidate[] = [];
      try {
        const res = await fetch(`/api/cases/${created.id}/enrich`, { method: "POST" });
        if (res.ok) candidates = (await res.json()).candidates ?? [];
      } catch {
        /* offline — enrichment deferred */
      }

      setResult({ ...created, candidates });
      setPhase("done");
    } catch (e) {
      setError(String((e as Error)?.message ?? e));
      setPhase("form");
    }
  }

  if (phase === "done" && result) {
    return <DoneCard result={result} photoPreview={photoPreview} />;
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6 max-w-2xl">
      <h1 className="text-4xl uppercase">
        New {kind === "missing" ? "missing" : "found"} case
      </h1>

      <Toggle
        value={kind}
        onChange={setKind}
        options={[
          { v: "missing", label: "Missing person" },
          { v: "found", label: "Found person" },
        ]}
      />

      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="Centre">
          <select className="nb-select" value={centreId} onChange={(e) => setCentreId(e.target.value)}>
            {CENTRES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </Field>
        <Field label="Family language">
          <select
            className="nb-select"
            value={language}
            onChange={(e) => setLanguage(e.target.value as (typeof LANGUAGES)[number])}
          >
            {LANGUAGES.map((l) => (
              <option key={l}>{l}</option>
            ))}
          </select>
        </Field>
      </div>

      <Field label="Aadhaar QR (optional shortcut)">
        <AadhaarScan onFields={applyAadhaar} />
      </Field>

      <div className="grid sm:grid-cols-3 gap-4">
        <Field label="Name (optional)">
          <input className="nb-input" value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Age band">
          <select className="nb-select" value={ageBand} onChange={(e) => setAgeBand(e.target.value)}>
            <option value="">—</option>
            {AGE_BANDS.map((a) => (
              <option key={a}>{a}</option>
            ))}
          </select>
        </Field>
        <Field label="Gender">
          <select
            className="nb-select"
            value={gender}
            onChange={(e) => setGender(e.target.value as NewCaseInput["gender"])}
          >
            <option value="unknown">Unknown</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
            <option value="other">Other</option>
          </select>
        </Field>
      </div>

      <Field label="Photo (colours + duplicate hash extracted on-device; hosted on imgbb)">
        <div className="flex items-start gap-4">
          <label className="nb-btn nb-btn-warning cursor-pointer">
            {photoFile ? "Change photo" : "Add photo"}
            <input
              type="file"
              accept="image/*"
              capture="environment"
              onChange={(e) => onPhoto(e.target.files?.[0])}
              className="hidden"
            />
          </label>
          {photoPreview && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={photoPreview}
              alt="preview"
              className="h-20 w-20 object-cover border-[3px] border-ink"
            />
          )}
          <div>
            {photoBusy && <span className="text-xs font-bold">Analysing…</span>}
            {colours.length > 0 && (
              <div className="flex gap-1 mt-1">
                {colours.map((c) => (
                  <span
                    key={c}
                    title={c}
                    className="h-7 w-7 border-[3px] border-ink"
                    style={{ background: c }}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </Field>

      <Field label="Description (any language — e.g. 'safed kurta, saffron dupatta')">
        <textarea
          className="nb-textarea min-h-24"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </Field>

      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="Last seen zone">
          <input
            className="nb-input"
            list="zones"
            value={lastSeenZone}
            onChange={(e) => setLastSeenZone(e.target.value)}
          />
          <datalist id="zones">
            {ZONES.map((z) => (
              <option key={z} value={z} />
            ))}
          </datalist>
        </Field>
        <Field label="Conditions (comma-separated)">
          <input
            className="nb-input"
            placeholder="hearing aid, diabetic"
            value={conditions}
            onChange={(e) => setConditions(e.target.value)}
          />
        </Field>
      </div>

      {kind === "missing" && (
        <Field label="Reporter mobile (optional — 19.7% of families have none)">
          <input className="nb-input" value={mobile} onChange={(e) => setMobile(e.target.value)} />
        </Field>
      )}

      {error && <p className="nb-badge bg-[var(--danger)] text-white">{error}</p>}

      <button type="submit" disabled={phase === "submitting"} className="nb-btn nb-btn-primary text-base px-6 py-3">
        {phase === "submitting" ? "Submitting…" : "Create case & check duplicates"}
      </button>
    </form>
  );
}

function DoneCard({
  result,
  photoPreview,
}: {
  result: { caseId: string; id: string; shareLinkId?: string; candidates: DuplicateCandidate[] };
  photoPreview: string | null;
}) {
  const shareUrl = result.shareLinkId
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/find/${result.shareLinkId}`
    : null;
  const [merged, setMerged] = useState<string | null>(null);

  async function confirmMerge(intoCaseId: string) {
    await mergeCase(result.id, intoCaseId);
    setMerged(intoCaseId);
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="nb-card bg-[var(--success)] p-5 flex items-center gap-4">
        {photoPreview && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photoPreview} alt="" className="h-16 w-16 object-cover border-[3px] border-ink" />
        )}
        <div>
          <div className="nb-label">Case created</div>
          <div className="text-3xl font-extrabold font-mono">{result.caseId}</div>
        </div>
      </div>

      {shareUrl && (
        <div className="nb-card p-5">
          <div className="nb-label mb-1">WhatsApp share link · 7 days</div>
          <p className="text-xs font-semibold mb-2">
            Share in the family WhatsApp group. Anyone can open it — no app, no login.
          </p>
          <code className="block text-sm break-all bg-[var(--cyan)] border-[3px] border-ink p-2 font-bold">
            {shareUrl}
          </code>
        </div>
      )}

      <div className="nb-card p-5">
        <div className="nb-label mb-2">
          Possible duplicates / matches ({result.candidates.length})
        </div>
        {result.candidates.length === 0 ? (
          <p className="text-sm font-semibold opacity-70">
            No likely duplicates found across centres.
          </p>
        ) : (
          <ul className="divide-y-[3px] divide-ink">
            {result.candidates.map((c) => (
              <li key={c.caseId} className="py-2 flex items-center justify-between gap-2 text-sm font-bold">
                <Link href={`/case/${c.caseId}`} className="underline">
                  {c.name || "(no name)"} · {c.centreId} · {c.ageBand ?? "?"} · {c.gender}
                </Link>
                <span className="flex items-center gap-2">
                  <span className="nb-chip bg-[var(--warning)]">
                    {(c.similarity * 100).toFixed(0)}%
                  </span>
                  {merged === c.caseId ? (
                    <span className="nb-chip bg-[var(--success)]">merged</span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => confirmMerge(c.caseId)}
                      disabled={merged !== null}
                      className="nb-btn nb-btn-success text-[10px] py-0.5 px-2"
                    >
                      Same person
                    </button>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
        <p className="text-xs font-semibold opacity-60 mt-3">
          A volunteer confirms or dismisses each — the system never auto-merges.
        </p>
      </div>

      <div className="flex gap-3">
        <Link href={`/case/${result.id}`} className="nb-btn">
          View case
        </Link>
        <Link href="/new" className="nb-btn nb-btn-primary" onClick={() => window.location.reload()}>
          File another
        </Link>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="nb-label">{label}</span>
      {children}
    </label>
  );
}

function Toggle<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { v: T; label: string }[];
}) {
  return (
    <div className="inline-flex border-[3px] border-ink shadow-[4px_4px_0_var(--ink)]">
      {options.map((o, i) => (
        <button
          key={o.v}
          type="button"
          onClick={() => onChange(o.v)}
          className={
            "px-4 py-2 font-extrabold uppercase text-xs tracking-wide " +
            (i > 0 ? "border-l-[3px] border-ink " : "") +
            (value === o.v ? "bg-ink text-white" : "bg-white")
          }
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
