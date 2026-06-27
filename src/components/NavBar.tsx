"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { useTranslation, LANG_NAMES, type LangCode } from "@/components/LanguageProvider";
import type { Role } from "@/lib/types";

const LANG_ORDER: LangCode[] = ["en", "hi", "mr", "bn", "gu", "te", "ta", "kn", "bho", "mai"];

export function NavBar() {
  const pathname = usePathname();
  const { role, setRole } = useAuth();
  const { lang, setLang, t } = useTranslation();

  const links = [
    { href: "/", label: t("nav_dashboard"), roles: ["volunteer", "supervisor", "police"] },
    { href: "/new", label: t("nav_new_case"), roles: ["volunteer", "supervisor"] },
    { href: "/search", label: t("nav_search"), roles: ["volunteer", "supervisor", "police"] },
    { href: "/police", label: t("nav_command"), roles: ["supervisor", "police"] },
  ].filter((l) => l.roles.includes(role));

  return (
    <header className="border-b-[3px] border-ink bg-[var(--warning)]">
      <div className="max-w-5xl mx-auto px-4 h-16 flex items-center gap-3 flex-wrap">
        <Link
          href="/"
          className="font-extrabold text-lg tracking-tight bg-ink text-[var(--warning)] px-2 py-1 border-[3px] border-ink"
        >
          KUMBH&nbsp;REUNITE
        </Link>
        <nav className="flex gap-2 text-sm">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={
                "px-3 py-1.5 border-[3px] border-ink font-extrabold uppercase text-xs tracking-wide " +
                (pathname === l.href ? "bg-ink text-white" : "bg-white hover:bg-[var(--cyan)]")
              }
            >
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-3 flex-wrap">
          <label className="flex items-center gap-2">
            <span className="text-[10px] font-extrabold uppercase">🌐 {t("nav_lang")}</span>
            <select
              value={lang}
              onChange={(e) => setLang(e.target.value as LangCode)}
              className="border-[3px] border-ink bg-white px-2 py-1 text-xs font-extrabold"
            >
              {LANG_ORDER.map((code) => (
                <option key={code} value={code}>
                  {LANG_NAMES[code]}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2">
            <span className="text-[10px] font-extrabold uppercase">{t("nav_role")}</span>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as Role)}
              className="border-[3px] border-ink bg-white px-2 py-1 text-xs font-extrabold uppercase"
            >
              <option value="volunteer">{t("nav_volunteer")}</option>
              <option value="supervisor">{t("nav_supervisor")}</option>
              <option value="police">{t("nav_police")}</option>
            </select>
          </label>
        </div>
      </div>
    </header>
  );
}

export type { Role };
