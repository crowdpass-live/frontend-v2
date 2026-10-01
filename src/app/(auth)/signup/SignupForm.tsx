"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { ApiError } from "@/lib/api";
import { PASSWORD_MIN, describeAuthError, register } from "@/lib/auth";
import { AuthLink, AuthPanel } from "@/components/auth/AuthPanel";
import { TextField } from "@/components/TextField";
import { LockIcon, MailIcon, PersonIcon } from "@/components/icons";
import { Button, ErrorNote, Spinner } from "@/components/ui";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Create an account (#68). Ports `SignupScreen.js`, with one deliberate
 * difference: it asks for the person's REAL first and last name.
 *
 * Mobile derives a placeholder from the email (`provisionalName()`), and
 * that placeholder is what later fails identity verification — KYC matches
 * the profile name against the ID and burns a limited daily attempt on a
 * mismatch. The backend requires both names anyway; asking for them here,
 * with the reason, costs one field and saves a failed verification.
 *
 * An email signup gets no session yet: the account is created, a 6-digit
 * code is emailed, and the next step is `/verify-email`.
 */
export function SignupForm({ next }: { next?: string }) {
  const router = useRouter();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [touched, setTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exists, setExists] = useState(false);

  const problems = {
    firstName: !firstName.trim() ? "Enter your first name" : undefined,
    lastName: !lastName.trim() ? "Enter your last name" : undefined,
    email: !EMAIL.test(email.trim()) ? "Enter a valid email address" : undefined,
    password: password.length < PASSWORD_MIN ? `At least ${PASSWORD_MIN} characters` : undefined,
  };
  const valid = !Object.values(problems).some(Boolean);

  const signup = useMutation({
    mutationFn: () => register({ firstName, lastName, email, password }),
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
        <div className="grid grid-cols-1 gap-4 min-[400px]:grid-cols-2">
          <TextField
            label="First name"
            icon={<PersonIcon />}
            autoComplete="given-name"
            autoCapitalize="words"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            error={show("firstName")}
            maxLength={100}
            required
          />
          <TextField
            label="Last name"
            autoComplete="family-name"
            autoCapitalize="words"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            error={show("lastName")}
            maxLength={100}
            required
          />
        </div>
        <p className="-mt-2 text-helper text-text-faint">
          As it appears on your ID — if you ever host events, we check it against your BVN or NIN.
        </p>
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
