// Install-as-app support. Chromium browsers (Android, Chrome, Edge) fire `beforeinstallprompt`,
// which lets the app show its own install button; iOS Safari has no such event, so the app
// explains the "Add to Home Screen" steps instead.

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export type InstallState =
  | { kind: "installed" }
  | { kind: "prompt" }
  | { kind: "ios" }
  | { kind: "unavailable" };

const CHANGE = "antiwalk-install";
const DISMISS_KEY = "antiwalk-install-dismissed";
/** After "not now", the suggestion stays hidden for this long. */
const DISMISS_MS = 14 * 24 * 60 * 60 * 1000;

let deferred: InstallPromptEvent | null = null;
let installed = false;
let snapshot: InstallState = { kind: "unavailable" };

function isStandalone(): boolean {
  const nav = navigator as Navigator & { standalone?: boolean };
  return window.matchMedia("(display-mode: standalone)").matches || nav.standalone === true;
}

function isIos(): boolean {
  const ua = navigator.userAgent;
  // iPadOS reports itself as a Mac; touch support tells them apart.
  return /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
}

function compute(): InstallState {
  if (installed || isStandalone()) return { kind: "installed" };
  if (deferred) return { kind: "prompt" };
  // Safari on iOS only; other iOS browsers cannot add web apps to the home screen.
  if (isIos() && /Safari/.test(navigator.userAgent) && !/CriOS|FxiOS|EdgiOS/.test(navigator.userAgent)) return { kind: "ios" };
  return { kind: "unavailable" };
}

function refresh() {
  const next = compute();
  if (next.kind !== snapshot.kind) {
    snapshot = next;
    window.dispatchEvent(new Event(CHANGE));
  }
}

if (typeof window !== "undefined") {
  // Registered at load, because the browser may fire the event before any component mounts.
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferred = event as InstallPromptEvent;
    refresh();
  });
  window.addEventListener("appinstalled", () => {
    installed = true;
    deferred = null;
    refresh();
  });
  snapshot = compute();
}

export function readInstallState(): InstallState {
  return snapshot;
}

// The same object every time, as React requires for server snapshots.
const UNAVAILABLE_ON_SERVER: InstallState = { kind: "unavailable" };
export const readInstallStateOnServer = (): InstallState => UNAVAILABLE_ON_SERVER;

export function subscribeInstallState(notify: () => void) {
  window.addEventListener(CHANGE, notify);
  return () => window.removeEventListener(CHANGE, notify);
}

/** Opens the browser's own install dialog. Returns whether the person accepted. */
export async function promptInstall(): Promise<boolean> {
  if (!deferred) return false;
  const event = deferred;
  deferred = null;
  await event.prompt();
  const { outcome } = await event.userChoice;
  if (outcome === "accepted") installed = true;
  refresh();
  return outcome === "accepted";
}

export function wasDismissedRecently(): boolean {
  try {
    const at = Number(localStorage.getItem(DISMISS_KEY));
    return Number.isFinite(at) && Date.now() - at < DISMISS_MS;
  } catch {
    return false;
  }
}

export function dismissInstall() {
  try { localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch { /* storage unavailable */ }
  window.dispatchEvent(new Event(CHANGE));
}
