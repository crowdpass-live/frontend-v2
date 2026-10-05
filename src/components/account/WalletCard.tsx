"use client";

import { useState } from "react";
import { chainInfo, explorerLinks, formatUsdc, shortHash } from "@/lib/onchain";
import { Sheet } from "@/components/Sheet";
import { useToast } from "@/components/Toast";
import { CaretDownIcon, CheckIcon, CoinIcon, CopyIcon, ExternalLinkIcon } from "@/components/icons";
import { cx } from "@/components/ui";

export interface WalletView {
  id: string;
  chain: string;
  address: string | null;
  isPrimary: boolean;
  /** `ready` has an address; `provisioning` is Circle still creating it. */
  state: "ready" | "provisioning" | "failed";
  /** Exact decimal string, or null when the RPC could not be read. */
  balance: string | null;
}

/**
 * The multichain USDC wallet card (#26). Ports the wallet half of
 * `ProfileScreen.js`.
 *
 * Read-only by design: wallets are custodial, so there is no connect, send
 * or sign here — and no backend wallet endpoint to add them with. Balances
 * are read server-side (`fetchUsdcBalance`) and handed in, so switching
 * chains is instant.
 *
 * Three honest states: a provisioning wallet says so rather than showing a
 * zero, and an unreadable balance is a dash, never 0.00.
 */
export function WalletCard({ wallets }: { wallets: WalletView[] }) {
  const [selectedId, setSelectedId] = useState(wallets[0]?.id);
  const [picking, setPicking] = useState(false);
  const toast = useToast();
  const wallet = wallets.find((w) => w.id === selectedId) ?? wallets[0];
  if (!wallet) return null;

  const chainLabel = chainInfo(wallet.chain)?.name ?? wallet.chain;
  const link = explorerLinks(wallet.chain, { address: wallet.address }).address;

  const copy = async () => {
    if (!wallet.address) return;
    try {
      // Needs a secure context (HTTPS, or localhost) and this click.
      await navigator.clipboard.writeText(wallet.address);
      toast("Address copied");
    } catch {
      toast("Couldn't copy — select the address and copy it instead.", { tone: "danger" });
    }
  };

  return (
    <div className="flex flex-col overflow-hidden rounded-card border border-accent-tint-border bg-accent-tint">
      <div className="flex items-center justify-between gap-3 px-5 pt-5">
        <div className="flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-control bg-accent/15 text-accent">
            <CoinIcon />
          </span>
          <span className="text-label text-text-dim">USDC balance</span>
        </div>
        {wallets.length > 1 ? (
          <button
            type="button"
            onClick={() => setPicking(true)}
            aria-label={`Chain: ${chainLabel}. Switch chain`}
            className="inline-flex h-8 items-center gap-1 rounded-full bg-accent/15 pl-3 pr-2 text-helper font-medium text-accent transition-colors hover:bg-accent/25"
          >
            {chainLabel}
            <CaretDownIcon width={16} height={16} />
          </button>
        ) : (
          <span className="inline-flex h-8 items-center rounded-full bg-accent/15 px-3 text-helper font-medium text-accent">
            {chainLabel}
          </span>
        )}
      </div>

      <div className="px-5 pb-5 pt-6" aria-live="polite">
        {wallet.state === "provisioning" ? (
          <>
            <p className="text-section font-bold text-text">Setting up your wallet</p>
            <p className="mt-1 text-helper text-text-dim">
              This takes a minute or two after sign-up. Refresh to check.
            </p>
          </>
        ) : wallet.state === "failed" ? (
          <>
            <p className="text-section font-bold text-text">Wallet not ready</p>
            <p className="mt-1 text-helper text-text-dim">
              We couldn&apos;t finish setting this wallet up. Contact support if it stays this way.
            </p>
          </>
        ) : wallet.balance === null ? (
          <>
            <p className="text-metric font-bold text-text-faint">—</p>
            <p className="mt-1 text-helper text-text-dim">
              Couldn&apos;t read the balance from {chainLabel} just now. Refresh to try again.
            </p>
          </>
        ) : (
          <p className="flex items-baseline gap-2">
            <span className="break-all text-display font-bold tabular-nums text-text">
              {formatUsdc(wallet.balance)}
            </span>
            <span className="text-label font-medium text-text-dim">USDC</span>
          </p>
        )}
      </div>

      {wallet.address ? (
        <div className="flex items-center justify-between gap-3 border-t border-accent-tint-border px-5 py-3">
          <button
            type="button"
            onClick={copy}
            title={wallet.address}
            className="-ml-2 inline-flex min-h-10 items-center gap-2 rounded-control px-2 font-mono text-label text-text transition-colors hover:bg-accent/10"
          >
            {shortHash(wallet.address)}
            <CopyIcon width={16} height={16} className="text-text-dim" />
            <span className="sr-only">Copy address</span>
          </button>
          {link ? (
            <a
              href={link}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-10 items-center gap-1 text-helper text-text-dim transition-colors hover:text-text"
            >
              Explorer
              <ExternalLinkIcon width={14} height={14} />
            </a>
          ) : null}
        </div>
      ) : null}

      <Sheet open={picking} title="Switch chain" onClose={() => setPicking(false)}>
        <ul className="flex flex-col gap-2">
          {wallets.map((w) => {
            const info = chainInfo(w.chain);
            const active = w.id === wallet.id;
            return (
              <li key={w.id}>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedId(w.id);
                    setPicking(false);
                  }}
                  aria-current={active ? "true" : undefined}
                  className={cx(
                    "flex w-full items-center justify-between gap-3 rounded-control border px-4 py-3 text-left transition-colors",
                    active ? "border-accent bg-accent/10" : "border-border hover:bg-surface-strong",
                  )}
                >
                  <span className="flex flex-col">
                    <span className="text-body font-medium text-text">
                      {info?.name ?? w.chain}
                      {info?.testnet ? <span className="text-text-faint"> · testnet</span> : null}
                    </span>
                    <span className="text-helper text-text-dim">
                      {w.state === "ready"
                        ? w.balance === null
                          ? "Balance unavailable"
                          : `${formatUsdc(w.balance)} USDC`
                        : w.state === "provisioning"
                          ? "Setting up"
                          : "Not ready"}
                    </span>
                  </span>
                  {active ? <CheckIcon className="text-accent" /> : null}
                </button>
              </li>
            );
          })}
        </ul>
      </Sheet>
    </div>
  );
}
