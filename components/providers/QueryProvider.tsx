"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useSettingsStore } from "@/stores/useSettingsStore";

export function QueryProvider({ children }: Readonly<{ children: React.ReactNode }>) {
  const [client] = useState(() => new QueryClient({ defaultOptions: { queries: { staleTime: 30_000, retry: 2, refetchOnWindowFocus: false } } }));
  const refreshInterval = useSettingsStore(state => state.refreshInterval);
  useEffect(() => { client.setDefaultOptions({ queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false, refetchInterval: refreshInterval ? refreshInterval * 1000 : false } }); }, [client, refreshInterval]);
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
