"use client";

import { useId, useState } from "react";
import { Bus, ChevronDown, Share2, X } from "lucide-react";
import { endRide, rideErrorMessage, startRide } from "@/lib/transport/rides-api";
import {
  minutesUntil, rideHeadline, rideLink, ridePositionNote, rideShareText, saveOwnRide,
  type OwnRide, type Ride, type RideStop,
} from "@/lib/transport/rides";
import { useRide } from "@/lib/transport/use-ride";
import LineChip from "./LineChip";
import TurnstileWidget, { TURNSTILE_ENABLED } from "./TurnstileWidget";

/** A bus the passenger may be on, as the map shows it. */
export interface RideCandidate {
  line: string;
  routeId: number;
  tripId: number;
  directionId: number;
  vehicleId: string;
  headsign: string;
  color: string;
  textColor: string;
  /** Stops still ahead of the bus, in trip order. */
  stops: RideStop[];
}

interface RidePanelProps {
  candidate: RideCandidate | null;
  own: OwnRide | null;
  now: number;
  onCloseCandidate: () => void;
}

const CARD = "absolute left-4 right-4 top-20 z-30 rounded-lg border border-border bg-card p-3 shadow-lg md:left-[25.5rem] md:right-auto md:top-4 md:w-80";
const PRIMARY = "flex min-h-11 flex-1 items-center justify-center gap-2 rounded-lg bg-primary px-3 text-sm font-semibold text-primary-foreground disabled:opacity-50";
const SECONDARY = "min-h-11 rounded-lg border border-foreground px-3 text-sm font-semibold hover:bg-accent disabled:opacity-50";

type ShareResult = "shared" | "copied" | "failed";

async function shareRide(ride: Pick<Ride, "line" | "vehicleId" | "alightStop">, shareToken: string): Promise<ShareResult> {
  const url = rideLink(shareToken, window.location.origin);
  const text = rideShareText(ride);
  try {
    if (navigator.share) {
      await navigator.share({ title: "Acompanhe minha viagem", text, url });
      return "shared";
    }
    await navigator.clipboard.writeText(`${text} ${url}`);
    return "copied";
  } catch (error) {
    // Closing the share sheet is not a failure.
    if (error instanceof DOMException && error.name === "AbortError") return "shared";
    return "failed";
  }
}

const shareNotice: Record<ShareResult, string | null> = {
  shared: null,
  copied: "Link copiado. Cole na conversa com quem vai acompanhar.",
  failed: "Toque em Compartilhar link para enviar a viagem.",
};

/** Starting a ride on a bus tapped on the map, and following the ride this device shares. */
export default function RidePanel({ candidate, own, now, onCloseCandidate }: RidePanelProps) {
  const [notice, setNotice] = useState<string | null>(null);
  if (own) return <OwnRideCard own={own} now={now} notice={notice} onNotice={setNotice} />;
  if (candidate) {
    return <StartRideCard candidate={candidate} onClose={onCloseCandidate} onStarted={async (started, ride) => {
      onCloseCandidate();
      // The share sheet opens while the tap that started the ride still counts; when the
      // browser no longer allows it, the ride card offers the button.
      setNotice(shareNotice[await shareRide(ride, started.shareToken)]);
    }} />;
  }
  return null;
}

function StartRideCard({ candidate, onClose, onStarted }: {
  candidate: RideCandidate;
  onClose: () => void;
  onStarted: (own: OwnRide, ride: Ride) => void;
}) {
  const selectId = useId();
  const [stopId, setStopId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [turnstileToken, setTurnstileToken] = useState("");
  const [turnstileResetKey, setTurnstileResetKey] = useState(0);

  const start = async () => {
    setBusy(true);
    setError(null);
    try {
      const started = await startRide({
        routeId: candidate.routeId, tripId: candidate.tripId, vehicleId: candidate.vehicleId,
        alightStopId: stopId ? Number(stopId) : null,
      }, turnstileToken || undefined);
      const own: OwnRide = {
        shareToken: started.shareToken, ownerToken: started.ownerToken,
        line: candidate.line, directionId: candidate.directionId, vehicleId: candidate.vehicleId,
      };
      saveOwnRide(own);
      onStarted(own, started.ride);
    } catch (failure) {
      setError(rideErrorMessage(failure, "Não foi possível começar a viagem agora."));
      setBusy(false);
    } finally {
      if (TURNSTILE_ENABLED) {
        setTurnstileToken("");
        setTurnstileResetKey(k => k + 1);
      }
    }
  };

  return (
    <section className={CARD} aria-labelledby={`${selectId}-title`}>
      <div className="flex items-start gap-2">
        <LineChip line={candidate.line} color={candidate.color} textColor={candidate.textColor} />
        <div className="min-w-0 flex-1">
          <h2 id={`${selectId}-title`} className="text-sm font-semibold">Você está neste ônibus?</h2>
          <p className="truncate text-xs text-muted-foreground">Veículo {candidate.vehicleId} · Sentido {candidate.headsign}</p>
        </div>
        <button type="button" onClick={onClose} className="-mr-1 -mt-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-lg hover:bg-accent" aria-label="Fechar">
          <X className="h-5 w-5" aria-hidden />
        </button>
      </div>
      <label htmlFor={selectId} className="mt-3 block text-sm font-medium">Onde você vai descer? <span className="font-normal text-muted-foreground">(opcional)</span></label>
      <select id={selectId} value={stopId} onChange={(event) => setStopId(event.target.value)} disabled={busy}
        className="mt-1 min-h-11 w-full rounded-lg border border-border bg-background px-2 text-sm">
        <option value="">Ainda não sei</option>
        {candidate.stops.map((stop, index) => <option key={`${stop.stopId}:${index}`} value={stop.stopId}>{stop.name}</option>)}
      </select>
      <TurnstileWidget action="rides" onToken={setTurnstileToken} resetKey={turnstileResetKey} />
      {TURNSTILE_ENABLED && !turnstileToken && <p className="mt-2 text-xs text-muted-foreground">Verificando segurança…</p>}
      <div className="mt-3 flex gap-2">
        <button type="button" onClick={start} disabled={busy || (TURNSTILE_ENABLED && !turnstileToken)} className={PRIMARY}>
          <Share2 className="h-4 w-4" aria-hidden />{busy ? "Começando…" : "Compartilhar viagem"}
        </button>
      </div>
      {error && <p role="alert" className="mt-2 text-sm text-destructive">{error}</p>}
      <p className="mt-2 text-xs text-muted-foreground">O link mostra este ônibus pelo GPS da linha, não a sua localização. Ele para quando você chega.</p>
    </section>
  );
}

function OwnRideCard({ own, now, notice, onNotice }: { own: OwnRide; now: number; notice: string | null; onNotice: (notice: string | null) => void }) {
  const state = useRide(own.shareToken);
  const [minimized, setMinimized] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ride = state.kind === "ready" ? state.ride : null;
  const done = state.kind === "missing" || ride?.status === "ended";

  const close = () => {
    onNotice(null);
    saveOwnRide(null);
  };
  const finish = async () => {
    setBusy(true);
    setError(null);
    try {
      await endRide(own.shareToken, own.ownerToken);
      close();
    } catch (failure) {
      const message = rideErrorMessage(failure, "Não foi possível encerrar a viagem agora.");
      // Gone from the server already: nothing left to end.
      if (message.startsWith("Viagem não encontrada")) close();
      else setError(message);
      setBusy(false);
    }
  };
  const share = async () => {
    if (ride) onNotice(shareNotice[await shareRide(ride, own.shareToken)]);
  };

  if (minimized) {
    const minutes = ride?.status === "active" ? minutesUntil(ride.arrivalAt, now) : null;
    return (
      <button type="button" onClick={() => setMinimized(false)}
        className="absolute left-4 top-20 z-30 flex min-h-11 items-center gap-2 rounded-full border border-border bg-card px-3 text-sm font-semibold shadow-lg md:left-[25.5rem] md:top-4">
        <Bus className="h-4 w-4" aria-hidden />
        Viagem no {own.line}{done ? " · encerrada" : minutes !== null ? ` · ${minutes} min` : ""}
      </button>
    );
  }

  return (
    <section className={CARD} aria-live="polite">
      <div className="flex items-start gap-2">
        <LineChip line={own.line} color={ride?.color ?? null} textColor={ride?.textColor ?? null} />
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold">{done ? "Viagem encerrada" : "Viagem compartilhada"}</h2>
          <p className="truncate text-xs text-muted-foreground">Veículo {own.vehicleId}{ride?.alightStop ? ` · Sentido ${ride.headsign}` : ""}</p>
        </div>
        {!done && (
          <button type="button" onClick={() => setMinimized(true)} className="-mr-1 -mt-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-lg hover:bg-accent" aria-label="Minimizar">
            <ChevronDown className="h-5 w-5" aria-hidden />
          </button>
        )}
      </div>
      <p className="mt-2 text-sm font-medium">
        {state.kind === "missing" ? "Esta viagem já terminou." : ride ? rideHeadline(ride, now)
          : state.kind === "failed" ? "Sem conexão com o servidor. Tentando de novo…" : "Carregando a viagem…"}
      </p>
      {ride && ridePositionNote(ride, now) && <p className="mt-1 text-xs text-muted-foreground">{ridePositionNote(ride, now)}</p>}
      {notice && !done && <p className="mt-1 text-xs text-muted-foreground">{notice}</p>}
      {error && <p role="alert" className="mt-1 text-sm text-destructive">{error}</p>}
      <div className="mt-3 flex gap-2">
        {done ? (
          <button type="button" onClick={close} className={PRIMARY}>Fechar</button>
        ) : (
          <>
            <button type="button" onClick={share} disabled={!ride || busy} className={PRIMARY}>
              <Share2 className="h-4 w-4" aria-hidden />Compartilhar link
            </button>
            <button type="button" onClick={finish} disabled={busy} className={SECONDARY}>Encerrar</button>
          </>
        )}
      </div>
    </section>
  );
}
