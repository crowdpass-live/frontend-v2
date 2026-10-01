"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { ApiError } from "@/lib/api";
import { signIn } from "@/lib/session-client";
import { Mascot } from "@/components/Mascot";
import { TextField } from "@/components/TextField";
import { LockIcon, PersonIcon } from "@/components/icons";
import { Button, ErrorNote, Spinner } from "@/components/ui";

/**
 * What to tell someone whose sign-in failed. The status matters more than
 * the backend's text: a 403 is an unverified email, NOT a wrong password,
 * and saying "wrong password" to that person sends them to reset a password
 * that was right all along.
 */
function describe(err: unknown): string {
  if (!(err instanceof ApiError)) return "Could not sign in. Please try again.";
  switch (err.status) {
    case 401:
      return "That email or phone number and password don't match an account.";
    case 403:
      // Web has no code-entry screen yet (#21); the code is in their inbox.
      return (
        "Your email address isn't verified yet. Enter the 6-digit code we " +
        "emailed you in the CrowdPass app, then sign in here."
      );
    case 429:
      return "Too many attempts. Wait a minute, then try again.";
    default:
      return err.message;
  }
}

/** `POST /auth/login` takes an email OR a phone; tell them apart by the @. */
function identifier(value: string) {
  const v = value.trim();
  return v.includes("@") ? { email: v } : { phone: v };
}

export function LoginForm({
  next,
  expired = false,
}: {
  next?: string;
  expired?: boolean;
}) {
  const router = useRouter();
  const [id, setId] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const login = useMutation({
    mutationFn: () => signIn({ ...identifier(id), password }),
    onSuccess: (user) => {
      // With nowhere to go back to, an organizer's home is their dashboard.
      const destination = next ?? (user.isOrganizer ? "/host" : "/");
      router.replace(destination);
      // Layouts rendered before sign-in (the header) re-read the session.
      router.refresh();
    },
    onError: (err) => setError(describe(err)),
  });

  const busy = login.isPending || login.isSuccess;

  return (
    <div className="flex w-full max-w-sm flex-col gap-8">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-display font-bold text-text">
            Welcome
            <br />
            back.
          </h1>
          <p className="mt-2 text-body text-text-dim">
            Sign in to manage your events and tickets.
          </p>
        </div>
        <Mascot pose="waving" height={72} />
      </div>

      <form
        className="flex flex-col gap-4"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          login.mutate();
        }}
      >
        <TextField
          label="Email or phone number"
          icon={<PersonIcon />}
          type="text"
          inputMode="email"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          autoFocus
          value={id}
          onChange={(e) => setId(e.target.value)}
          required
        />
        <TextField
          label="Password"
          icon={<LockIcon />}
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        {error ? (
          <ErrorNote>{error}</ErrorNote>
        ) : expired ? (
          <p role="status" className="text-label text-text-dim">
            Your session ended. Sign in again to continue.
          </p>
        ) : null}

        <Button
          type="submit"
          className="mt-2 w-full"
          disabled={busy || !id.trim() || !password}
        >
          {busy ? <Spinner /> : null}
          Sign in
        </Button>
      </form>

      <p className="text-helper text-text-faint">
        New to CrowdPass, or forgot your password? Both live in the CrowdPass
        app for now — they come to the web soon.
      </p>
    </div>
  );
}
