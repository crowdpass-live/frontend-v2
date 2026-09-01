import type { SVGProps } from "react";

/**
 * Inline SVG rather than an icon package: there are a handful of icons in the
 * buyer flow, and they all inherit `currentColor` so a token change repaints
 * them with everything else.
 */
type IconProps = SVGProps<SVGSVGElement>;

const base = {
  width: 20,
  height: 20,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.75,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
} as const;

export function CalendarIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <rect x="3" y="5" width="18" height="16" rx="3" />
      <path d="M8 3v4M16 3v4M3 10h18" />
    </svg>
  );
}

export function PinIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11Z" />
      <circle cx="12" cy="10" r="2.5" />
    </svg>
  );
}

export function CardIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <rect x="2.5" y="5" width="19" height="14" rx="3" />
      <path d="M2.5 10h19M6 15h4" />
    </svg>
  );
}

export function CoinIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M15 9.5a3.2 3.2 0 0 0-3-1.5c-1.7 0-3 .9-3 2.2 0 2.9 6 1.4 6 4.3 0 1.3-1.3 2.2-3 2.2a3.2 3.2 0 0 1-3-1.5M12 6v12" />
    </svg>
  );
}

export function ArrowLeftIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M19 12H5M11 18l-6-6 6-6" />
    </svg>
  );
}

export function CheckIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

export function MailIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <rect x="2.5" y="5" width="19" height="14" rx="3" />
      <path d="m3.5 7.5 7.4 5.3a2 2 0 0 0 2.2 0l7.4-5.3" />
    </svg>
  );
}

export function PhoneIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M7 3.5h2.2l1.6 4-1.9 1.4a12 12 0 0 0 5.2 5.2l1.4-1.9 4 1.6V16a3.5 3.5 0 0 1-3.9 3.5A15.5 15.5 0 0 1 3.5 7.4 3.5 3.5 0 0 1 7 3.5Z" />
    </svg>
  );
}
