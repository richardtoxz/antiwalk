// Public addresses, inlined at build time. Local defaults match the development setup.
const apiUrl = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000").replace(/\/+$/, "");

export const BACKEND_BASE_URL = apiUrl;
// The WebSocket lives on the same host as the API: http -> ws, https -> wss.
export const BACKEND_WS_URL = apiUrl.replace(/^http/, "ws");
