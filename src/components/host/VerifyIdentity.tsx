"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ApiError, apiFetch } from "@/lib/api";
import {
  CAMERA_PROBLEM_COPY,
  WEB_LIVENESS_ENABLED,
  checkCamera,
  launchLiveness,
  type CameraProblem,
} from "@/lib/qoreid";
import { Celebration } from "@/components/Celebration";
import { Mascot } from "@/components/Mascot";
import { TextField } from "@/components/TextField";
import { CameraIcon, CheckIcon, ExternalLinkIcon, LockIcon, PersonIcon } from "@/components/icons";
import { Button, ButtonLink, Container, ErrorNote, Spinner, cx } from "@/components/ui";
import type { ApiKycStatus, ApiKycSession, ApiKycVerifyResult, KycIdType } from "@/types/api";

const ID_HELP: Record<KycIdType, string> = {
  BVN: "Dial *565*0# from the number registered with your bank to see it.",
  NIN: "Dial *346# from your registered number, or check your NIN slip.",
};

/** Every ID type in the country registry is 11 digits today. */
const ID_LENGTH = 11;

/** What to do about a counted failure, in the host's words, not the API's. */
const OUTCOME_HELP: Record<string, string> = {
  NAME_MISMATCH:
    "The name on this ID doesn't match your profile name. Change your name to match the ID exactly, then try again.",
  NOT_FOUND: "We couldn't find that number. Check the digits and try again.",
  LIVENESS_FAILED:
    "Try again facing a light, with your whole face in the frame. Your name is fine — don't change it.",
  DUPLICATE_IDENTITY:
    "This ID is already verified on another CrowdPass account. Contact support if that account is yours.",
};

/** History outcomes that mean a check resolved and did not pass. */
const RESOLVED_FAILURES = ["NAME_MISMATCH", "NOT_FOUND", "LIVENESS_FAILED", "DUPLICATE_IDENTITY"];

/**
 * An SDK session (this page's selfie check, or one from the app) is resolved
 * by webhook. Poll our own API while it is fresh — 3s ticks, 90s in all, as
 * on mobile — then stop asking: past that it is "taking longer", not broken.
 */
const POLL_MS = 3_000;
const POLL_WINDOW_MS = 90_000;

type Failure = { outcome: string; reason: string; attemptsRemaining: number };

/** What is being waited on: a capture made here, or one found on load. */
type Watch = { origin: "here" | "earlier"; deadline: number };

type Method = "selfie" | "number";

/** The backend's reasons come without a full stop; we follow them with more. */
function sentence(text: string): string {
  const t = text.trim();
  return /[.!?]$/.test(t) ? t : `${t}.`;
}

/**
 * Organizer identity verification. Ports `VerifyIdentityScreen.js`, both
 * halves, as mobile has them:
 *
 * - **Selfie + NIN** (#34, behind `NEXT_PUBLIC_QOREID_WEB_LIVENESS`):
 *   `POST /organizer/kyc/session` with an EMPTY body mints a `liveness_nin`
 *   session, the QoreID Web SDK captures the selfie and NIN in its own UI,
 *   and the verdict arrives by webhook — so this page polls
 *   `GET /organizer/kyc`. The SDK's "submitted" event decides nothing.
 * - **ID number** (#33): BVN or NIN on `POST /organizer/kyc/verify`, with
 *   the NIBSS iGree consent round trip.
 *
 * `/verify` answers synchronously. The one detour is `CONSENT_REQUIRED`:
 * NIBSS want the BVN holder to approve the lookup on their own page, which
 * has no way back to us, so the link opens in a new tab and this page waits
 * with the number still in memory. "I've approved it" resubmits the
 * IDENTICAL body. That retry is never automatic — the route allows five
 * calls an hour per IP, consent or not, and a focus-triggered loop would
 * spend them.
 *
 * The name is never sent: the backend matches the PROFILE name, so a
 * placeholder name blocks the form instead of burning one of five attempts.
 */
export function VerifyIdentity({
  initial,
  user,
}: {
  initial: ApiKycStatus;
  user: { email: string; firstName: string; lastName: string; provisionalName: boolean };
}) {
  const router = useRouter();
  const [kyc, setKyc] = useState(initial);
  const [idType, setIdType] = useState<KycIdType>(initial.availableIdTypes[0] ?? "BVN");
  const [idNumber, setIdNumber] = useState("");
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [failure, setFailure] = useState<Failure | null>(null);
  /** Set while NIBSS wait on the holder; holds the body to resubmit. */
  const [consent, setConsent] = useState<{
    url: string;
    idType: KycIdType;
    idNumber: string;
    idLast4: string;
    opened: boolean;
    /** Resubmitted at least once and NIBSS still had no approval. */
    stillWaiting: boolean;
  } | null>(null);
  const [justVerified, setJustVerified] = useState(false);

  const reload = useCallback(async () => {
    try {
      const next = await apiFetch<ApiKycStatus>("/organizer/kyc", { auth: true });
      setKyc(next);
      return next;
    } catch {
      return null;
    }
  }, []);

  // --- Waiting on a webhook ----------------------------------------------------
  const pending = kyc.status === "PENDING" ? kyc.pendingVerification : null;
  // A session found on load resumes its own 90s rather than starting a fresh
  // one, so a stranded session from yesterday doesn't spin on every visit.
  const [watch, setWatch] = useState<Watch | null>(() => {
    const p = initial.status === "PENDING" ? initial.pendingVerification : null;
    const deadline = p ? new Date(p.startedAt).getTime() + POLL_WINDOW_MS : 0;
    return p && deadline > Date.now() ? { origin: "earlier", deadline } : null;
  });
  /** A capture made here outlived the poll window. */
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    if (!watch) return;
    let timer: ReturnType<typeof setTimeout>;
    let alive = true;
    const tick = async () => {
      const next = await reload();
      if (!alive) return;
      if (next && (!next.pendingVerification || next.status !== "PENDING")) {
        setWatch(null);
        if (next.status === "VERIFIED") {
          setJustVerified(true);
          router.refresh();
          return;
        }
        // Resolved and didn't pass, with attempts still left: a retry, not
        // a rejection. Only said for a check made here — an old one from
        // the app is not news.
        const latest = next.history[0];
        if (watch.origin === "here" && latest && RESOLVED_FAILURES.includes(latest.outcome)) {
          setFailure({
            outcome: latest.outcome,
            reason: latest.failureReason ?? "Verification did not pass",
            attemptsRemaining: next.attemptsRemaining,
          });
        }
        return;
      }
      if (Date.now() >= watch.deadline) {
        setWatch(null);
        if (watch.origin === "here") setSlow(true);
        return;
      }
      timer = setTimeout(tick, POLL_MS);
    };
    timer = setTimeout(tick, POLL_MS);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [watch, reload, router]);

  // --- Selfie + NIN (QoreID Web SDK) -------------------------------------------
  const [method, setMethod] = useState<Method>(WEB_LIVENESS_ENABLED ? "selfie" : "number");
  const [capture, setCapture] = useState<"idle" | "camera" | "starting" | "open">("idle");
  const [cameraProblem, setCameraProblem] = useState<CameraProblem | null>(null);
  const [captureNote, setCaptureNote] = useState<string | null>(null);
  const detachSdk = useRef<(() => void) | null>(null);
  /**
   * A session closed or errored here stays PENDING on the server (its
   * webhook never comes). It isn't "a check you started earlier" — the
   * note already said what happened — so the banner skips it.
   */
  const [abandoned, setAbandoned] = useState<string | null>(null);
  useEffect(() => () => detachSdk.current?.(), []);

  // Results arrive after a background poll or an SDK event, often while the
  // host is scrolled to the top on a phone: bring them into view.
  const outcomeRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (failure || captureNote || cameraProblem) {
      outcomeRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [failure, captureNote, cameraProblem]);

  async function startSelfie() {
    setError(null);
    setFailure(null);
    setCaptureNote(null);
    setCameraProblem(null);
    setSlow(false);

    // Camera first, session second: a token is single-use and minting is
    // capped, so a refusal must cost nothing.
    setCapture("camera");
    const problem = await checkCamera();
    if (problem) {
      setCameraProblem(problem);
      setCapture("idle");
      return;
    }

    setCapture("starting");
    let session: ApiKycSession;
    try {
      // EMPTY body selects liveness. Nothing else — forbidNonWhitelisted.
      session = await apiFetch<ApiKycSession>("/organizer/kyc/session", {
        method: "POST",
        auth: true,
        body: {},
        timeout: 60_000,
      });
    } catch (err) {
      setCapture("idle");
      setError(
        err instanceof ApiError
          ? err.status === 503
            ? "The verification service is unavailable right now. Nothing was used — please try again shortly."
            : err.message
          : "Couldn't start the check. Please try again.",
      );
      // 403/409/429 change what this page should offer.
      if (err instanceof ApiError && [403, 409, 429].includes(err.status)) await reload();
      return;
    }

    try {
      detachSdk.current = await launchLiveness({
        token: session.sdkSessionToken,
        reference: session.reference,
        applicant: kyc.applicant,
        onEvent: (e) => {
          detachSdk.current = null;
          setCapture("idle");
          if (e.type === "submitted") {
            setWatch({ origin: "here", deadline: Date.now() + POLL_WINDOW_MS });
            return;
          }
          // The session is spent either way, but nothing was decided and
          // no attempt was counted.
          setAbandoned(session.reference);
          setCaptureNote(
            e.type === "closed"
              ? "You closed the check before finishing. Nothing was decided and no attempt was used."
              : `${sentence(e.message)} Nothing was decided and no attempt was used.`,
          );
          void reload();
        },
      });
      setCapture((c) => (c === "starting" ? "open" : c));
    } catch {
      setCapture("idle");
      setCaptureNote("The QoreID window couldn't load. Check your connection, reload the page and try again.");
    }
  }

  // --- Submit -----------------------------------------------------------------
  async function submit(body: { idType: KycIdType; idNumber: string }) {
    setBusy(true);
    setError(null);
    setFailure(null);
    try {
      const res = await apiFetch<ApiKycVerifyResult>("/organizer/kyc/verify", {
        method: "POST",
        auth: true,
        body,
        // QoreID round-trips through NIBSS: slow by nature.
        timeout: 60_000,
      });

      if (res.outcome === "CONSENT_REQUIRED") {
        setConsent((c) => ({
          url: res.consentUrl,
          ...body,
          idLast4: res.idLast4,
          opened: c?.opened ?? false,
          stillWaiting: !!c,
        }));
        return;
      }

      setConsent(null);
      setIdNumber("");
      setTouched(false);
      if (res.outcome === "VERIFIED") {
        setJustVerified(true);
        await reload();
        // The dashboard checklist and the locked name read /auth/me.
        router.refresh();
        return;
      }
      setFailure({ outcome: res.outcome, reason: res.reason, attemptsRemaining: res.attemptsRemaining });
      await reload();
    } catch (err) {
      // 409 already verified, 403 rejected, 429 out of attempts: each changes
      // what this page should offer, so re-read before showing the message.
      const status = err instanceof ApiError ? err.status : 0;
      setError(
        err instanceof ApiError
          ? status === 429
            ? `${err.message} Nothing was checked, so no attempt was used.`
            : err.message
          : "Couldn't reach verification. Please try again.",
      );
      if (status === 409 || status === 403 || status === 429) {
        const next = await reload();
        if (next?.status === "VERIFIED") {
          setConsent(null);
          setError(null);
          router.refresh();
        }
      }
    } finally {
      setBusy(false);
    }
  }

  // --- Terminal states ----------------------------------------------------------
  if (kyc.status === "VERIFIED") {
    return (
      <Container className="relative flex flex-col items-center gap-5 py-14 text-center">
        {justVerified ? <Celebration seed={7} /> : null}
        <Mascot pose="success" height={130} />
        <div className="flex flex-col gap-2">
          <h1 className="text-title font-bold text-text">
            {justVerified ? "You're verified." : "Your identity is verified."}
          </h1>
          <p className="text-body text-text-dim">
            {kyc.idType ?? "ID"}
            {kyc.idLast4 ? ` ending ${kyc.idLast4}` : ""} · matched to{" "}
            {kyc.applicant.firstName} {kyc.applicant.lastName}
          </p>
        </div>
        <NextStepBank />
        <p className="flex items-start gap-2 text-left text-helper text-text-faint">
          <LockIcon className="mt-0.5 shrink-0" />
          Your name is now locked to your ID, so it can&apos;t be edited on your
          account. Contact support if it genuinely needs to change.
        </p>
        <ButtonLink href="/host" variant="secondary" className="w-full sm:w-auto">
          Back to your dashboard
        </ButtonLink>
      </Container>
    );
  }

  if (kyc.status === "REJECTED") {
    return (
      <Container className="flex flex-col items-center gap-5 py-14 text-center">
        <Mascot pose="error" height={120} />
        <h1 className="text-title font-bold text-text">Verification is blocked</h1>
        <p className="text-body text-text-dim">
          {sentence(kyc.rejectionReason ?? "Too many checks failed on this account")} Only
          CrowdPass support can reopen it — trying again here won&apos;t work.
        </p>
        <p className="rounded-card border border-border bg-surface px-4 py-3 text-left text-label text-text-dim">
          Crypto-paid events keep working in the meantime. Only card and
          bank-transfer sales need verification.
        </p>
        <ButtonLink href="/host" variant="secondary" className="w-full sm:w-auto">
          Back to your dashboard
        </ButtonLink>
      </Container>
    );
  }

  // --- Consent detour ------------------------------------------------------------
  if (consent) {
    return (
      <Container className="flex flex-col gap-6 py-10">
        <Header
          title="Approve the check with NIBSS"
          lead={`Your bank needs your OK before we can look up the ${consent.idType} ending ${consent.idLast4}. This step is free and doesn't use an attempt.`}
        />
        <ol className="flex flex-col divide-y divide-border rounded-card border border-border bg-surface">
          <Step n={1} done={consent.opened} title="Open the NIBSS consent page">
            It opens in a new tab. Approve the request there — you may be asked
            for a code sent to the phone number linked to your {consent.idType}.
          </Step>
          <Step n={2} done={false} title="Come back to this tab">
            Then tap <strong className="text-text">I&apos;ve approved it</strong> to
            finish verification. Keep this tab open — we hold the number here,
            not on our servers.
          </Step>
        </ol>

        {consent.stillWaiting ? (
          <p role="status" className="rounded-control border border-warn/40 bg-warn/10 px-4 py-3 text-label text-warn">
            NIBSS hasn&apos;t recorded your approval yet. Finish on the consent page —
            make sure you see a confirmation there — then try again.
          </p>
        ) : null}
        <ErrorNote>{error}</ErrorNote>

        <div className="flex flex-col gap-3 sm:flex-row">
          <a
            href={consent.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setConsent((c) => (c ? { ...c, opened: true } : c))}
            className={cx(
              "inline-flex h-14 items-center justify-center gap-2 rounded-control px-6 text-body font-bold transition-colors",
              consent.opened
                ? "border border-border bg-surface text-text hover:bg-surface-strong"
                : "bg-accent text-ink hover:bg-accent-hi",
            )}
          >
            {consent.opened ? "Open it again" : "Open consent page"}
            <ExternalLinkIcon />
          </a>
          <Button
            type="button"
            variant={consent.opened ? "primary" : "secondary"}
            disabled={busy}
            onClick={() => submit({ idType: consent.idType, idNumber: consent.idNumber })}
            className="w-full sm:w-auto"
          >
            {busy ? <Spinner /> : null}
            {busy ? "Checking…" : "I've approved it"}
          </Button>
        </div>
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            setConsent(null);
            setError(null);
          }}
          className="inline-flex min-h-10 items-center self-start text-label text-text-dim underline-offset-2 hover:text-text hover:underline"
        >
          Use a different ID
        </button>
      </Container>
    );
  }

  // --- The form --------------------------------------------------------------------
  const attempts = kyc.attemptsRemaining;
  const outOfAttempts = attempts <= 0;
  const blockedByName = user.provisionalName;
  const numberError =
    idNumber.length !== ID_LENGTH ? `Enter all ${ID_LENGTH} digits of your ${idType}` : undefined;
  /** Anything in flight: a submit, a capture, or a webhook being waited on. */
  const inFlight = busy || capture !== "idle" || !!watch;
  const canSubmit = !inFlight && !blockedByName && !outOfAttempts;
  const fullName = `${kyc.applicant.firstName} ${kyc.applicant.lastName}`.trim();

  const status = watch
    ? watch.origin === "here"
      ? "QoreID is checking your selfie and NIN. This usually takes a few seconds — the page updates by itself."
      : "A check you started earlier is finishing. This page updates by itself."
    : slow
      ? "Your check is taking longer than usual. The result is saved to your account and will show here when it lands — there's no need to do it again."
      : pending && pending.reference !== abandoned
        ? "A check you started earlier is still waiting for a result. You can verify again instead — it didn't use an attempt."
        : null;

  const outcome = (
    <div ref={outcomeRef} className="flex flex-col gap-5">
      {cameraProblem ? (
        <div role="alert" className="flex items-start gap-3 rounded-control border border-warn/40 bg-warn/10 px-4 py-3">
          <CameraIcon className="mt-0.5 shrink-0 text-warn" />
          <p className="text-label text-warn">{CAMERA_PROBLEM_COPY[cameraProblem]}</p>
        </div>
      ) : null}
      {captureNote ? (
        <p role="status" className="rounded-control border border-border bg-surface px-4 py-3 text-label text-text-dim">
          {captureNote}
        </p>
      ) : null}
      {failure ? (
        <div role="alert" className="flex flex-col gap-1 rounded-control border border-danger/40 bg-danger/10 px-4 py-3">
          <p className="text-label font-bold text-danger">
            {failure.outcome === "LIVENESS_FAILED" ? "The selfie check didn't pass." : "That didn't match."}
          </p>
          <p className="text-label text-text-dim">{OUTCOME_HELP[failure.outcome] ?? sentence(failure.reason)}</p>
          {failure.outcome === "NAME_MISMATCH" ? (
            <Link href="/account?next=/host/verify" className="inline-flex min-h-10 items-center self-start text-label font-bold text-accent hover:text-accent-hi">
              Edit your name
            </Link>
          ) : null}
        </div>
      ) : null}
      <ErrorNote>{error}</ErrorNote>
      {/* Before the button, not after a failure: there is a hard daily cap. */}
      <p className={cx("text-label", attempts <= 2 ? "text-warn" : "text-text-dim")}>
        {outOfAttempts
          ? "You've used today's attempts. You can try again in 24 hours."
          : `${attempts} ${attempts === 1 ? "attempt" : "attempts"} left today.` +
            (method === "number" ? " Approving with your bank doesn't use one." : " Closing the check early doesn't use one.")}
      </p>
    </div>
  );

  return (
    <Container className="flex flex-col gap-6 py-10">
      <Header
        title="Verify your identity"
        lead="A one-time check so you can take card and bank-transfer payments. It takes about a minute. We only keep the last four digits of your ID number."
      />

      {status ? (
        <div
          role="status"
          className="flex items-start gap-3 rounded-card border border-border bg-surface px-4 py-3"
        >
          {watch ? <Spinner className="mt-1 shrink-0 text-accent" /> : <LockIcon className="mt-0.5 shrink-0 text-text-faint" />}
          <p className="text-label text-text-dim">{status}</p>
        </div>
      ) : null}

      {/* Step 1 — the name. The single biggest cause of a wasted attempt. */}
      <section
        aria-labelledby="kyc-name"
        className={cx(
          "flex flex-col gap-3 rounded-card border p-4",
          blockedByName ? "border-warn/40 bg-warn/10" : "border-border bg-surface",
        )}
      >
        <div className="flex items-start gap-3">
          <PersonIcon className={cx("mt-0.5 shrink-0", blockedByName ? "text-warn" : "text-text-faint")} />
          <div className="min-w-0 flex-1">
            <h2 id="kyc-name" className="text-label font-bold text-text">
              {blockedByName ? "First, add your real name" : "We'll match this name"}
            </h2>
            {blockedByName ? (
              <p className="mt-1 text-label text-text-dim">
                Your profile name, <strong className="text-text">{fullName}</strong>, is
                the one we made from your email. We check your profile name against
                your ID, so it has to be exactly as it appears there.
              </p>
            ) : (
              <p className="mt-1 text-label text-text-dim">
                <strong className="break-words text-text">{fullName}</strong> — it must
                match your ID exactly. A mismatch uses up an attempt.
              </p>
            )}
          </div>
        </div>
        {blockedByName ? (
          <ButtonLink href="/account?next=/host/verify" size="sm" className="w-full sm:w-fit">
            Set your real name
          </ButtonLink>
        ) : (
          <Link
            href="/account?next=/host/verify"
            className="inline-flex min-h-10 items-center self-start text-label font-bold text-accent hover:text-accent-hi"
          >
            Not exactly right? Edit your name
          </Link>
        )}
      </section>

      {WEB_LIVENESS_ENABLED ? (
        <div className="flex flex-col gap-2">
          <p id="kyc-method" className="text-label text-text-dim">How do you want to verify?</p>
          <div role="radiogroup" aria-labelledby="kyc-method" className="grid grid-cols-1 gap-2 min-[420px]:grid-cols-2">
            {(
              [
                { key: "selfie", title: "Selfie + NIN", note: "Recommended · a short video selfie" },
                { key: "number", title: "ID number", note: "BVN or NIN, approved with your bank" },
              ] as const
            ).map((m) => {
              const on = m.key === method;
              return (
                <button
                  key={m.key}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  disabled={inFlight}
                  onClick={() => {
                    setMethod(m.key);
                    setError(null);
                    setFailure(null);
                    setCaptureNote(null);
                    setCameraProblem(null);
                  }}
                  className={cx(
                    "flex min-h-16 items-center justify-between gap-3 rounded-control border px-4 py-3 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-60",
                    on ? "border-accent bg-accent-tint" : "border-border bg-surface hover:border-border-strong",
                  )}
                >
                  <span className="min-w-0">
                    <span className="block text-body font-bold text-text">{m.title}</span>
                    <span className="block text-helper text-text-faint">{m.note}</span>
                  </span>
                  {on ? <CheckIcon className="shrink-0 text-accent" /> : null}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      {method === "selfie" ? (
        <section aria-label="Selfie and NIN" className={cx("flex flex-col gap-5", blockedByName && "opacity-60")}>
          <ol className="flex flex-col divide-y divide-border rounded-card border border-border bg-surface">
            <Step n={1} done={false} title="Allow the camera">
              Your browser will ask. It&apos;s only used for the selfie.
            </Step>
            <Step n={2} done={false} title="Take a short video selfie">
              Face a light, remove glasses or a cap, and keep your whole face in the frame.
            </Step>
            <Step n={3} done={false} title="Enter your NIN">
              In QoreID&apos;s window — it goes straight to them, never through CrowdPass.
            </Step>
          </ol>

          {outcome}

          <Button
            type="button"
            disabled={!canSubmit}
            onClick={() => void startSelfie()}
            className="w-full sm:w-fit"
          >
            {capture !== "idle" || watch ? <Spinner /> : <CameraIcon />}
            {capture === "camera"
              ? "Waiting for the camera…"
              : capture === "starting"
                ? "Starting…"
                : capture === "open"
                  ? "Finish in the QoreID window"
                  : watch
                    ? "Checking…"
                    : "Start selfie check"}
          </Button>
        </section>
      ) : (
        <form
          noValidate
          className={cx("flex flex-col gap-5", blockedByName && "opacity-60")}
          onSubmit={(e) => {
            e.preventDefault();
            setTouched(true);
            if (!canSubmit || numberError) return;
            void submit({ idType, idNumber });
          }}
        >
          <fieldset disabled={blockedByName || busy} className="flex min-w-0 flex-col gap-5">
            {kyc.availableIdTypes.length > 1 ? (
              <div className="flex flex-col gap-2">
                <p id="kyc-idtype" className="text-label text-text-dim">Verify with</p>
                <div role="radiogroup" aria-labelledby="kyc-idtype" className="grid grid-cols-2 gap-2">
                  {kyc.availableIdTypes.map((t) => {
                    const on = t === idType;
                    return (
                      <button
                        key={t}
                        type="button"
                        role="radio"
                        aria-checked={on}
                        onClick={() => {
                          setIdType(t);
                          setError(null);
                        }}
                        className={cx(
                          "flex h-12 items-center justify-center gap-2 rounded-control border text-body font-bold transition-colors",
                          on ? "border-accent bg-accent-tint text-text" : "border-border bg-surface text-text-dim hover:text-text",
                        )}
                      >
                        {on ? <CheckIcon className="text-accent" /> : null}
                        {t}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}

            <div className="flex flex-col gap-2">
              <TextField
                label={`Your ${idType}`}
                icon={<LockIcon />}
                inputMode="numeric"
                autoComplete="off"
                placeholder={"0".repeat(ID_LENGTH)}
                value={idNumber}
                onChange={(e) => setIdNumber(e.target.value.replace(/\D/g, "").slice(0, ID_LENGTH))}
                error={touched ? numberError : undefined}
                maxLength={ID_LENGTH}
              />
              <p className="text-helper text-text-faint">{ID_HELP[idType]}</p>
            </div>
          </fieldset>

          {outcome}

          <div className="flex flex-col gap-3">
            <Button type="submit" disabled={!canSubmit} className="w-full sm:w-fit">
              {busy ? <Spinner /> : null}
              {busy ? "Checking with NIBSS…" : `Verify with ${idType}`}
            </Button>
            {busy ? (
              <p role="status" className="text-helper text-text-faint">
                This can take up to a minute. Please keep this page open.
              </p>
            ) : null}
          </div>
        </form>
      )}
    </Container>
  );
}

function Header({ title, lead }: { title: string; lead: string }) {
  return (
    <div className="flex items-end justify-between gap-4">
      <div className="min-w-0">
        <Link href="/host" className="text-label text-text-dim hover:text-text">
          ← Dashboard
        </Link>
        <h1 className="mt-2 text-title font-bold text-text">{title}</h1>
        <p className="mt-1 text-body text-text-dim">{lead}</p>
      </div>
    </div>
  );
}

function Step({
  n,
  done,
  title,
  children,
}: {
  n: number;
  done: boolean;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <li className="flex gap-3 px-4 py-3">
      <span
        aria-hidden
        className={cx(
          "grid size-7 shrink-0 place-items-center rounded-full text-helper font-bold",
          done ? "bg-ok/15 text-ok" : "bg-accent-tint text-accent",
        )}
      >
        {done ? <CheckIcon /> : n}
      </span>
      <span className="min-w-0">
        <span className="block text-body font-bold text-text">{title}</span>
        <span className="block text-label text-text-dim">{children}</span>
      </span>
    </li>
  );
}

/** The bank step isn't on the web yet (#35); say where it is. */
function NextStepBank() {
  return (
    <div className="w-full rounded-card border border-border bg-surface px-4 py-3 text-left">
      <p className="text-body font-bold text-text">Next: connect a bank account</p>
      <p className="text-label text-text-dim">
        That&apos;s where card and transfer sales settle. For now, connect it in
        the CrowdPass app: Profile → Set up payouts.
      </p>
    </div>
  );
}
