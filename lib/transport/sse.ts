import { fetchEventSource } from "@microsoft/fetch-event-source";
import { BACKEND_BASE_URL } from "./config";

export type SseMessageListener = (payload: unknown) => void;
export type FallbackChangeListener = (isFallback: boolean) => void;

class SseTransportClient {
  private activeRouteIds: number[] = [];
  private abortController: AbortController | null = null;
  private isFallbackState = false;
  private failureCount = 0;
  private reconnectTimer: number | null = null;
  
  private messageListeners = new Set<SseMessageListener>();
  private fallbackListeners = new Set<FallbackChangeListener>();

  subscribe(listener: SseMessageListener): () => void {
    this.messageListeners.add(listener);
    return () => {
      this.messageListeners.delete(listener);
    };
  }

  onFallbackChange(listener: FallbackChangeListener): () => void {
    this.fallbackListeners.add(listener);
    listener(this.isFallbackState);
    return () => {
      this.fallbackListeners.delete(listener);
    };
  }

  get isFallback(): boolean {
    return this.isFallbackState;
  }

  private setFallback(value: boolean) {
    if (this.isFallbackState !== value) {
      this.isFallbackState = value;
      this.fallbackListeners.forEach((listener) => listener(value));
    }
  }

  setMonitoredRoutes(routeIds: number[]): void {
    const sortedNew = [...routeIds].sort().join(",");
    const sortedOld = [...this.activeRouteIds].sort().join(",");

    if (sortedNew === sortedOld) {
      return;
    }

    this.activeRouteIds = [...routeIds];
    this.disconnect();

    if (routeIds.length > 0) {
      this.failureCount = 0; // Reset failure count on explicit route change
      this.connect();
    }
  }

  private connect(): void {
    if (typeof window === "undefined" || this.activeRouteIds.length === 0) {
      return;
    }

    this.disconnectOnlyConnection();

    this.abortController = new AbortController();
    const currentSignal = this.abortController.signal;
    const routeIdsStr = this.activeRouteIds.join(",");
    const url = `${BACKEND_BASE_URL}/api/monitor/sse/${routeIdsStr}`;

    console.log(`[SSE] Connecting to ${url}...`);

    fetchEventSource(url, {
      method: "GET",
      signal: currentSignal,
      openWhenHidden: false,
      async onopen(response) {
        if (response.ok && response.headers.get("content-type")?.includes("text/event-stream")) {
          console.log("[SSE] Connection established successfully");
          return;
        }
        throw new Error(`SSE handshaking failed with status ${response.status}`);
      },
      onmessage: (msg) => {
        if (currentSignal.aborted) return;
        
        if (this.failureCount > 0) {
          console.log("[SSE] Message received. Resetting failure count.");
          this.failureCount = 0;
        }
        this.setFallback(false);

        try {
          if (msg.data) {
            const payload = JSON.parse(msg.data);
            this.messageListeners.forEach((listener) => listener(payload));
          }
        } catch (err) {
          console.error("[SSE] Failed to parse message:", err);
        }
      },
      onclose: () => {
        if (currentSignal.aborted) return;
        console.warn("[SSE] Server closed connection unexpectedly.");
        this.handleConnectionFailure();
      },
      onerror: (err) => {
        if (currentSignal.aborted) return;
        console.error("[SSE] Connection error:", err);
        this.handleConnectionFailure();
        throw err;
      },
    }).catch((err) => {
      if (!currentSignal.aborted) {
        console.error("[SSE] fetchEventSource promise rejected:", err);
      }
    });
  }

  private handleConnectionFailure(): void {
    this.failureCount += 1;
    console.warn(`[SSE] Connection failure count: ${this.failureCount}`);

    if (this.failureCount >= 3) {
      console.warn("[SSE] 3 consecutive failures. Switching to fallback polling mode.");
      this.setFallback(true);
    }

    if (this.reconnectTimer) {
      window.clearTimeout(this.reconnectTimer);
    }

    const baseDelay = 1000;
    const maxDelay = 16000;
    const expDelay = Math.min(maxDelay, baseDelay * Math.pow(2, this.failureCount));
    const jitter = Math.random() * 1000;
    const reconnectDelay = expDelay + jitter;

    console.log(`[SSE] Reconnecting in ${Math.round(reconnectDelay)}ms...`);
    this.reconnectTimer = window.setTimeout(() => {
      this.connect();
    }, reconnectDelay);
  }

  private disconnectOnlyConnection(): void {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
  }

  disconnect(): void {
    this.disconnectOnlyConnection();
    if (this.reconnectTimer) {
      window.clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }
}

export const sseTransportClient = new SseTransportClient();
