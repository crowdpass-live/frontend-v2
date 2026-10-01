import { NextResponse, type NextRequest } from "next/server";
import { ApiError } from "./api";

/**
 * Shared plumbing for the session route handlers: errors in the backend's
 * own shape (`{ statusCode, message, errors? }`), so the browser's
 * `ApiError` handling reads them the same as a direct API call.
 */
export function errorResponse(status: number, message: string, errors?: unknown) {
  return NextResponse.json(
    { statusCode: status, message, ...(errors ? { errors } : null) },
    { status },
  );
}

/**
 * A cross-site HTML form cannot send JSON without a CORS preflight, which
 * these handlers never answer — so requiring JSON rules out CSRF on the
 * routes that set a session.
 */
export function requireJson(request: NextRequest) {
  return request.headers.get("content-type")?.includes("application/json")
    ? null
    : errorResponse(415, "Expected a JSON body.");
}

/** An API failure, passed through with its status; status 0 = gateway. */
export function fromApiError(err: ApiError) {
  const body = err.body as { errors?: unknown } | null;
  return errorResponse(err.status || 504, err.message, body?.errors);
}
