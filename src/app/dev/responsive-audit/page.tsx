import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AuditClient } from "./AuditClient";

export const metadata: Metadata = { title: "Responsive audit", robots: { index: false, follow: false } };

/**
 * `pnpm dev` → /dev/responsive-audit. A development tool, 404 in production.
 *
 * Loads every route in a same-origin iframe at 320, 360, 390, 768, 1024,
 * 1280 and 1728px and reports the two responsive rules this codebase holds:
 *
 * 1. **Only the chip strip may overflow-x.** Any element past the right edge
 *    that is not inside its own scroll container is a finding. Measured per
 *    element, because `body { overflow-x: hidden }` would hide page-level
 *    overflow from a scrollWidth check.
 * 2. **One element, two positions — never two elements.** A form with more
 *    than one VISIBLE submit button at a width is a finding.
 *
 * Signed in, it also covers /account, /host (using your first event) and
 * /door. `?routes=/a,/b` and `?widths=320,1280` narrow a run. Restores the
 * `e2e-responsive.mjs` check the README once described.
 */
export default function ResponsiveAuditPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <AuditClient />;
}
