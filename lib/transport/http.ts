import { BACKEND_BASE_URL } from "./config";
import { reportReachable, reportUnreachable } from "./connection";

/** Status used for requests that never reached the server. */
export const NETWORK_ERROR_STATUS = 0;

interface FetchJsonOptions extends RequestInit {
  timeoutMs?: number;
}

export class HttpError extends Error {
  status: number;
  details: unknown;

  constructor(message: string, status: number, details: unknown) {
    super(message);
    this.name = "HttpError";
    this.status = status;
    this.details = details;
  }
}

function buildUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) {
    return path;
  }

  return `${BACKEND_BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

export async function fetchJson<T>(
  path: string,
  options: FetchJsonOptions = {}
): Promise<T> {
  const { timeoutMs = 15000, headers, signal, ...rest } = options;
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);
  const cancel = () => controller.abort();
  if (signal?.aborted) cancel();
  signal?.addEventListener('abort', cancel, { once: true });

  try {
    const response = await fetch(buildUrl(path), {
      ...rest,
      headers: {
        Accept: "application/json",
        ...headers,
      },
      signal: controller.signal,
    });
    reportReachable();

    const contentType = response.headers.get("content-type") ?? "";
    const isJson = contentType.includes("application/json");
    let payload: unknown = null;

    if (isJson) {
      payload = await response.json();
    } else {
      const text = await response.text();
      if (text) {
        try {
          payload = JSON.parse(text);
        } catch {
          payload = text;
        }
      }
    }

    if (!response.ok) {
      throw new HttpError(
        `Request failed with status ${response.status}`,
        response.status,
        payload
      );
    }

    return payload as T;
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new HttpError("Request timeout", 408, null);
    }
    // fetch rejects with a TypeError when the server cannot be reached at all.
    if (error instanceof TypeError) {
      reportUnreachable();
      throw new HttpError("Network error", NETWORK_ERROR_STATUS, null);
    }
    throw error;
  } finally {
    window.clearTimeout(timeoutId);
    signal?.removeEventListener('abort', cancel);
  }
}
