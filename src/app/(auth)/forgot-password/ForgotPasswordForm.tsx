"use client";

import { useState } from "react";
import { describeAuthError, forgotPassword } from "@/lib/auth";
import { AuthLink, AuthPanel } from "@/components/auth/AuthPanel";
import { TextField } from "@/components/TextField";
import { MailIcon } from "@/components/icons";
import { Button, ButtonLink, ErrorNote, Spinner } from "@/components/ui";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Ask for a password reset (#22). Ports `ForgotPasswordScreen.js`.
 *
 * One request emails BOTH a link (opens `/auth/reset-password?token=…` on
 * whatever device reads the email) and a 6-digit code (for reading it on a
 * phone and resetting here). The answer is the same whether or not the
 * account exists, so this page never says which.
 */
export function ForgotPasswordForm({ initialEmail }: { initialEmail: string }) {
  const [email, setEmail] = useState(initialEmail);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function submit() {
    if (!EMAIL.test(email)) {
      setError("Enter a valid email address.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await forgotPassword(email);
      setSent(true);
    } catch (err) {
      setError(describeAuthError(err, "Couldn't send the reset email. Please try again."));
    } finally {
      setBusy(false);
    }
  }

  if (sent) {
    return (
      <AuthPanel
        line1="Check your"
        line2="email."
        sub={
          <>
            If there&apos;s a CrowdPass account for{" "}
            <span className="break-words text-text">{email}</span>, we&apos;ve sent it a reset link
            and a 6-digit code. The link works for an hour, the code for 15 minutes.
          </>
        }
        footer={
          <p>
            Nothing arrived? Check spam, or{" "}
            <button
              type="button"
              onClick={() => setSent(false)}
              className="inline-flex min-h-10 items-center font-bold text-accent hover:text-accent-hi"
            >
              try again
            </button>
            .
          </p>
        }
      >
        <div className="flex flex-col gap-3">
          <p className="text-label text-text-dim">
            Open the link on this device — or, if you&apos;re reading the email somewhere else,
            enter the code here instead.
          </p>
          <ButtonLink
            href={`/auth/reset-password?email=${encodeURIComponent(email)}`}
            variant="secondary"
            className="w-full"
          >
            I have a code
          </ButtonLink>
        </div>
      </AuthPanel>
    );
  }

  return (
    <AuthPanel
      line1="Forgot your"
      line2="password?"
      sub="Enter your email and we'll send you a way back in."
      footer={
        <p>
          Remembered it? <AuthLink href="/login">Sign in</AuthLink>
        </p>
      }
    >
      <form
        className="flex flex-col gap-4"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <TextField
          label="Email"
          icon={<MailIcon />}
          type="email"
          inputMode="email"
          autoComplete="email"
          autoCapitalize="none"
          spellCheck={false}
          autoFocus
          value={email}
          onChange={(e) => setEmail(e.target.value.trim().toLowerCase())}
        />
        {error ? <ErrorNote>{error}</ErrorNote> : null}
        <Button type="submit" className="w-full" disabled={busy || !email}>
          {busy ? <Spinner /> : null}
          Send reset email
        </Button>
      </form>
    </AuthPanel>
  );
}
