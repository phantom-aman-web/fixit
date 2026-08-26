"use client";

import { SessionProvider } from "next-auth/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { useState, useEffect, type ReactNode } from "react";
import { useSession } from "next-auth/react";

function Heartbeat() {
  const { status } = useSession();

  useEffect(() => {
    if (status !== "authenticated") return;

    const ping = () => {
      fetch("/api/presence", { method: "POST" }).catch(() => {});
    };

    ping(); // initial
    const interval = setInterval(ping, 3 * 60 * 1000); // Every 3 mins
    return () => clearInterval(interval);
  }, [status]);

  return null;
}

export function AppProviders({ children, session }: { children: ReactNode; session?: any }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 5 * 60 * 1000,
            gcTime: 5 * 60 * 1000,       // keep cache for 5 minutes
            refetchOnWindowFocus: true,    // refetch when user tabs back
            refetchIntervalInBackground: false, // pause polling when tab is hidden
            retry: 1,
          },
        },
      })
  );
  return (
    <SessionProvider session={session}>
      <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
        <QueryClientProvider client={client}>
          <Heartbeat />
          {children}
        </QueryClientProvider>
      </ThemeProvider>
    </SessionProvider>
  );
}
