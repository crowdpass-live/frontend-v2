"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { ApiError } from "@/lib/api";
import { signIn } from "@/lib/session-client";
import { safeNext } from "@/lib/session-token";
import { Logo } from "@/components/Logo";
import { Button, Card, ErrorNote, Spinner, cx } from "@/components/ui";

/**
 * Admin sign-in.
 *
 * The shared sign-in (`POST /api/session`) — there is no separate admin
 * credential or session — so a BUYER or ORGANIZER can authenticate
 * successfully here and still be refused every panel. The role is checked
 * immediately on the response rather than after redirecting, so the wrong
 * account gets a clear sentence instead of a dashboard full of 403s. They
 * are signed in to the rest of the app regardless; that is the point of one
 * session.
 */
export function AdminLogin({
  next,
  expired = false,
}: {
  next?: string;
  expired?: boolean;
}) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const target = safeNext(next);
  const destination = target.startsWith("/admin") ? target : "/admin";

  const login = useMutation({
    mutationFn: () => signIn({ email: email.trim(), password }),
    onSuccess: (user) => {
      if (user.role !== "ADMIN") {
        setError(
          `That account is a ${user.role}. The admin pages expose ` +
            `revenue across every organizer, so the API only serves them to ` +
            `an ADMIN account.`,
        );
        return;
      }
      // The admin layout read the session before sign-in; refresh so it
      // re-reads it rather than holding the signed-out `user`.
      router.replace(destination);
      router.refresh();
    },
    onError: (err) => {
      setError(
        err instanceof ApiError
          ? err.message
          : "Could not sign in. Please try again.",
      );
    },
  });

  const busy = login.isPending;

  return (
    <div className="grid min-h-dvh place-items-center px-6 py-16">
      <div className="flex w-full max-w-sm flex-col gap-8">
        <div className="flex flex-col items-center gap-4 text-center">
          <Logo variant="full" height={26} priority />
          <div>
            <h1 className="text-title font-bold text-text">Admin sign-in</h1>
            <p className="mt-1 text-label text-text-dim">
              Platform metrics and operational status.
            </p>
          </div>
        </div>

        <Card className="p-6">
          <form
            className="flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              setError(null);
              login.mutate();
            }}
          >
            <Field
              label="Email"
              type="email"
              inputMode="email"
              autoComplete="username"
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <Field
              label="Password"
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
              className="w-full"
              disabled={busy || !email.trim() || !password}
            >
              {busy ? <Spinner /> : null}
              Sign in
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}

function Field({
  label,
  ...props
}: React.ComponentProps<"input"> & { label: string }) {
  return (
    <label className="flex flex-col gap-2">
      <span className="text-label text-text-dim">{label}</span>
      <input
        {...props}
        className={cx(
          "h-14 rounded-control border border-border bg-surface px-4",
          "text-body text-text placeholder:text-text-faint",
        )}
      />
    </label>
  );
}
