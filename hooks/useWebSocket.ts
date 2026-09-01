"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AlchemyWebSocketManager } from "@/lib/websocket";

interface Options { url: string; onMessage: (message: unknown) => void; onError?: (error: Error) => void; onReconnect?: () => void }
export function useWebSocket({ url, onMessage, onReconnect }: Options) {
  const handler = useRef(onMessage); handler.current = onMessage;
  const manager = useRef<AlchemyWebSocketManager | null>(null);
  const [readyState, setReadyState] = useState<"connected" | "reconnecting" | "disconnected">("disconnected");
  useEffect(() => { const instance = new AlchemyWebSocketManager(url, (message) => handler.current(message), (status) => { setReadyState(status); if (status === "reconnecting") onReconnect?.(); }); manager.current = instance; instance.connect(); return () => instance.close(); }, [url, onReconnect]);
  const send = useCallback((payload: unknown) => manager.current?.send(payload), []);
  const close = useCallback(() => manager.current?.close(), []);
  const reconnect = useCallback(() => manager.current?.reconnect(), []);
  return { send, close, reconnect, readyState };
}
