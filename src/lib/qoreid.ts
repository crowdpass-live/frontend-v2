/**
 * QoreID Web SDK bridge — identity CAPTURE only. Browser only.
 *
 * Nothing here decides whether verification passed. The SDK's events say
 * the person finished (or abandoned) the selfie and NIN capture; the verdict
 * reaches the backend by signed webhook and is read back from
 * `GET /organizer/kyc`. Never unlock anything from what this module returns.
 *
 * `@qore-id/web-sdk` is a ~2KB wrapper that injects QoreID's hosted script
 * (`dashboard.qoreid.com/qoreid-sdk/qoreid.js`, ~4MB, FaceTec inside) and
 * renders in OUR page, not an iframe — so it uses this origin's camera
 * permission. It is imported on demand: nobody pays for it until they tap.
 */

/**
 * Off until a staging run confirms the three unknowns from the #34 spike:
 * QoreID accepts this origin, `liveness_nin` is enabled for web on our
 * account, and the webhook resolves. Until then the page offers the
 * BVN/NIN number form only.
 */
export const WEB_LIVENESS_ENABLED = process.env.NEXT_PUBLIC_QOREID_WEB_LIVENESS === "1";

export type CameraProblem = "denied" | "no-camera" | "insecure" | "unsupported" | "failed";

export const CAMERA_PROBLEM_COPY: Record<CameraProblem, string> = {
  // There is no openSettings() on the web, so say where the switch is.
  denied:
    "Camera access is blocked for this site. Allow it in your browser's site settings (the icon beside the address), then try again — or verify with your ID number instead.",
  "no-camera": "No camera was found on this device. Verify with your ID number instead, or use your phone.",
  insecure: "The camera only works over a secure (https) connection.",
  unsupported: "This browser can't use the camera. Verify with your ID number instead, or try another browser.",
  failed: "The camera couldn't start. Close other apps using it and try again.",
};

/**
 * Ask for the camera BEFORE minting a session. The session token is
 * single-use and `/kyc/session` allows five an hour, so a refusal discovered
 * inside the SDK would throw one away. The stream is closed straight away —
 * the SDK opens its own.
 */
export async function checkCamera(): Promise<CameraProblem | null> {
  if (!window.isSecureContext) return "insecure";
  if (!navigator.mediaDevices?.getUserMedia) return "unsupported";
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } });
    stream.getTracks().forEach((t) => t.stop());
    return null;
  } catch (err) {
    const name = err instanceof DOMException ? err.name : "";
    return name === "NotAllowedError" || name === "SecurityError"
      ? "denied"
      : name === "NotFoundError" || name === "OverconstrainedError"
        ? "no-camera"
        : "failed";
  }
}

export type CaptureEvent =
  /** Capture submitted. NOT a verdict — start polling. */
  | { type: "submitted" }
  /** The SDK reported a problem; the session is spent, nothing was decided. */
  | { type: "error"; message: string }
  /** Closed by the person before submitting. */
  | { type: "closed" };

/**
 * Launch the liveness capture. Resolves once the SDK has been asked to open;
 * outcomes arrive through `onEvent`, exactly once. Returns a cleanup that
 * detaches the listeners (and closes the SDK if it is still up).
 *
 * `applicant` must be the server's names (`GET /organizer/kyc` → applicant):
 * the backend re-matches the name the provider returns against the account,
 * so anything typed here could only cause a mismatch.
 *
 * `reference` goes in as `customerReference` — the wrapper refuses to start
 * without one. The backend also binds it at mint time and falls back to the
 * subject ref, so the echo is belt and braces, not the only correlation.
 */
export async function launchLiveness({
  token,
  reference,
  applicant,
  onEvent,
}: {
  token: string;
  reference: string;
  applicant: { firstName: string; lastName: string };
  onEvent: (e: CaptureEvent) => void;
}): Promise<() => void> {
  const { default: QoreID } = await import("@qore-id/web-sdk");

  let settled = false;
  const finish = (e: CaptureEvent) => {
    if (settled) return;
    settled = true;
    detach();
    onEvent(e);
  };
  const onSuccess = () => finish({ type: "submitted" });
  const onError = (payload: unknown) => finish({ type: "error", message: errorMessage(payload) });
  const onClose = () => finish({ type: "closed" });
  const detach = () => {
    QoreID.off("success", onSuccess);
    QoreID.off("error", onError);
    QoreID.off("close", onClose);
  };

  QoreID.on("success", onSuccess);
  QoreID.on("error", onError);
  QoreID.on("close", onClose);

  try {
    await QoreID.start({
      token,
      customerReference: reference,
      // The SDK's own spelling: lower-case `firstname`/`lastname`.
      applicantData: { firstname: applicant.firstName, lastname: applicant.lastName },
    });
  } catch (err) {
    // The hosted script failed to load (blocked, offline) or start() threw.
    finish({ type: "error", message: errorMessage(err) });
  }

  return () => {
    const open = !settled;
    settled = true;
    detach();
    if (open) QoreID.close();
  };
}

function errorMessage(payload: unknown): string {
  if (typeof payload === "string" && payload.trim()) return payload;
  if (payload && typeof payload === "object") {
    const m = (payload as { message?: unknown }).message;
    if (typeof m === "string" && m.trim()) return m;
  }
  return "The identity check couldn't be completed.";
}
