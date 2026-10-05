import { CheckIcon } from "@/components/icons";
import { ButtonLink, cx } from "@/components/ui";
import type { PayoutSetup } from "@/lib/payout-setup";

/**
 * "Get paid by card & transfer" — the three steps after host mode, on the
 * dashboard until they are all done. Crypto events never wait on any of it,
 * and the card says so, so a new host doesn't read it as a gate.
 *
 * One action at a time: only the first unfinished step carries a button.
 */
export function PayoutSetupCard({ setup }: { setup: PayoutSetup }) {
  const steps = [
    {
      key: "name",
      state: setup.name,
      title: "Use your real name",
      body: "Exactly as on your NIN or BVN — it's what we check.",
      href: "/account?next=/host/verify#details",
      cta: "Set your name",
    },
    {
      key: "identity",
      state: setup.identity,
      title: "Verify your identity",
      body:
        setup.identity === "blocked"
          ? "Blocked after too many failed checks. Contact support to reopen it."
          : "A one-time BVN or NIN check. About a minute.",
      href: "/host/verify",
      cta: "Verify now",
    },
    {
      key: "bank",
      state: setup.bank,
      title: "Connect a bank account",
      body: "Where card and transfer sales settle. In the CrowdPass app for now.",
      href: null,
      cta: null,
    },
  ] as const;

  const current = steps.find((s) => s.state === "todo");
  const doneCount = steps.filter((s) => s.state === "done").length;

  return (
    <section
      aria-labelledby="payout-setup"
      className="flex flex-col gap-4 rounded-card border border-accent/30 bg-accent-tint p-5"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 id="payout-setup" className="text-section font-bold text-text">
          Get paid by card &amp; transfer
        </h2>
        <span className="text-helper text-text-dim">{doneCount} of 3 done</span>
      </div>
      <p className="-mt-2 text-label text-text-dim">
        Crypto (USDC) events work already. These steps open card and bank-transfer payments too.
      </p>
      <ol className="flex flex-col gap-3">
        {steps.map((s, i) => {
          const active = s === current;
          return (
            <li key={s.key} className="flex gap-3">
              <span
                aria-hidden
                className={cx(
                  "grid size-7 shrink-0 place-items-center rounded-full text-helper font-bold",
                  s.state === "done"
                    ? "bg-ok/15 text-ok"
                    : s.state === "blocked"
                      ? "bg-danger/15 text-danger"
                      : active
                        ? "bg-accent text-ink"
                        : "bg-surface-strong text-text-faint",
                )}
              >
                {s.state === "done" ? <CheckIcon /> : i + 1}
              </span>
              <div className="flex min-w-0 flex-1 flex-col gap-2">
                <div>
                  <p
                    className={cx(
                      "text-body font-bold",
                      s.state === "done" ? "text-text-dim line-through decoration-text-faint" : "text-text",
                    )}
                  >
                    {s.title}
                    <span className="sr-only">{s.state === "done" ? " (done)" : s.state === "blocked" ? " (blocked)" : ""}</span>
                  </p>
                  {s.state !== "done" ? <p className="text-label text-text-dim">{s.body}</p> : null}
                </div>
                {active && s.href ? (
                  <ButtonLink href={s.href} size="sm" className="w-full sm:w-fit">
                    {s.cta}
                  </ButtonLink>
                ) : null}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
