export type ConnectionStatus = "connected" | "reconnecting" | "disconnected";
type MessageHandler = (message: unknown) => void;

/** Small JSON-RPC WebSocket manager with heartbeat and capped exponential backoff. */
export class AlchemyWebSocketManager {
  private socket: WebSocket | null = null;
  private attempts = 0;
  private heartbeat: ReturnType<typeof setInterval> | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private closedByUser = false;
  constructor(private readonly url: string, private readonly onMessage: MessageHandler, private readonly onStatus?: (status: ConnectionStatus) => void) {}
  connect(): void {
    if (typeof WebSocket === "undefined" || !this.url.startsWith("wss://")) return;
    this.closedByUser = false; this.onStatus?.(this.attempts ? "reconnecting" : "disconnected");
    this.socket = new WebSocket(this.url);
    this.socket.onopen = () => { this.attempts = 0; this.onStatus?.("connected"); this.socket?.send(JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_subscribe", params: ["newHeads"] })); if (this.url.includes("alchemy.com")) this.socket?.send(JSON.stringify({ jsonrpc: "2.0", id: 2, method: "eth_subscribe", params: ["alchemy_minedTransactions", { addressesOnly: false, includeRemoved: false }] })); this.heartbeat = setInterval(() => this.socket?.readyState === WebSocket.OPEN && this.socket.send(JSON.stringify({ jsonrpc: "2.0", id: 99, method: "net_version", params: [] })), 30_000); };
    this.socket.onmessage = (event) => { try { this.onMessage(JSON.parse(String(event.data))); } catch { /* Ignore malformed provider frames. */ } };
    this.socket.onerror = () => this.onStatus?.("disconnected");
    this.socket.onclose = () => { if (this.heartbeat) clearInterval(this.heartbeat); if (!this.closedByUser) this.scheduleReconnect(); };
  }
  send(payload: unknown): void { if (this.socket?.readyState === WebSocket.OPEN) this.socket.send(JSON.stringify(payload)); }
  reconnect(): void { this.close(); this.closedByUser = false; this.connect(); }
  close(): void { this.closedByUser = true; if (this.heartbeat) clearInterval(this.heartbeat); if (this.reconnectTimer) clearTimeout(this.reconnectTimer); this.socket?.close(); }
  private scheduleReconnect(): void { this.attempts += 1; this.onStatus?.("reconnecting"); this.reconnectTimer = setTimeout(() => this.connect(), Math.min(30_000, 1_000 * 2 ** (this.attempts - 1))); }
}
