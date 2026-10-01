"use client";

import { useState } from "react";
import { PASSWORD_MIN, describeAuthError, resetPassword } from "@/lib/auth";
import { AuthLink, AuthPanel } from "@/components/auth/AuthPanel";
import { CodeInput } from "@/components/CodeInput";
import { TextField } from "@/components/TextField";
import { LockIcon, MailIcon } from "@/components/icons";
import { Button, ButtonLink, ErrorNote, Spinner } from "@/components/ui";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Choose a new password (#22). Ports `ResetCodeScreen.js` and
 * `ResetPasswordScreen.js`.
 *
 * There is no "check this code" endpoint: the code (or token) is judged
 * only by the final reset call, so this asks for everything at once rather
 * than pretending to validate the code first. Resetting does not sign the
 * person in — they sign in with the new password next.
 */
export function ResetPasswordForm({
  token,
  badToken,
  initialEmail,
}: {
  token?: string;
  badToken: boolean;
  initialEmail: string;
}) {
  const viaLink = !!token;
  const [email, setEmail] = useState(initialEmail);
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(
    badToken ? "That reset link isn't complete. Copy the whole link from the email, or use the code instead." : null,
  );
  const [done, setDone] = useState(false);

  const problems = {
    email: !viaLink && !EMAIL.test(email) ? "Enter the email the code was sent to" : undefined,
    code: !viaLink && code.length !== 6 ? "Enter the 6-digit code" : undefined,
    password: password.length < PASSWORD_MIN ? `At least ${PASSWORD_MIN} characters` : undefined,
    confirm: confirm !== password ? "The passwords don't match" : undefined,
  };
  const valid = !Object.values(problems).some(Boolean);

  async function submit() {
    setTouched(true);
    if (!valid) return;
    setBusy(true);
    setError(null);
    try {
      await resetPassword(
        viaLink ? { token: token!, newPassword: password } : { email, code, newPassword: password },
      );
      setDone(true);
    } catch (err) {
      setError(
        describeAuthError(
          err,
          viaLink
            ? "That link has expired or was already used. Request a new one."
            : "That code didn't work. Check it, or request a new one.",
        ),
      );
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <AuthPanel line1="Password" line2="changed." sub="Sign in with your new password." pose="success">
        <ButtonLink href={email ? `/login?email=${encodeURIComponent(email)}` : "/login"} replace className="w-full">
          Sign in
        </ButtonLink>
      </AuthPanel>
    );
  }

  return (
    <AuthPanel
      line1="Choose a new"
      line2="password."
      sub={viaLink ? "Pick something you haven't used here before." : "Enter the code from the email, then your new password."}
      footer={
        <>
          <p>
            Link or code expired? <AuthLink href={`/forgot-password${email ? `?email=${encodeURIComponent(email)}` : ""}`}>Send a new one</AuthLink>
          </p>
          <p>
            Remembered it? <AuthLink href="/login">Sign in</AuthLink>
          </p>
        </>
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
        {!viaLink ? (
          <>
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
              error={touched ? problems.email : undefined}
            />
            <CodeInput value={code} onChange={setCode} disabled={busy} invalid={touched && !!problems.code} label="Code from the email" />
          </>
        ) : null}
        <TextField
          label="New password"
          icon={<LockIcon />}
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={touched ? problems.password : undefined}
        />
        <TextField
          label="Confirm new password"
          icon={<LockIcon />}
          type="password"
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          error={touched ? problems.confirm : undefined}
        />
        {error ? <ErrorNote>{error}</ErrorNote> : null}
        <Button type="submit" className="w-full" disabled={busy}>
          {busy ? <Spinner /> : null}
          Change password
        </Button>
      </form>
    </AuthPanel>
  );
}
