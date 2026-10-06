"use client";

import { RouteError } from "@/components/app/RouteError";

/**
 * A failed read on a public page (event, checkout, ticket) — almost always a
 * cold API. Without this the buyer gets Next's bare default error screen.
 */
export default function Error({ retry }: { error: Error; retry: () => void }) {
  return <RouteError retry={retry} audience="public" />;
}
