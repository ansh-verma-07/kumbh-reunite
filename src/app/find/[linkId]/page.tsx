"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { submitTip } from "@/lib/cases";

interface PublicCase {
  caseDocId: string;
  caseId: string;
  status: string;
  name: string | null;
  ageBand: string | null;
  gender: string;
  descriptionRaw: string | null;
  colourSignature: string[];
  lastSeenZone: string | null;
  photoUrl: string | null;
}

export default function FindPage() {
  const { linkId } = useParams<{ linkId: string }>();
  const [data, setData] = useState<PublicCase | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tipOpen, setTipOpen] = useState(false);
  const [location, setLocation] = useState("");
  const [note, setNote] = useState("");
  const [sent, setSent] = useState(false);

  useEffect(() => {
    fetch(`/api/find/${linkId}`)
      .then(async (r) => {
        if (!r.ok) throw new Error((await r.json()).error ?? "not found");
        return r.json();
      })
      .then(setData)
      .catch((e) => setError(String(e.message)));
  }, [linkId]);

  async function onSubmitTip(e: React.FormEvent) {
    e.preventDefault();
    if (!data) return;
    await submitTip(data.caseDocId, location, note);
    setSent(true);
  }

  if (error) {
    return (
      <div className="max-w-md mx-auto mt-10">
        <div className="nb-card bg-[var(--warning)] p-5 font-bold text-center">
          {error}. This link may have expired.
        </div>
      </div>
    );
  }
  if (!data) return <p className="font-bold">Loading…</p>;

  return (
    <div className="max-w-md mx-auto space-y-5">
      <div className="nb-card p-5 space-y-3">
        <div className="nb-badge bg-[var(--danger)] text-white">Missing · {data.caseId}</div>
        {data.photoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={data.photoUrl} alt="" className="w-full max-h-72 object-cover border-[3px] border-ink" />
        )}
        <h1 className="text-3xl uppercase">{data.name || "Name not known"}</h1>
        <div className="font-semibold">
          {data.gender}
          {data.ageBand ? ` · age ${data.ageBand}` : ""}
          {data.lastSeenZone ? ` · last seen near ${data.lastSeenZone}` : ""}
        </div>
        {data.colourSignature.length > 0 && (
          <div className="flex gap-1">
            {data.colourSignature.map((hex) => (
              <span key={hex} className="h-8 w-8 border-[3px] border-ink" style={{ background: hex }} />
            ))}
          </div>
        )}
        {data.descriptionRaw && <p className="font-semibold">{data.descriptionRaw}</p>}
      </div>

      {sent ? (
        <div className="nb-card bg-[var(--success)] p-5 font-bold">
          Thank you. A volunteer has been notified and will verify the sighting.
        </div>
      ) : tipOpen ? (
        <form onSubmit={onSubmitTip} className="nb-card p-5 space-y-3">
          <input
            className="nb-input"
            placeholder="Where did you see them?"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
          />
          <textarea
            className="nb-textarea"
            placeholder="Any details (optional)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <button className="nb-btn nb-btn-primary w-full">Submit sighting</button>
        </form>
      ) : (
        <button onClick={() => setTipOpen(true)} className="nb-btn nb-btn-primary w-full text-base py-3">
          I think I found this person
        </button>
      )}
    </div>
  );
}
