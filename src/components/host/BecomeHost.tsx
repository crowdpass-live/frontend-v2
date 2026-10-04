"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ApiError, apiFetch } from "@/lib/api";
import { isProvisionalName } from "@/lib/names";
import { Mascot } from "@/components/Mascot";
import { CardIcon, CheckIcon, CoinIcon } from "@/components/icons";
import { Button, ButtonLink, Container, Spinner, cx } from "@/components/ui";
import type { ApiOrganizerCountry } from "@/types/api";

/**
 * Become a host (#32). Ports `BecomeHostScreen.js`.
 *
 * One step: pick the country you settle in, `POST /auth/become-organizer
 * { country }`. **No identity verification is needed to start** — crypto
 * (USDC) events can be published straight away; verification only gates
 * card and bank-transfer payouts, later. Don't imply otherwise.
 *
 * The country can't be changed afterwards (it fixes the currency and which
 * payout providers and ID documents apply), so it's said before the tap.
 *
 * An account with no email can't host — payouts and attendee contact need
 * one — so that case is sent to /account up front, not left to a 403.
 * `JwtStrategy` re-reads the role on every request, so no re-login: a
 * server refresh is enough to open the dashboard.
 */
export function BecomeHost({
  user,
  countries,
}: {
  user: { firstName: string; lastName: string; email: string };
  countries: ApiOrganizerCountry[];
}) {
  const router = useRouter();
  const [code, setCode] = useState(countries.length === 1 ? countries[0].code : "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<ApiOrganizerCountry | null>(null);
  const [opening, setOpening] = useState(false);

  const selected = countries.find((c) => c.code === code) ?? null;
  const needsEmail = !user.email;
  const placeholderName = isProvisionalName(user);

  async function enable() {
    if (!selected) {
      setError("Pick the country you'll be settling in.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      // `{ country }` and nothing else — forbidNonWhitelisted.
      await apiFetch("/auth/become-organizer", {
        method: "POST",
        auth: true,
        body: { country: selected.code },
      });
      setDone(selected);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        // Already an organizer (another tab, or the app): just open it.
        router.refresh();
        return;
      }
      setError(err instanceof ApiError ? err.message : "Couldn't turn on host mode. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <Container className="flex flex-col items-center gap-5 py-16 text-center">
        <Mascot pose="lets-go" height={130} />
        <h1 className="text-title font-bold text-text">Host mode is on for {done.name}.</h1>
        <p className="text-body text-text-dim">
          You can create and publish crypto-paid events right away. To take card
          and bank transfer too, verify your identity and connect a bank account.
        </p>
        {placeholderName ? (
          <p className="rounded-control border border-warn/40 bg-warn/10 px-4 py-3 text-left text-label text-warn">
            Verification checks your profile name against your NIN or BVN, and
            yours is still the one we made from your email. Set your real name
            first — it takes a few seconds.
          </p>
        ) : null}
        <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
          {/* Verify while they're here; a new host who leaves rarely comes back to it. */}
          <ButtonLink
            href={placeholderName ? "/account?next=/host/verify" : "/host/verify"}
            className="w-full sm:w-auto"
          >
            {placeholderName ? "Set your name, then verify" : "Verify your identity"}
          </ButtonLink>
          <Button
            type="button"
            variant="secondary"
            className="w-full sm:w-auto"
            disabled={opening}
            onClick={() => {
              setOpening(true);
              // The host layout re-reads the role and renders the dashboard.
              router.refresh();
            }}
          >
            {opening ? <Spinner /> : null}
            Later — go to dashboard
          </Button>
        </div>
      </Container>
    );
  }

  return (
    <Container className="flex flex-col gap-6 py-10">
      <div className="flex items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-title font-bold text-text">Start selling tickets</h1>
          <p className="mt-1 text-body text-text-dim">
            Host mode is free and takes one step. You can publish crypto-paid events straight away.
          </p>
        </div>
        <Mascot pose="lets-go" height={88} />
      </div>

      {needsEmail ? (
        <div className="flex flex-col gap-3 rounded-card border border-warn/40 bg-warn/10 p-5">
          <p className="text-body text-text">Add an email address first.</p>
          <p className="text-label text-text-dim">
            Payout notices, refunds and messages from your attendees all go to your
            email, so hosting needs one on your account.
          </p>
          <ButtonLink href="/account" variant="secondary" size="sm" className="w-full sm:w-fit">
            Add your email
          </ButtonLink>
        </div>
      ) : (
        <>
          <section aria-labelledby="host-country" className="flex flex-col gap-3">
            <div>
              <h2 id="host-country" className="text-section font-bold text-text">Where do you settle?</h2>
              <p className="text-helper text-text-faint">
                This sets the currency your events are priced in and which payout
                options you can connect. It can&apos;t be changed later.
              </p>
            </div>
            <div role="radiogroup" aria-labelledby="host-country" className="flex flex-col gap-2">
              {countries.map((c) => {
                const on = c.code === code;
                return (
                  <button
                    key={c.code}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => {
                      setCode(c.code);
                      setError(null);
                    }}
                    className={cx(
                      "flex min-h-14 items-center justify-between gap-3 rounded-control border px-4 py-3 text-left transition-colors",
                      on ? "border-accent bg-accent-tint" : "border-border bg-surface hover:border-border-strong",
                    )}
                  >
                    <span>
                      <span className="block text-body font-bold text-text">{c.name}</span>
                      <span className="block text-helper text-text-faint">
                        Settles in {c.currency}
                        {c.kycIdTypes.length ? ` · verify with ${c.kycIdTypes.join(" or ")}` : ""}
                      </span>
                    </span>
                    {on ? <CheckIcon className="shrink-0 text-accent" /> : null}
                  </button>
                );
              })}
            </div>
          </section>

          <section aria-labelledby="host-next" className="flex flex-col gap-3">
            <h2 id="host-next" className="text-section font-bold text-text">What happens next</h2>
            <ul className="flex flex-col divide-y divide-border rounded-card border border-border bg-surface">
              <li className="flex gap-3 px-4 py-3">
                <CoinIcon className="mt-0.5 shrink-0 text-accent" />
                <span>
                  <span className="block text-body font-bold text-text">Crypto events — right away</span>
                  <span className="block text-label text-text-dim">
                    Create and publish events paid in USDC as soon as host mode is on.
                  </span>
                </span>
              </li>
              <li className="flex gap-3 px-4 py-3">
                <CardIcon className="mt-0.5 shrink-0 text-text-dim" />
                <span>
                  <span className="block text-body font-bold text-text">Card &amp; transfer — two more steps</span>
                  <span className="block text-label text-text-dim">
                    Verify your identity, then connect a bank account.
                  </span>
                </span>
              </li>
            </ul>
          </section>

          {placeholderName ? (
            <p className="text-label text-text-dim">
              Heads up: verification checks your profile name against your ID.{" "}
              <Link href="/account" className="font-bold text-accent hover:text-accent-hi">Set your real name</Link>{" "}
              whenever you&apos;re ready — it isn&apos;t needed to turn host mode on.
            </p>
          ) : null}

          {error ? <p role="alert" className="text-label text-danger">{error}</p> : null}

          <Button type="button" onClick={enable} disabled={busy || !selected} className="w-full sm:w-fit">
            {busy ? <Spinner /> : null}
            {busy ? "Turning on host mode…" : selected ? `Host in ${selected.name}` : "Turn on host mode"}
          </Button>
        </>
      )}
    </Container>
  );
}
