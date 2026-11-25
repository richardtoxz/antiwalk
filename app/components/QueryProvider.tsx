"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { HttpError, NETWORK_ERROR_STATUS } from "@/lib/transport/http";

export default function QueryProvider({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // The connection monitor retries unreachable servers itself; other errors get two retries.
            retry: (failures, error) => !(error instanceof HttpError && error.status === NETWORK_ERROR_STATUS) && failures < 2,
            refetchOnWindowFocus: false,
          },
        },
      })
  );

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
