import type { ApiEnvelope } from "@/types/api";

/**
 * Base URL for the CrowdPass backend, including the `/api` prefix the
 * backend sets globally (`app.setGlobalPrefix('api')`).
 *
 * Public because the checkout form calls the API straight from the browser —
 * there is no BFF layer, and adding one would just proxy a public endpoint.
 */
export const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ?? "https://backend-v2-gwuz.onrender.com/api";

/**
 * A non-2xx response from the backend, carrying enough to render something
 * useful to the buyer.
 *
 * The backend's `HttpExceptionFilter` returns `{ success: false, message,
 * statusCode }`, and `message` is the string a Nigerian buyer actually needs
 * to see — "Only 3 ticket(s) remaining", "Per-buyer limit is 4 for this
 * ticket type". Surfacing a generic "Something went wrong" instead of that
 * message is how a buyer ends up retrying a purchase that can never succeed.
 */
export class ApiError extends Error {
  readonly status: number;
  readonly body: unknown;

  constructor(status: number, message: string, body?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }

  /** 4xx means the buyer can fix it; 5xx and network mean try again. */
  get isRetryable(): boolean {
    return this.status === 0 || this.status >= 500;
  }

  /**
   * True when this is a validation rejection naming `field`. Used to detect
   * a backend that predates a DTO field the client already sends.
   */
  rejectedProperty(field: string): boolean {
    if (this.status !== 400) return false;
    const body = this.body as { errors?: unknown; message?: unknown } | null;
    const list = [body?.errors, body?.message].find(Array.isArray) as
      | string[]
      | undefined;
    return !!list?.some(
      (m) => typeof m === "string" && m.includes(field),
    );
  }
}

/**
 * Pulls the human message out of whatever shape the error body took.
 *
 * The backend's `HttpExceptionFilter` puts validation detail in `errors[]`
 * and a bare `"Validation failed"` in `message`, so `errors` is read first —
 * "buyerPhone must be a valid phone number" is actionable, "Validation
 * failed" is not.
 */
function messageFrom(body: unknown, fallback: string): string {
  if (typeof body === "string" && body.trim()) return body;
  if (body && typeof body === "object") {
    const errs = (body as { errors?: unknown }).errors;
    if (Array.isArray(errs) && errs.length && typeof errs[0] === "string") {
      return errs.join(", ");
    }
    const m = (body as { message?: unknown }).message;
    // Older Nest defaults return the constraint list as `message`.
    if (Array.isArray(m) && m.length && typeof m[0] === "string") {
      return m.join(", ");
    }
    if (typeof m === "string" && m.trim()) return m;
    const e = (body as { error?: unknown }).error;
    if (typeof e === "string" && e.trim()) return e;
  }
  return fallback;
}

export interface ApiFetchOptions extends Omit<RequestInit, "body"> {
  body?: unknown;
  /** Milliseconds before the request is aborted. Default 20s. */
  timeout?: number;
  /** Passed through to Next's extended fetch for server-side caching. */
  next?: { revalidate?: number; tags?: string[] };
}

/**
 * Thin fetch wrapper that unwraps the backend's `{ success, data }` envelope
 * and turns failures into `ApiError`.
 *
 * Timeouts are explicit because this runs on Nigerian mobile networks against
 * a Render free-tier backend that cold-starts: the default browser timeout is
 * minutes, which reads to a buyer as a hung page. Callers that wait on a
 * third party (the purchase call initializes a gateway transaction) pass a
 * longer one.
 */
export async function apiFetch<T>(
  path: string,
  options: ApiFetchOptions = {},
): Promise<T> {
  const { body, timeout = 20_000, headers, ...rest } = options;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      ...rest,
      headers: {
        Accept: "application/json",
        ...(body !== undefined ? { "Content-Type": "application/json" } : null),
        ...headers,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
  } catch (err) {
    // Status 0 == never reached the server, so it says nothing about whether
    // the work happened. Callers treat it as retryable.
    const aborted = err instanceof Error && err.name === "AbortError";
    throw new ApiError(
      0,
      aborted
        ? "The server took too long to respond. Please check your connection and try again."
        : "Could not reach CrowdPass. Please check your connection and try again.",
      err,
    );
  } finally {
    clearTimeout(timer);
  }

  const text = await res.text();
  let parsed: unknown = undefined;
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = text;
    }
  }

  if (!res.ok) {
    throw new ApiError(res.status, messageFrom(parsed, res.statusText), parsed);
  }

  // Unwrap the envelope. Routes marked @SkipTransform return raw payloads, so
  // fall through to the parsed body when there is no envelope to unwrap.
  if (
    parsed &&
    typeof parsed === "object" &&
    "success" in parsed &&
    "data" in parsed
  ) {
    return (parsed as ApiEnvelope<T>).data;
  }
  return parsed as T;
}
