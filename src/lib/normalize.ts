import type {
  ApiOrganizerProfile,
  ApiWallet,
  UserRole,
} from "@/types/api";

/**
 * The signed-in user as the app reasons about them. Ported from
 * `v2-mobile/src/api/normalize.js` so web and mobile agree on what "is an
 * organizer" means.
 *
 * Pure and dependency-free. A login response carries the bare user row; `GET
 * /auth/me` adds `organizerProfile` and `wallets`. Both go through
 * `normalizeUser`, so a caller never has to know which one it was handed —
 * fields only `/auth/me` carries simply come back empty from a login.
 */
export interface SessionUser {
  id: string;
  /** "" when the account has none (WhatsApp-first). */
  email: string;
  firstName: string;
  lastName: string;
  /** Display name: the real name, else the email's local part, else "Guest". */
  name: string;
  phone: string;
  role: UserRole;
  /**
   * Gates `(host)`. NOT the door gate — check-in delegates are plain BUYERs,
   * and `(door)` is decided by `my-checkin-events` returning rows.
   */
  isOrganizer: boolean;
  organizerProfile: ApiOrganizerProfile | null;
  wallets: ApiWallet[];
  createdAt: string | null;
}

type Loose = Record<string, unknown>;

function isObject(v: unknown): v is Loose {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

function str(...candidates: unknown[]): string {
  for (const c of candidates) if (typeof c === "string" && c) return c;
  return "";
}

/**
 * The access token from a register/login response, under any of the keys
 * the backend has used, enveloped or not. Null when there is none — which is
 * normal after `POST /auth/register` until the email is verified.
 */
export function extractToken(data: unknown): string | null {
  if (!isObject(data)) return null;
  const inner = isObject(data.data) ? data.data : {};
  const token = str(
    data.accessToken,
    data.access_token,
    data.token,
    data.jwt,
    inner.accessToken,
    inner.access_token,
    inner.token,
  );
  return token || null;
}

/**
 * A `SessionUser` from a login response, a `/auth/me` response, or either
 * still inside its `{ data }` envelope. Null when there is no user in it.
 */
export function normalizeUser(raw: unknown): SessionUser | null {
  if (!isObject(raw)) return null;
  const envelope = isObject(raw.data) ? raw.data : raw;
  const u = isObject(envelope.user) ? envelope.user : envelope;
  const id = str(u.id, u._id, u.userId);
  if (!id && !str(u.email)) return null;

  const email = str(u.email);
  const firstName = str(u.firstName, u.first_name);
  const lastName = str(u.lastName, u.last_name);
  const name =
    [firstName, lastName].filter(Boolean).join(" ") ||
    str(u.name) ||
    (email ? email.split("@")[0] : "Guest");

  const role = (str(u.role) || (u.isOrganizer ? "ORGANIZER" : "BUYER")) as UserRole;
  const organizerProfile = isObject(u.organizerProfile)
    ? (u.organizerProfile as unknown as ApiOrganizerProfile)
    : null;

  return {
    id,
    email,
    firstName,
    lastName,
    name,
    phone: str(u.phone),
    role,
    // An organizer profile counts even before the role catches up, as on
    // mobile: becoming a host creates the profile and the role together, but
    // a stale token can still say BUYER.
    isOrganizer: /organizer|admin/i.test(role) || !!organizerProfile,
    organizerProfile,
    wallets: Array.isArray(u.wallets) ? (u.wallets as ApiWallet[]) : [],
    createdAt: str(u.createdAt, u.created_at) || null,
  };
}
