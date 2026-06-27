// Client-side helper: attaches Firebase ID token + role header to every
// API request so the server can verify identity and strip PII by role.
"use client";

import { getFirebaseAuth } from "@/lib/firebase/client";

export async function authHeaders(): Promise<HeadersInit> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  try {
    const auth = getFirebaseAuth();
    const user = auth.currentUser;
    if (user) {
      const token = await user.getIdToken();
      headers["Authorization"] = `Bearer ${token}`;
    }
    const role = typeof window !== "undefined"
      ? (localStorage.getItem("kr_role") ?? "volunteer")
      : "volunteer";
    headers["X-Kr-Role"] = role;
  } catch {
    // Auth unavailable — proceed without token (demo/offline mode).
  }
  return headers;
}

/** Authenticated fetch wrapper — use in place of raw fetch() for API calls. */
export async function apiFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const h = await authHeaders();
  return fetch(input, {
    ...init,
    headers: { ...h, ...(init.headers as Record<string, string> | undefined) },
  });
}
