import { useApi } from "@/hooks/use-api";
import { useRealtimeEvent } from "@/hooks/use-realtime";
import { useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";

export function useUnreadMessages() {
  const qc = useQueryClient();
  const { data: session } = useSession();

  const { data } = useApi<{ unread: number }>(["messages", "unread"], "/api/conversations/unread", {
    refetchInterval: 15000,
  });

  useRealtimeEvent(session?.user?.id ?? null, "message", () => {
    qc.invalidateQueries({ queryKey: ["messages", "unread"] });
  });

  return data?.unread ?? 0;
}
