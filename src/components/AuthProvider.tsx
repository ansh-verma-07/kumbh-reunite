"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged, signInAnonymously, type User } from "firebase/auth";
import { getFirebaseAuth } from "@/lib/firebase/client";
import type { Role } from "@/lib/types";

interface AuthState {
  user: User | null;
  role: Role;
  setRole: (r: Role) => void;
  loading: boolean;
}

const AuthContext = createContext<AuthState>({
  user: null,
  role: "volunteer",
  setRole: () => {},
  loading: true,
});

export function useAuth() {
  return useContext(AuthContext);
}

// NOTE: roles here gate the UI only. Because case data flows through the
// Admin SDK (server routes), this is presentation-level access, not a security
// boundary. Production would enforce roles via Firebase custom claims + rules.
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRoleState] = useState<Role>("volunteer");
  const [loading, setLoading] = useState(true);

  function setRole(r: Role) {
    setRoleState(r);
    if (typeof window !== "undefined") localStorage.setItem("kr_role", r);
  }

  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("kr_role") as Role | null;
      if (saved) setRoleState(saved);
    }
    const auth = getFirebaseAuth();
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) {
        try {
          await signInAnonymously(auth);
        } catch {
          // Anonymous auth may be disabled — the app still works (data is
          // server-side); just proceed without a Firebase user.
          setLoading(false);
        }
        return;
      }
      setUser(u);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  return (
    <AuthContext.Provider value={{ user, role, setRole, loading }}>
      {children}
    </AuthContext.Provider>
  );
}
