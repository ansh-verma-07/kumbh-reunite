// Server-side auth middleware for Next.js route handlers.
// Verifies Firebase ID tokens from the Authorization header and extracts role.
// Role comes from a custom claim (production) or the X-Kr-Role header (demo).
// Set ENFORCE_AUTH=true in .env.local to reject unauthenticated requests.
import "server-only";
import { getAdminAuth } from "@/lib/firebase/admin";
import type { Role } from "@/lib/types";

export interface AuthContext {
  uid: string;
  role: Role;
}

const VALID_ROLES: Role[] = ["volunteer", "supervisor", "police"];

function isRole(v: string | null): v is Role {
  return VALID_ROLES.includes(v as Role);
}

/**
 * Extract and verify auth from a request.
 * Returns null when auth is missing/invalid AND ENFORCE_AUTH is not set
 * (demo-friendly). Throws 401 when ENFORCE_AUTH=true.
 */
export async function verifyRequest(req: Request): Promise<AuthContext | null> {
  const enforce = process.env.ENFORCE_AUTH === "true";
  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!token) {
    if (enforce) throw new AuthError(401, "Missing auth token");
    // Demo passthrough — treat as volunteer with no UID.
    const role = resolveRoleFromHeader(req);
    return { uid: "anon", role };
  }

  try {
    const decoded = await getAdminAuth().verifyIdToken(token);
    // Custom claim takes priority; fall back to X-Kr-Role header for demo.
    const claimRole = isRole(decoded.role as string) ? (decoded.role as Role) : null;
    const role = claimRole ?? resolveRoleFromHeader(req);
    return { uid: decoded.uid, role };
  } catch {
    if (enforce) throw new AuthError(401, "Invalid auth token");
    const role = resolveRoleFromHeader(req);
    return { uid: "anon", role };
  }
}

function resolveRoleFromHeader(req: Request): Role {
  const h = req.headers.get("X-Kr-Role");
  return isRole(h) ? h : "volunteer";
}

export class AuthError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}
