"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { ApiError } from "@/lib/api";
import { PASSWORD_MIN, describeAuthError, register } from "@/lib/auth";
import { AuthLink, AuthPanel } from "@/components/auth/AuthPanel";
import { TextField } from "@/components/TextField";
import { LockIcon, MailIcon } from "@/components/icons";
import { Button, ErrorNote, Spinner } from "@/components/ui";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Create an account (#68). Ports `SignupScreen.js`: email and password
 * only. A placeholder name is filled from the email (`provisionalName`),
 * and the account page asks for the real one later (#27) — before identity
 * verification needs it.
 *
 * An email signup gets no session yet: the account is created, a 6-digit
 * code is emailed, and the next step is `/verify-email`.
 */
export function SignupForm({ next }: { next?: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [touched, setTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exists, setExists] = useState(false);

  const problems = {
    email: !EMAIL.test(email.trim()) ? "Enter a valid email address" : undefined,
    password: password.length < PASSWORD_MIN ? `At least ${PASSWORD_MIN} characters` : undefined,
  };
  const valid = !Object.values(problems).some(Boolean);

  const signup = useMutation({
    mutationFn: () => register({ email, password }),
    onSuccess: () => {
      const params = new URLSearchParams({ email: email.trim().toLowerCase(), sent: "1" });
      if (next) params.set("next", next);
      router.push(`/verify-email?${params}`);
    },
    onError: (err) => {
      const taken = err instanceof ApiError && err.status === 409;
      setExists(taken);
      setError(
        taken
          ? "There's already a CrowdPass account with that email."
          : describeAuthError(err, "Couldn't create your account. Please try again."),
      );
    },
  });

  const busy = signup.isPending || signup.isSuccess;
  const show = (k: keyof typeof problems) => (touched ? problems[k] : undefined);
  const nextQuery = next ? `?next=${encodeURIComponent(next)}` : "";

  return (
    <AuthPanel
      line1="Create your"
      line2="account."
      sub="Buy tickets, host events, or help at the door."
      pose="lets-go"
      footer={
        <p>
          Already have an account? <AuthLink href={`/login${nextQuery}`}>Sign in</AuthLink>
        </p>
      }
    >
      <form
        className="flex flex-col gap-4"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          setTouched(true);
          setError(null);
          setExists(false);
          if (valid) signup.mutate();
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
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={show("email")}
          required
        />
        <TextField
          label="Password"
          icon={<LockIcon />}
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={show("password")}
          required
        />

        {error ? (
          <ErrorNote>
            {error}
            {exists ? (
              <>
                {" "}
                <AuthLink href={`/login${nextQuery}`}>Sign in</AuthLink> or{" "}
                <AuthLink href="/forgot-password">reset your password</AuthLink>.
              </>
            ) : null}
          </ErrorNote>
        ) : null}

        <Button type="submit" className="mt-2 w-full" disabled={busy}>
          {busy ? <Spinner /> : null}
          Create account
        </Button>
      </form>
    </AuthPanel>
  );
}
