import type { ComponentType, CSSProperties, SVGProps } from "react";
import { BRAND_MARKS, type BrandMark } from "./brand-marks";
import {
  BankIcon,
  CardIcon,
  ChainIcon,
  CoinIcon,
  ImageIcon,
  LockIcon,
  WalletIcon,
} from "../icons";

/**
 * The services CrowdPass's money, identity and tickets move through, as one
 * slow marquee. APIs and partners only: frameworks, databases and hosting
 * are how we build, not who a buyer is trusting, and they stay off the page.
 *
 * Every entry is something live in `backend-v2` or this app. Configured is
 * not the same as integrated (Twilio has env vars and no implementation, so
 * it isn't here). Check the code, not the `.env`, before adding a name.
 *
 * A brand Simple Icons doesn't carry shows a neutral category icon in its
 * tile rather than a hand-drawn imitation of its logo.
 */
type Integration = {
  name: string;
  role: string;
  mark: BrandMark | ComponentType<SVGProps<SVGSVGElement>>;
};

const PARTNERS: Integration[] = [
  { name: "Paystack", role: "Card, transfer & USSD", mark: CardIcon },
  { name: "Monnify", role: "Bank payments & payouts", mark: BankIcon },
  { name: "Circle", role: "Wallets", mark: "circle" },
  { name: "USDC", role: "Stablecoin payments", mark: CoinIcon },
  { name: "Base", role: "Tickets on-chain", mark: ChainIcon },
  { name: "Blockradar", role: "Crypto deposits", mark: WalletIcon },
  { name: "QoreID", role: "Host identity checks", mark: LockIcon },
  { name: "WhatsApp", role: "Ticket delivery", mark: "whatsapp" },
  { name: "Brevo", role: "Email delivery", mark: "brevo" },
  { name: "Pinata", role: "Event images on IPFS", mark: ImageIcon },
];

export function Partners() {
  return <Marquee label="Partners" items={PARTNERS} seconds={48} />;
}

function Marquee({
  label,
  items,
  seconds,
}: {
  label: string;
  items: Integration[];
  seconds: number;
}) {
  return (
    <div className="marquee" aria-label={label} role="region">
      <div
        className="marquee-track"
        style={{ "--marquee-duration": `${seconds}s` } as CSSProperties}
      >
        {/* The list runs twice so the loop is seamless: the track slides
         * exactly half its width, and the copy lands where the original
         * started. The copy is hidden from assistive tech, and from everyone
         * when motion is reduced (see `.marquee` in globals.css). */}
        <ul className="flex shrink-0">
          {items.map((item) => (
            <Tile key={item.name} item={item} />
          ))}
        </ul>
        <ul className="marquee-copy flex shrink-0" aria-hidden>
          {items.map((item) => (
            <Tile key={item.name} item={item} />
          ))}
        </ul>
      </div>
    </div>
  );
}

function Tile({ item }: { item: Integration }) {
  const { name, role, mark } = item;
  return (
    // Spacing is padding on each tile, not `gap` on the list, so the two
    // copies tile with no seam at the join.
    <li className="shrink-0 pr-3">
      <div className="group flex h-16 items-center gap-3 rounded-card border border-border bg-surface/60 pl-3 pr-5 transition-colors hover:border-border-strong hover:bg-surface">
        <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-surface-strong text-text-dim transition-colors group-hover:text-text">
          <Mark mark={mark} />
        </span>
        <span className="flex flex-col whitespace-nowrap">
          <span className="text-label font-bold text-text">{name}</span>
          <span className="text-helper text-text-faint">{role}</span>
        </span>
      </div>
    </li>
  );
}

function Mark({ mark: Mark }: { mark: Integration["mark"] }) {
  if (typeof Mark === "string") {
    return (
      <svg viewBox="0 0 24 24" width={20} height={20} aria-hidden>
        <path d={BRAND_MARKS[Mark]} fill="currentColor" />
      </svg>
    );
  }
  return <Mark width={20} height={20} />;
}
