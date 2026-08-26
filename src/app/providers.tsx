"use client";

import { useState } from "react";
import {
  QueryClient,
  QueryClientProvider,
  type QueryClientConfig,
} from "@tanstack/react-query";
import { ApiError } from "@/lib/api";

const config: QueryClientConfig = {
  defaultOptions: {
    queries: {
      // A 4xx is the backend telling us the request itself is wrong —
      // "Event not found", "Only 2 ticket(s) remaining". Retrying that just
      // delays the message the buyer needs to see. Network and 5xx failures
      // are worth another go on a Nigerian mobile connection.
      retry: (failureCount, error) => {
        if (error instanceof ApiError && !error.isRetryable) return false;
        return failureCount < 2;
      },
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    },
    mutations: {
      // Never auto-retry a purchase. The first attempt may well have created
      // a transaction and taken a gateway slot; a silent second attempt is
      // how a buyer ends up with two pending orders for one seat.
      retry: false,
    },
  },
};

export function Providers({ children }: { children: React.ReactNode }) {
  // Created in state, not at module scope: at module scope every request on
  // the server would share one cache, leaking one buyer's data into another's
  // render.
  const [client] = useState(() => new QueryClient(config));
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
