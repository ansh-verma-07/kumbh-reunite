"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import type { Role } from "@/lib/types";

export function NavBar() {
  const pathname = usePathname();
  const { role, setRole } = useAuth();

  const links = [
    { href: "/", label: "Dashboard", roles: ["volunteer", "supervisor", "police"] },
    { href: "/new", label: "New case", roles: ["volunteer", "supervisor"] },
    { href: "/search", label: "Search", roles: ["volunteer", "supervisor", "police"] },
    { href: "/police", label: "Command", roles: ["supervisor", "police"] },
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
        <label className="ml-auto flex items-center gap-2">
          <span className="text-[10px] font-extrabold uppercase">Role</span>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as Role)}
            className="border-[3px] border-ink bg-white px-2 py-1 text-xs font-extrabold uppercase"
          >
            <option value="volunteer">Volunteer</option>
            <option value="supervisor">Supervisor</option>
            <option value="police">Police</option>
          </select>
        </label>
      </div>
    </header>
  );
}

export type { Role };
