import { cn } from "@/lib/utils";

export type PresenceState = "ONLINE" | "AWAY" | "OFFLINE";

export function getPresenceState(lastSeenAt?: string | Date | null): PresenceState {
  if (!lastSeenAt) return "OFFLINE";
  const diff = Date.now() - new Date(lastSeenAt).getTime();
  const minutes = diff / 1000 / 60;
  if (minutes <= 5) return "ONLINE";
  if (minutes <= 30) return "AWAY";
  return "OFFLINE";
}

export function PresenceIndicator({ state, className }: { state: PresenceState; className?: string }) {
  return (
    <span
      className={cn(
        "inline-block h-2.5 w-2.5 rounded-full ring-2 ring-white dark:ring-slate-900",
        state === "ONLINE" && "bg-green-500",
        state === "AWAY" && "bg-amber-500",
        state === "OFFLINE" && "bg-slate-300 dark:bg-slate-600",
        className
      )}
      title={state}
      aria-label={`User is ${state.toLowerCase()}`}
    />
  );
}
