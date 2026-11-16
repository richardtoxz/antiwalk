"use client";

import { useState, useSyncExternalStore } from "react";
import { Download, Share, SquarePlus, X } from "lucide-react";
import {
  dismissInstall,
  promptInstall,
  readInstallState,
  readInstallStateOnServer,
  subscribeInstallState,
  wasDismissedRecently,
} from "@/lib/pwa/install";

const readDismissed = () => wasDismissedRecently();

/** Suggests installing the app on the home screen, the way the current browser allows it. */
export default function InstallApp() {
  const state = useSyncExternalStore(subscribeInstallState, readInstallState, readInstallStateOnServer);
  const dismissed = useSyncExternalStore(subscribeInstallState, readDismissed, () => true);
  const [showSteps, setShowSteps] = useState(false);

  if (state.kind === "installed" || state.kind === "unavailable" || dismissed) return null;

  return (
    <section aria-label="Instalar o aplicativo" className="mt-5 rounded-lg border border-border p-3">
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-foreground text-background">
          <Download className="h-4 w-4" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">Use como aplicativo</p>
          <p className="text-xs text-muted-foreground">Abra direto da tela inicial, em tela cheia, sem procurar no navegador.</p>
        </div>
        <button type="button" onClick={dismissInstall} aria-label="Agora não" className="-mr-1 -mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent">
          <X className="h-4 w-4" aria-hidden />
        </button>
      </div>

      {state.kind === "prompt" && (
        <button
          type="button"
          onClick={() => void promptInstall()}
          className="mt-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-primary px-3 text-sm font-semibold text-primary-foreground"
        >
          <Download className="h-4 w-4" aria-hidden />
          Instalar app
        </button>
      )}

      {state.kind === "ios" && (
        showSteps ? (
          <ol className="mt-3 space-y-2 text-sm">
            <li className="flex items-center gap-2">
              <span className="w-5 shrink-0 text-center text-xs font-semibold text-muted-foreground">1</span>
              Toque em <Share className="h-4 w-4 shrink-0" aria-label="Compartilhar" /> na barra do Safari.
            </li>
            <li className="flex items-center gap-2">
              <span className="w-5 shrink-0 text-center text-xs font-semibold text-muted-foreground">2</span>
              Escolha <SquarePlus className="h-4 w-4 shrink-0" aria-hidden /> Adicionar à Tela de Início.
            </li>
            <li className="flex items-center gap-2">
              <span className="w-5 shrink-0 text-center text-xs font-semibold text-muted-foreground">3</span>
              Toque em Adicionar.
            </li>
          </ol>
        ) : (
          <button
            type="button"
            onClick={() => setShowSteps(true)}
            className="mt-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-foreground px-3 text-sm font-semibold hover:bg-accent"
          >
            Como instalar no iPhone
          </button>
        )
      )}
    </section>
  );
}
