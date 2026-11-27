"use client";

import { useMemo, useState } from "react";
import { ApiError } from "@/lib/api";
import {
  formatClaimCode,
  prizeArt,
  spinOnce,
  submitAirtimePhone,
  type SpinCampaign,
  type SpinResult,
} from "@/lib/spin-wheel";
import { formatDateTimeLong } from "@/lib/format";
import { Celebration } from "@/components/Celebration";
import { Mascot } from "@/components/Mascot";
import { TicketQr } from "@/components/TicketQr";
import { Badge, Button, ButtonLink, Card, ErrorNote, Field, Spinner } from "@/components/ui";
import { PrizeWheel, buildSegments, rotationFor } from "./PrizeWheel";

/** `landed`: the wheel has stopped and the winning slice is lit, a beat
 * before the result card replaces it. */
type Phase = "idle" | "requesting" | "spinning" | "landed" | "revealed";

/** How long the lit winning slice holds before the card. */
const LANDED_HOLD_MS = 1300;

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/**
 * The player's side of the wheel: sign up → spin once → see what you won and
 * how to collect it. The server has already decided the result by the time
 * the wheel starts turning; the animation only lands on it.
 */
export function SpinPlay({
  campaign,
  here,
  user,
}: {
  campaign: SpinCampaign;
  /** This page's path, for `?next=` round trips through sign-up. */
  here: string;
  /** Null when signed out. */
  user: { email: string; phone: string } | null;
}) {
  const segments = useMemo(() => buildSegments(campaign.prizes), [campaign.prizes]);
  const [result, setResult] = useState<SpinResult | null>(campaign.me?.spin ?? null);
  const [phase, setPhase] = useState<Phase>(result ? "revealed" : "idle");
  /** Angle the wheel is spinning to; null until the first spin. */
  const [target, setTarget] = useState<number | null>(null);
  const [winner, setWinner] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [celebrate, setCelebrate] = useState(false);

  async function spin() {
    setError(null);
    setPhase("requesting");
    let res: { spin: SpinResult; alreadySpun: boolean };
    try {
      res = await spinOnce(campaign.id);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
      setPhase("idle");
      return;
    }

    setResult(res.spin);
    if (res.alreadySpun || prefersReducedMotion()) {
      setPhase("revealed");
      setCelebrate(!!res.spin.prize && !res.alreadySpun);
      return;
    }

    const targetId = res.spin.prize?.id ?? null;
    const matches = segments
      .map((s, i) => (s.prizeId === targetId ? i : -1))
      .filter((i) => i >= 0);
    const index = matches.length
      ? matches[Math.floor(Math.random() * matches.length)]
      : segments.findIndex((s) => s.prizeId === null);
    const landOn = Math.max(index, 0);
    setWinner(landOn);
    setTarget((from) =>
      rotationFor(from ?? 0, landOn, segments.length, 5, Math.random() - 0.5),
    );
    setPhase("spinning");
  }

  /** The wheel has come to rest: light the slice, then show the card. */
  function settle() {
    setPhase("landed");
    setCelebrate(!!result?.prize);
    setTimeout(() => setPhase("revealed"), LANDED_HOLD_MS);
  }

  const signupHref = `/signup?next=${encodeURIComponent(here)}`;
  const loginHref = `/login?next=${encodeURIComponent(here)}`;

  return (
    <div className="flex flex-col gap-6">
      {celebrate ? <Celebration seed={Math.round(target ?? 1)} /> : null}

      {phase !== "revealed" ? (
        <PrizeWheel
          segments={segments}
          target={target}
          spinning={phase === "spinning"}
          winner={phase === "landed" ? winner : null}
          onSettled={settle}
        />
      ) : null}

      {phase === "revealed" && result ? (
        <ResultCard
          campaignId={campaign.id}
          result={result}
          defaultPhone={user?.phone ?? ""}
          onChange={setResult}
        />
      ) : !user ? (
        <div className="flex flex-col gap-3">
          <p className="text-center text-body text-text-dim">
            Create a free CrowdPass account to get your spin. It takes a minute.
          </p>
          <ButtonLink href={signupHref} className="w-full">
            Sign up to spin
          </ButtonLink>
          <ButtonLink href={loginHref} variant="secondary" className="w-full">
            I already have an account
          </ButtonLink>
        </div>
      ) : campaign.state === "UPCOMING" ? (
        <Card className="p-5 text-center text-body text-text-dim">
          The wheel opens {formatDateTimeLong(campaign.startsAt)}. Come back then!
        </Card>
      ) : campaign.state === "CLOSED" ? (
        <Card className="p-5 text-center text-body text-text-dim">
          The wheel has closed for this event. Thanks for joining CrowdPass!
        </Card>
      ) : campaign.me && !campaign.me.verified ? (
        <div className="flex flex-col gap-3">
          <p className="text-center text-body text-text-dim">
            Verify your email first, then come back to spin.
          </p>
          <ButtonLink
            href={`/verify-email?${new URLSearchParams({ email: user.email, next: here })}`}
            className="w-full"
          >
            Verify my email
          </ButtonLink>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <ErrorNote>{error}</ErrorNote>
          <Button
            onClick={spin}
            disabled={phase !== "idle"}
            className="w-full"
          >
            {phase === "requesting" ? <Spinner /> : null}
            {phase === "spinning" || phase === "landed" ? "Spinning…" : "Spin the wheel"}
          </Button>
          <p className="text-center text-helper text-text-faint">One spin per person.</p>
        </div>
      )}
    </div>
  );
}

function ResultCard({
  campaignId,
  result,
  defaultPhone,
  onChange,
}: {
  campaignId: string;
  result: SpinResult;
  defaultPhone: string;
  onChange: (r: SpinResult) => void;
}) {
  const prize = result.prize;

  if (!prize) {
    return (
      <Card className="ticket-enter flex flex-col items-center gap-4 p-6 text-center">
        <Mascot pose="thinking" height={120} />
        <h2 className="text-section font-bold text-text">Not this time</h2>
        <p className="text-body text-text-dim">
          No prize on this spin, but you&rsquo;re on CrowdPass now. Your next event is a tap away.
        </p>
        <ButtonLink href="/events" variant="secondary" className="w-full">
          Browse events
        </ButtonLink>
      </Card>
    );
  }

  const collected = result.status === "FULFILLED";
  const code = result.claimCode ?? "";

  return (
    <Card className="ticket-enter flex flex-col items-center gap-4 p-6 text-center">
      {/* eslint-disable-next-line @next/next/no-img-element -- a 2 KB local SVG; next/image adds nothing */}
      <img src={prizeArt(prize)} alt="" width={112} height={112} className="drop-shadow-[0_10px_24px_rgba(254,87,34,0.35)]" />
      <div className="flex flex-col gap-1">
        <p className="text-label text-text-dim">You won</p>
        <h2 className="text-title font-bold text-accent">{prize.label}</h2>
      </div>

      {prize.kind === "AIRTIME" ? (
        <AirtimeClaim
          campaignId={campaignId}
          result={result}
          defaultPhone={defaultPhone}
          onChange={onChange}
        />
      ) : collected ? (
        <Badge tone="ok">Collected</Badge>
      ) : (
        <>
          <p className="text-body text-text-dim">
            Show this at the CrowdPass booth to collect your prize.
          </p>
          <TicketQr token={code} size={180} alt={`Prize claim code ${code}`} failedNote="Show the code below instead." />
          <p className="font-mono text-title font-bold tracking-widest text-text">
            {formatClaimCode(code)}
          </p>
          <p className="text-helper text-text-faint">Screenshot this in case your signal drops.</p>
        </>
      )}
    </Card>
  );
}

function AirtimeClaim({
  campaignId,
  result,
  defaultPhone,
  onChange,
}: {
  campaignId: string;
  result: SpinResult;
  defaultPhone: string;
  onChange: (r: SpinResult) => void;
}) {
  const [phone, setPhone] = useState(defaultPhone);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const amount = result.prize?.airtimeAmount ?? 0;
  const code = result.claimCode ? formatClaimCode(result.claimCode) : null;

  if (result.status === "FULFILLED") {
    return (
      <>
        <Badge tone="ok">Sent</Badge>
        <p className="text-body text-text-dim">
          ₦{amount.toLocaleString("en-NG")} airtime was sent to {result.airtimePhone}.
        </p>
      </>
    );
  }

  if (result.airtimePhone) {
    return (
      <>
        <p className="text-body text-text-dim">
          We&rsquo;ll send ₦{amount.toLocaleString("en-NG")} airtime to{" "}
          <span className="font-bold text-text">{result.airtimePhone}</span> shortly.
        </p>
        {code ? <p className="text-helper text-text-faint">Reference {code}</p> : null}
      </>
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      onChange(await submitAirtimePhone(campaignId, phone));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex w-full flex-col gap-3 text-left">
      <Field
        label="Phone number for your airtime"
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        placeholder="0803 123 4567"
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        required
      />
      <ErrorNote>{error}</ErrorNote>
      <Button type="submit" disabled={busy || !phone.trim()} className="w-full">
        {busy ? <Spinner /> : null} Send my airtime
      </Button>
    </form>
  );
}
