import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { errorResponse, requireJson } from "@/lib/route-response";
import { expenseInput, type ExpenseAdded, type ExpenseList } from "@/lib/expenses";

/**
 * `GET|POST /api/admin/expenses` — the expenses sheet, through its Apps
 * Script web app (`scripts/apps-script/expenses.gs`).
 *
 * This handler IS the boundary. Everywhere else in `/admin` the API refuses
 * non-admins with a 403 and the shell's role check is a courtesy; the script
 * has no idea who anyone is. So:
 *
 * - **Admins only**, read from `/auth/me` per request (the JWT's role goes
 *   stale).
 * - **The secret stays here.** `EXPENSES_SCRIPT_URL` and
 *   `EXPENSES_SCRIPT_SECRET` are server-only; the script refuses any request
 *   without the secret. Both unset → 503, and the page says so.
 * - **Checked before forwarding**, with the same schema the form uses, so the
 *   script receives exactly the fields it expects.
 * - **POST is JSON and same-origin only** — a foreign page can't make an
 *   admin's browser append a row.
 *
 * Apps Script answers every request with 200 (`doPost` can't set a status),
 * so the script reports failure as `{ ok: false, error }` and it's mapped to
 * a 502 here.
 */

const SCRIPT_TIMEOUT_MS = 30_000;

type ScriptReply<T> = ({ ok: true } & T) | { ok: false; error?: string };

async function gate() {
  const user = await getCurrentUser().catch(() => undefined);
  if (user === undefined) return errorResponse(503, "Couldn't check your session. Please try again.");
  if (!user) return errorResponse(401, "Sign in to use the expenses tracker.");
  if (user.role !== "ADMIN") return errorResponse(403, "Only admins can use the expenses tracker.");
  return { user };
}

async function callScript<T>(payload: Record<string, unknown>) {
  const url = process.env.EXPENSES_SCRIPT_URL;
  const secret = process.env.EXPENSES_SCRIPT_SECRET;
  if (!url || !secret) {
    return errorResponse(503, "The expenses sheet isn't connected on this deployment yet.");
  }

  let res: Response;
  try {
    // A web app POST answers with a 302 to googleusercontent.com, which fetch
    // follows as a GET — that is the documented way to read the reply.
    res = await fetch(url, {
      method: "POST",
      // text/plain, as the script reads `e.postData.contents` either way.
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ ...payload, secret }),
      redirect: "follow",
      cache: "no-store",
      signal: AbortSignal.timeout(SCRIPT_TIMEOUT_MS),
    });
  } catch {
    return errorResponse(504, "The expenses sheet didn't respond. Please try again.");
  }

  const text = await res.text().catch(() => "");
  let reply: ScriptReply<T> | null = null;
  try {
    reply = JSON.parse(text) as ScriptReply<T>;
  } catch {
    // An HTML page: usually a deployment that isn't shared with "Anyone",
    // which bounces to a Google sign-in. The detail is for our logs.
  }

  if (!res.ok || !reply) {
    console.error("Expenses script failed", res.status, text.slice(0, 300));
    return errorResponse(502, "The expenses sheet couldn't be reached. Please try again.");
  }
  if (!reply.ok) {
    console.error("Expenses script refused", reply.error);
    // The script's own messages are written for us, not for leaking: the
    // only one an admin can act on is the generic retry.
    return errorResponse(502, "The expenses sheet couldn't save that. Please try again.");
  }
  return NextResponse.json({ ...reply, ok: undefined } as T);
}

export async function GET() {
  const gated = await gate();
  if (gated instanceof NextResponse) return gated;
  return callScript<ExpenseList>({ action: "list" });
}

export async function POST(request: NextRequest) {
  if (request.headers.get("origin") !== request.nextUrl.origin) {
    return errorResponse(403, "Cross-origin request refused.");
  }
  const notJson = requireJson(request);
  if (notJson) return notJson;

  const gated = await gate();
  if (gated instanceof NextResponse) return gated;

  const parsed = expenseInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return errorResponse(
      400,
      parsed.error.issues[0]?.message ?? "Check the expense details.",
      parsed.error.issues.map((i) => i.message),
    );
  }

  return callScript<ExpenseAdded>({
    action: "add",
    expense: parsed.data,
    // Not a sheet column; the script logs it in a cell note on the row, so
    // the sheet can always say who entered what.
    enteredBy: gated.user.email || gated.user.id,
  });
}
