import { ApiError, apiFetch } from "./api";
import { authHeader } from "./admin-auth";
import type {
  AdminDailyPoint,
  AdminMetrics,
  AdminOps,
  HealthReport,
  LoginResult,
} from "@/types/admin";

/** `to` is EXCLUSIVE. Both optional; the API defaults to the last 30 days. */
export interface MetricsRange {
  from?: Date;
  to?: Date;
}

function rangeQuery(range: MetricsRange): string {
  const params = new URLSearchParams();
  if (range.from) params.set("from", range.from.toISOString());
  if (range.to) params.set("to", range.to.toISOString());
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

/**
 * Admin reads are never cached and always bearer-authed.
 *
 * `no-store` rather than a short revalidate: these are operational numbers
 * someone is watching during an incident, and a cached ops snapshot is worse
 * than a slow one — it would show a resolved alarm as still firing, or hide a
 * new one.
 */
function adminFetch<T>(path: string): Promise<T> {
  return apiFetch<T>(path, {
    headers: authHeader(),
    cache: "no-store",
    timeout: 45_000,
  });
}

export function fetchAdminMetrics(range: MetricsRange = {}) {
  return adminFetch<AdminMetrics>(`/admin/metrics${rangeQuery(range)}`);
}

export function fetchAdminDaily(range: MetricsRange = {}) {
  return adminFetch<AdminDailyPoint[]>(
    `/admin/metrics/daily${rangeQuery(range)}`,
  );
}

export function fetchAdminOps() {
  return adminFetch<AdminOps>("/admin/ops");
}

/**
 * `GET /api/health` — public, no auth.
 *
 * ## The detail disappears exactly when you need it
 *
 * Healthy, this returns a genuinely rich report: per-chain block heights,
 * per-queue depths, the Circle wallet set id. It is wrapped by the global
 * `TransformInterceptor`, so the Terminus body arrives under `data` and
 * `apiFetch` unwraps it.
 *
 * Unhealthy, it returns **503 — and the per-indicator detail is gone.**
 * `@HealthCheck()` throws a `ServiceUnavailableException` carrying
 * `{ status, info, error, details }`, but `HttpExceptionFilter` is registered
 * with `app.useGlobalFilters` and rewrites *every* error into
 * `{ statusCode, message, timestamp, path }`, keeping only `message`. So when
 * something is actually down, this endpoint can say "something is down" and
 * nothing more.
 *
 * That is a one-line backend fix (exclude `/health` from the filter, or let
 * the filter pass a Terminus body through). Until it lands, the status page
 * has to degrade honestly rather than pretend it knows which check failed —
 * hence the discriminated result instead of a thrown error.
 */
export type HealthResult =
  | { ok: true; report: HealthReport }
  | { ok: false; report: null; message: string };

export async function fetchHealth(): Promise<HealthResult> {
  try {
    return { ok: true, report: await apiFetch<HealthReport>("/health", {
      cache: "no-store",
      timeout: 45_000,
    }) };
  } catch (err) {
    if (err instanceof ApiError && err.status === 503) {
      return {
        ok: false,
        report: null,
        message: err.message || "A health check is failing.",
      };
    }
    throw err;
  }
}

/** `POST /auth/login` — public. Returns the token and the user, incl. `role`. */
export function login(email: string, password: string) {
  return apiFetch<LoginResult>("/auth/login", {
    method: "POST",
    body: { email, password },
    timeout: 45_000,
  });
}
