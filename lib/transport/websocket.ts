import { BACKEND_WS_URL } from "./config";
import type { SocketConnectionState } from "./types";

type TopicListener = (payload: unknown) => void;
type ConnectionStateListener = (state: SocketConnectionState) => void;

interface WireMessage {
  action: "subscribe" | "unsubscribe";
  topic?: string;
}

class TransportSocketClient {
  private socket: WebSocket | null = null;
  private state: SocketConnectionState = "idle";
  private reconnectAttempts = 0;
  private reconnectTimer: number | null = null;
  private closedByClient = false;
  private topicListeners = new Map<string, Set<TopicListener>>();
  private stateListeners = new Set<ConnectionStateListener>();
  private pendingMessages: string[] = [];

  private setState(nextState: SocketConnectionState): void {
    this.state = nextState;
    for (const listener of this.stateListeners) {
      listener(nextState);
    }
  }

  private scheduleReconnect(): void {
    if (this.closedByClient || typeof window === "undefined") {
      return;
    }

    if (this.reconnectTimer) {
      window.clearTimeout(this.reconnectTimer);
    }

    const waitMs = Math.min(15000, 1000 * 2 ** this.reconnectAttempts);
    this.setState("reconnecting");
    this.reconnectTimer = window.setTimeout(() => {
      this.connect();
    }, waitMs);
    this.reconnectAttempts += 1;
  }

  private flushPendingMessages(): void {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      return;
    }

    while (this.pendingMessages.length > 0) {
      const payload = this.pendingMessages.shift();
      if (payload) {
        this.socket.send(payload);
      }
    }
  }

  private queueMessage(message: WireMessage): void {
    this.pendingMessages.push(JSON.stringify(message));
  }

  connect(): void {
    if (typeof window === "undefined") {
      return;
    }

    if (
      this.socket &&
      (this.socket.readyState === WebSocket.OPEN ||
        this.socket.readyState === WebSocket.CONNECTING)
    ) {
      return;
    }

    this.closedByClient = false;
    this.setState(this.reconnectAttempts > 0 ? "reconnecting" : "connecting");

    this.socket = new WebSocket(BACKEND_WS_URL);

    this.socket.addEventListener("open", () => {
      this.reconnectAttempts = 0;
      this.setState("open");

      for (const topic of this.topicListeners.keys()) {
        this.queueMessage({ action: "subscribe", topic });
      }

      this.flushPendingMessages();
    });

    this.socket.addEventListener("message", (event) => {
      try {
        const payload = JSON.parse(event.data) as { topic?: string };
        const topic = payload.topic;

        if (topic) {
          const listeners = this.topicListeners.get(topic);
          listeners?.forEach((listener) => listener(payload));
        }

        const wildcardListeners = this.topicListeners.get("*");
        wildcardListeners?.forEach((listener) => listener(payload));
      } catch {
        // Ignore malformed websocket payloads and keep the stream alive.
      }
    });

    this.socket.addEventListener("error", () => {
      this.setState("error");
    });

    this.socket.addEventListener("close", () => {
      this.setState("closed");
      this.socket = null;
      this.scheduleReconnect();
    });
  }

  subscribe(topic: string, listener: TopicListener): void {
    let listeners = this.topicListeners.get(topic);
    if (!listeners) {
      listeners = new Set<TopicListener>();
      this.topicListeners.set(topic, listeners);
    }

    listeners.add(listener);
    this.connect();

    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify({ action: "subscribe", topic } satisfies WireMessage));
    } else {
      this.queueMessage({ action: "subscribe", topic });
    }
  }

  unsubscribe(topic: string, listener?: TopicListener): void {
    const listeners = this.topicListeners.get(topic);
    if (!listeners) {
      return;
    }

    if (listener) {
      listeners.delete(listener);
    } else {
      listeners.clear();
    }

    if (listeners.size === 0) {
      this.topicListeners.delete(topic);

      if (this.socket?.readyState === WebSocket.OPEN) {
        this.socket.send(JSON.stringify({ action: "unsubscribe", topic } satisfies WireMessage));
      } else {
        this.queueMessage({ action: "unsubscribe", topic });
      }
    }
  }



  onConnectionStateChange(listener: ConnectionStateListener): () => void {
    this.stateListeners.add(listener);
    listener(this.state);

    return () => {
      this.stateListeners.delete(listener);
    };
  }

  disconnect(): void {
    this.closedByClient = true;

    if (this.reconnectTimer) {
      window.clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }

    this.setState("closed");
  }
}

export const transportSocketClient = new TransportSocketClient();
