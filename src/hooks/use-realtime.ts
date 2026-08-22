"use client";

import { useEffect, useRef } from "react";
import { io, type Socket } from "socket.io-client";
import { useQueryClient } from "@tanstack/react-query";

// Connect to the realtime mini-service via the Caddy gateway.
// Path is always "/" so Caddy routes by ?XTransformPort.
// Database remains the source of truth — realtime is an enhancement layer.
// On reconnect, we invalidate React Query caches so the UI fetches fresh
// authoritative state (recovering from any missed events).
let _socket: Socket | null = null;

export function getSocket(): Socket {
  if (!_socket) {
    _socket = io("/", {
      path: "/",
      transports: ["websocket", "polling"],
      // The gateway reads XTransformPort from the query to forward to :3003.
      query: { XTransformPort: "3003" },
      reconnection: true,
      reconnectionAttempts: Infinity, // keep trying — realtime is best-effort
      reconnectionDelay: 2000,
      reconnectionDelayMax: 10000,
    });
  }
  return _socket;
}

export function useRealtimeEvent(
  channel: string | null,
  event: string,
  handler: (payload: any) => void,
) {
  const ref = useRef(handler);
  const qc = useQueryClient();

  useEffect(() => {
    ref.current = handler;
  }, [handler]);

  useEffect(() => {
    if (!channel) return;
    const s = getSocket();

    // Subscribe to the channel on connect.
    const onConnect = () => {
      s.emit("subscribe", channel);
      // On reconnect, invalidate all queries so the UI fetches fresh
      // authoritative state. This recovers from any events missed while
      // disconnected. The database is the source of truth.
      qc.invalidateQueries();
    };

    if (s.connected) onConnect();
    s.on("connect", onConnect);

    // Listen for the specific event.
    const listener = (payload: any) => ref.current(payload);
    s.on(event, listener);

    // Handle reconnection explicitly — invalidate queries to recover
    // from any missed events during the disconnection.
    const onReconnect = () => {
      qc.invalidateQueries();
    };
    s.io.on("reconnect", onReconnect);

    return () => {
      s.off("connect", onConnect);
      s.off(event, listener);
      s.io.off("reconnect", onReconnect);
    };
  }, [channel, event, qc]);
}
