"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { describeAuthError, resendVerification } from "@/lib/auth";
import { verifyEmail } from "@/lib/session-client";
import { AuthLink, AuthPanel } from "@/components/auth/AuthPanel";
import { CodeInput } from "@/components/CodeInput";
import { TextField } from "@/components/TextField";
import { MailIcon } from "@/components/icons";
import { Button, ButtonLink, ErrorNote, Spinner } from "@/components/ui";

/** `resend-verification` allows 3 a minute; one per 60s never hits it. */
const RESEND_COOLDOWN_S = 60;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Verify an email by its 6-digit code (#21). Ports `VerifyEmailScreen.js`
 * and the terminal `EmailVerifiedScreen.js`.
 *
 * A code, not a link: the backend has no link-verify endpoint (mobile has
 * no reliable deep links), so this is the only way on the web too. A
 * correct code signs the person in — the server sets the session cookie —
 * and lands on a confirmation with nowhere to go back to.
 *
 * Wrong code and expired code are the same answer from the backend, and
 * after 5 wrong tries the code is dead: both say "request a new one", and
 * the resend button is right there.
 */
export function VerifyEmailForm({
  initialEmail,
  justSent,
  next,
}: {
  initialEmail: string;
  justSent: boolean;
  next?: string;
}) {
  const router = useRouter();
  const [email, setEmail] = useState(initialEmail);
  const [editingEmail, setEditingEmail] = useState(!EMAIL.test(initialEmail));
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [focusKey, setFocusKey] = useState(0);

  const [cooldown, setCooldown] = useState(justSent ? RESEND_COOLDOWN_S : 0);
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState<string | null>(null);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  async function submit(value = code) {
    if (value.length !== 6 || !EMAIL.test(email)) return;
    setBusy(true);
    setError(null);
    try {
      await verifyEmail(email, value);
      setDone(true);
      router.refresh();
    } catch (err) {
      setError(describeAuthError(err, "That code didn't work. Check it, or request a new one."));
      setCode("");
      setFocusKey((k) => k + 1);
    } finally {
      setBusy(false);
    }
  }

  async function resend() {
    if (!EMAIL.test(email)) return;
    setResending(true);
    setError(null);
    setResent(null);
    try {
      await resendVerification(email);
      setResent(`A new code is on its way to ${email}. It replaces the old one.`);
      setCooldown(RESEND_COOLDOWN_S);
      setCode("");
      setFocusKey((k) => k + 1);
    } catch (err) {
      setError(describeAuthError(err, "Couldn't send a new code. Please try again."));
      setCooldown(RESEND_COOLDOWN_S);
    } finally {
      setResending(false);
    }
  }

  if (done) {
    return (
      <AuthPanel
        line1="You're"
        line2="verified."
        sub="Your email is confirmed and you're signed in."
        pose="success"
      >
        <div className="flex flex-col gap-3">
          <ButtonLink href={next ?? "/"} replace className="w-full">
            {next ? "Continue" : "Browse events"}
          </ButtonLink>
          <p className="text-label text-text-dim">
            We filled in your name from your email.{" "}
            <AuthLink href="/account">Set your real name</AuthLink> — the one on your NIN or BVN —
            before you host an event.
          </p>
        </div>
      </AuthPanel>
    );
  }

  return (
    <AuthPanel
      line1="Check your"
      line2="email."
      sub={
        editingEmail ? (
          "Enter the email you signed up with, then the code we sent to it."
        ) : (
          <>
            We sent a 6-digit code to <span className="break-words text-text">{email}</span>.
          </>
        )
      }
      footer={
        <>
          {!editingEmail ? (
            <button
              type="button"
              onClick={() => setEditingEmail(true)}
              className="inline-flex min-h-10 w-fit items-center font-bold text-accent hover:text-accent-hi"
            >
              Wrong email?
            </button>
          ) : null}
          <p>
            Already verified? <AuthLink href={next ? `/login?next=${encodeURIComponent(next)}` : "/login"}>Sign in</AuthLink>
          </p>
        </>
      }
    >
      <form
        className="flex flex-col gap-5"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        {editingEmail ? (
          <TextField
            label="Email"
            icon={<MailIcon />}
            type="email"
            inputMode="email"
            autoComplete="email"
            autoCapitalize="none"
            spellCheck={false}
            value={email}
            onChange={(e) => setEmail(e.target.value.trim().toLowerCase())}
          />
        ) : null}

        <CodeInput
          value={code}
          onChange={(v) => {
            setCode(v);
            setError(null);
          }}
          onComplete={(v) => void submit(v)}
          disabled={busy}
          invalid={!!error}
          focusKey={editingEmail ? undefined : focusKey}
        />

        {error ? <ErrorNote>{error}</ErrorNote> : null}
        {resent ? (
          <p role="status" className="text-label text-text-dim">{resent}</p>
        ) : null}

        <Button type="submit" className="w-full" disabled={busy || code.length !== 6 || !EMAIL.test(email)}>
          {busy ? <Spinner /> : null}
          Verify email
        </Button>

        <div className="flex flex-wrap items-center justify-center gap-x-2 text-label text-text-dim">
          <span>Didn&apos;t get it? Check spam, or</span>
          <button
            type="button"
            onClick={resend}
            disabled={cooldown > 0 || resending || !EMAIL.test(email)}
            className="inline-flex min-h-10 items-center font-bold text-accent hover:text-accent-hi disabled:font-normal disabled:text-text-faint"
          >
            {resending ? "sending…" : cooldown > 0 ? `send a new code in ${cooldown}s` : "send a new code"}
          </button>
        </div>
      </form>
    </AuthPanel>
  );
}
