"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";

// Application-wide error model. Every API error is converted into a typed
// ApiError with a category + human-readable message. The UI can switch on
// the category to show appropriate recovery actions.
export type ApiErrorCategory =
  | "UNAUTHENTICATED"
  | "UNAUTHORIZED"
  | "VALIDATION_ERROR"
  | "NOT_FOUND"
  | "CONFLICT"
  | "INVALID_STATE"
  | "RATE_LIMITED"
  | "PROVIDER_ERROR"
  | "NETWORK_ERROR"
  | "INTERNAL_ERROR";

export class ApiError extends Error {
  category: ApiErrorCategory;
  status: number;
  retryAfterMs?: number;

  constructor(category: ApiErrorCategory, message: string, status: number, retryAfterMs?: number) {
    super(message);
    this.name = "ApiError";
    this.category = category;
    this.status = status;
    this.retryAfterMs = retryAfterMs;
  }
}

function categorizeError(status: number, msg: string): ApiErrorCategory {
  if (status === 401) return "UNAUTHENTICATED";
  if (status === 403) return "UNAUTHORIZED";
  if (status === 404) return "NOT_FOUND";
  if (status === 409) return "CONFLICT";
  if (status === 422) return "VALIDATION_ERROR";
  if (status === 429) return "RATE_LIMITED";
  if (status >= 500) return "PROVIDER_ERROR";
  if (msg.toLowerCase().includes("validation")) return "VALIDATION_ERROR";
  if (msg.toLowerCase().includes("state")) return "INVALID_STATE";
  return "INTERNAL_ERROR";
}

// Human-readable messages for each error category.
export const ERROR_MESSAGES: Record<ApiErrorCategory, string> = {
  UNAUTHENTICATED: "Please sign in to continue.",
  UNAUTHORIZED: "You don't have permission to do that.",
  VALIDATION_ERROR: "Some information was invalid. Please check and try again.",
  NOT_FOUND: "We couldn't find what you were looking for.",
  CONFLICT: "This conflicts with existing data. It may have changed — please refresh.",
  INVALID_STATE: "This action isn't available in the current state.",
  RATE_LIMITED: "You're doing that too fast. Please wait a moment and try again.",
  PROVIDER_ERROR: "An external service is having trouble. Please try again.",
  NETWORK_ERROR: "Couldn't connect to the server. Check your connection and try again.",
  INTERNAL_ERROR: "Something went wrong on our end. Please try again.",
};

// Generic API fetcher with JSON + structured error handling.
export async function apiFetch<T = any>(
  path: string,
  opts: RequestInit = {}
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      ...opts,
      headers: {
        "Content-Type": "application/json",
        ...(opts.headers || {}),
      },
    });
  } catch (e: any) {
    // Network failure — couldn't reach the server at all.
    throw new ApiError("NETWORK_ERROR", e?.message || "Network error", 0);
  }

  if (!res.ok) {
    let msg = `Request failed (${res.status})`;
    let retryAfterMs: number | undefined;
    try {
      const j = await res.json();
      if (j.error) msg = j.error;
      if (j.retryAfterMs) retryAfterMs = j.retryAfterMs;
    } catch {}
    const category = categorizeError(res.status, msg);
    throw new ApiError(category, msg, res.status, retryAfterMs);
  }

  if (res.status === 204) return null as T;
  return res.json() as Promise<T>;
}

// Convenience hooks ----------------------------------------------------------

export function useUnreadNotifications() {
  const { status } = useSession();
  const { data } = useQuery({
    queryKey: ["notifications", "unread"],
    queryFn: () => apiFetch<{ count: number }>("/api/notifications/unread-count"),
    enabled: status === "authenticated",
    refetchInterval: 30_000,
  });
  return data?.count ?? 0;
}

export function useApi<T>(
  key: any[],
  path: string | null,
  opts: { enabled?: boolean; refetchInterval?: number } = {}
) {
  return useQuery({
    queryKey: key,
    queryFn: () => apiFetch<T>(path!),
    enabled: !!path && (opts.enabled ?? true),
    refetchInterval: opts.refetchInterval,
    retry: (failureCount, error) => {
      // Don't retry on auth/authz/validation errors — they won't succeed.
      if (error instanceof ApiError) {
        const noRetry: ApiErrorCategory[] = ["UNAUTHENTICATED", "UNAUTHORIZED", "VALIDATION_ERROR", "NOT_FOUND", "CONFLICT", "INVALID_STATE"];
        if (noRetry.includes(error.category)) return false;
      }
      return failureCount < 2;
    },
  });
}

export function useApiMutation<T = any, V = any>(path: string, method: "POST" | "PATCH" | "PUT" | "DELETE" = "POST") {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: V) =>
      apiFetch<T>(path, {
        method,
        body: body !== undefined ? JSON.stringify(body) : undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries();
    },
    retry: (failureCount, error) => {
      // Don't retry mutations on auth/conflict/validation errors.
      if (error instanceof ApiError) {
        const noRetry: ApiErrorCategory[] = ["UNAUTHENTICATED", "UNAUTHORIZED", "VALIDATION_ERROR", "NOT_FOUND", "CONFLICT", "INVALID_STATE"];
        if (noRetry.includes(error.category)) return false;
      }
      return failureCount < 1; // 1 retry for network/provider errors
    },
  });
}
