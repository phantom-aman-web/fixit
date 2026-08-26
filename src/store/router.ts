"use client";

import { create } from "zustand";

// Internal hash router. The only user-visible Next.js route is `/`; all
// navigation within the app is encoded in location.hash so deep links and
// back/forward work naturally.

export interface Route {
  // raw path after the leading '#/', e.g. "diagnose/session/abc"
  path: string;
  segments: string[];
  query: Record<string, string>;
}

function parseHash(): Route {
  if (typeof window === "undefined") {
    return { path: "home", segments: ["home"], query: {} };
  }
  let h = window.location.hash.replace(/^#\/?/, "");
  const [pathPart, queryPart] = h.split("?");
  const path = pathPart || "home";
  const query: Record<string, string> = {};
  if (queryPart) {
    new URLSearchParams(queryPart).forEach((v, k) => (query[k] = v));
  }
  return { path, segments: path.split("/").filter(Boolean), query };
}

interface RouterState {
  route: Route;
  isReady: boolean;
  navigate: (path: string) => void;
  back: () => void;
  init: () => () => void;
}

export const useRouter = create<RouterState>((set, get) => ({
  route: parseHash(),
  isReady: false,
  navigate: (path) => {
    const clean = path.replace(/^#?\/?/, "");
    if (typeof window !== "undefined") {
      window.location.hash = `/${clean}`;
    }
  },
  back: () => {
    if (typeof window !== "undefined") window.history.back();
  },
  init: () => {
    if (typeof window === "undefined") return () => {};
    const onHash = () => set({ route: parseHash() });
    window.addEventListener("hashchange", onHash);
    // Ensure initial hash exists.
    if (!window.location.hash) {
      window.location.hash = "/home";
    }
    set({ route: parseHash(), isReady: true });
    return () => window.removeEventListener("hashchange", onHash);
  },
}));

// Helpers consumed by feature screens.
export function useCurrentPath(): string {
  return useRouter((s) => s.route.path);
}

export function useSegments(): string[] {
  return useRouter((s) => s.route.segments);
}

export function navigate(path: string) {
  useRouter.getState().navigate(path);
}
