import type { Metadata, Viewport } from "next";
import { Space_Grotesk } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

// The app's only typeface, matching mobile (`SpaceGrotesk_*`). `display:
// swap` so a slow font fetch on 4G never blocks the event name from painting.
const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

/**
 * Absolute base for Open Graph and canonical URLs.
 *
 * This product is shared as links — a WhatsApp message, a flyer QR, a
 * Click-to-WhatsApp ad — so the link preview is the shopfront. Without a
 * `metadataBase` Next resolves OG URLs relatively and the preview quietly
 * comes back with no image.
 *
 * Falls back to the production origin so a preview deploy without the env var
 * still produces working absolute URLs rather than none.
 */
const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.crowdpazz.com";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "CrowdPass",
    template: "%s · CrowdPass",
  },
  description: "Buy tickets to the events you actually want to be at.",
};

export const viewport: Viewport = {
  themeColor: "#08090D",
  // Mobile-first, and the checkout has amount fields a buyer may want to
  // zoom into — never disable scaling.
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${spaceGrotesk.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col bg-bg text-text">
        {/* Chrome belongs to the route group, not here — `(site)` wears the
            storefront header and footer, `/admin` wears its own. */}
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
