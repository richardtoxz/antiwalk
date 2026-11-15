// Tracks whether the transit API can be reached, and retries on its own when it cannot.
// Readable with useSyncExternalStore; fires BACKEND_BACK_EVENT when the API comes back.
import { BACKEND_BASE_URL } from "./config";

export type ConnectionStatus = "online" | "offline" | "server-down";

export interface ConnectionState {
  status: ConnectionStatus;
  /** When the next automatic attempt happens (ms since epoch), while disconnected. */
  nextRetryAt: number | null;
}

export const BACKEND_BACK_EVENT = "antiwalk-backend-back";
const CHANGE_EVENT = "antiwalk-connection";
/** Waits between attempts: quick at first, then backing off. */
const RETRY_DELAYS_MS = [5000, 10000, 20000, 30000];

const ONLINE: ConnectionState = { status: "online", nextRetryAt: null };
let state: ConnectionState = ONLINE;
let attempt = 0;
let timer: ReturnType<typeof setTimeout> | null = null;
let listening = false;

function setState(next: ConnectionState) {
  const wasDown = state.status !== "online";
  state = next;
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(CHANGE_EVENT));
  if (wasDown && next.status === "online") window.dispatchEvent(new Event(BACKEND_BACK_EVENT));
}

async function probe() {
  timer = null;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);
    const response = await fetch(`${BACKEND_BASE_URL}/health`, { signal: controller.signal, cache: "no-store" });
    clearTimeout(timeout);
    if (response.ok) {
      reportReachable();
      return;
    }
  } catch {
    // Still unreachable; schedule the next attempt below.
  }
  scheduleRetry();
}

function scheduleRetry() {
  if (timer) clearTimeout(timer);
  const delay = RETRY_DELAYS_MS[Math.min(attempt, RETRY_DELAYS_MS.length - 1)];
  attempt++;
  timer = setTimeout(probe, delay);
  const offline = typeof navigator !== "undefined" && navigator.onLine === false;
  setState({ status: offline ? "offline" : "server-down", nextRetryAt: Date.now() + delay });
}

function listen() {
  if (listening || typeof window === "undefined") return;
  listening = true;
  window.addEventListener("offline", () => {
    if (state.status === "online") scheduleRetry();
    else setState({ ...state, status: "offline" });
  });
  window.addEventListener("online", () => retryNow());
}

/** Any response from the API, even an error status, means it is reachable. */
export function reportReachable() {
  attempt = 0;
  if (timer) { clearTimeout(timer); timer = null; }
  if (state.status !== "online") setState(ONLINE);
}

/** A request could not reach the API at all. */
export function reportUnreachable() {
  listen();
  if (state.status === "online") scheduleRetry();
}

export function retryNow() {
  if (state.status === "online") return;
  if (timer) clearTimeout(timer);
  void probe();
}

export function readConnection(): ConnectionState {
  return state;
}

export const readConnectionOnServer = (): ConnectionState => ONLINE;

export function subscribeConnection(notify: () => void) {
  listen();
  window.addEventListener(CHANGE_EVENT, notify);
  return () => window.removeEventListener(CHANGE_EVENT, notify);
}
