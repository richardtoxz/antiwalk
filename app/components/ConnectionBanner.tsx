"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { CloudOff, RefreshCw } from "lucide-react";
import { readConnection, readConnectionOnServer, retryNow, subscribeConnection } from "@/lib/transport/connection";

export function useConnection() {
  return useSyncExternalStore(subscribeConnection, readConnection, readConnectionOnServer);
}

/** One notice for the whole app while the transit API cannot be reached. */
export default function ConnectionBanner() {
  const connection = useConnection();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (connection.status === "online") return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [connection.status]);

  if (connection.status === "online") return null;

  const seconds = connection.nextRetryAt ? Math.max(0, Math.ceil((connection.nextRetryAt - now) / 1000)) : null;
  const title = connection.status === "offline" ? "Você está sem internet" : "Sem conexão com o servidor";

  return (
    <div role="status" className="mb-4 flex items-start gap-3 rounded-lg border border-border bg-muted/60 p-3">
      <CloudOff className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{title}</p>
        <p className="text-xs text-muted-foreground">
          Mostrando o que está salvo no aparelho.{" "}
          {seconds !== null && seconds > 0 ? `Nova tentativa em ${seconds} s.` : "Tentando conectar…"}
        </p>
      </div>
      <button
        type="button"
        onClick={retryNow}
        className="flex min-h-9 shrink-0 items-center gap-1.5 rounded-lg border border-border px-2.5 text-xs font-medium hover:bg-accent"
      >
        <RefreshCw className="h-3.5 w-3.5" aria-hidden />
        Tentar agora
      </button>
    </div>
  );
}
