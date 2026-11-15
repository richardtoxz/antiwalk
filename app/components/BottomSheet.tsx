"use client";

import {
  useRef,
  useEffect,
  useCallback,
  useState,
  useSyncExternalStore,
  type PointerEvent,
  type TouchEvent,
} from "react";
import {
  AlertCircle,
  ArrowLeftRight,
  Bus,
  ChevronDown,
  Loader2,
  Radio,
  Share2,
  Star,
  TrainFront,
  X,
} from "lucide-react";
import { lineSelection, stationSelection } from "@/lib/navigation/favorites";
import { recentsStore } from "@/lib/navigation/selection-store";
import { cn } from "@/lib/utils";
import ArrivalPanel from './ArrivalPanel';
import { positionQuality } from '@/lib/transport/quality';
import type {
  BusRouteDetailsResponse,
  BusVehicle,
  MetroRealtimeMode,
  MetroScheduleEntry,
  MetroStation,
  MetroTrainsResponse,
  SearchSelection,
  SocketConnectionState,
} from "@/lib/transport/types";

// Black or white, whichever reads better on the operator color.
function readableOn(hex?: string | null): string {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex ?? "");
  if (!match) return "#000000";
  const value = parseInt(match[1], 16);
  const luminance = (0.299 * (value >> 16) + 0.587 * ((value >> 8) & 255) + 0.114 * (value & 255)) / 255;
  return luminance > 0.6 ? "#000000" : "#FFFFFF";
}

const SNAP_POINTS = {
  closed: 0,
  peek: 15,
  half: 50,
  full: 85,
} as const;

type SnapPoint = keyof typeof SNAP_POINTS;

interface BottomSheetProps {
  selectedStation?: MetroStation;
  selectedPlatform: string | null;
  onSelectPlatform: (platform: string) => void;
  metroTrains?: MetroTrainsResponse;
  metroStatus?: MetroScheduleEntry;
  metroRealtimeMode: MetroRealtimeMode;
  isMetroLoading: boolean;
  metroError: string | null;
  isBusLoading: boolean;
  busError: string | null;
  onRetryBus: () => void;
  busLastUpdate: string | null;
  busDataQuality: string;
  now: number;
  selectedStopId: number | null;
  onSelectStop: (id: number | null) => void;
  socketState: SocketConnectionState;

  // New multi-line selection props
  selectedLines: string[];
  focusedLine: string | null;
  onSelectFocusedLine: (line: string | null) => void;
  onRemoveLine: (line: string) => void;
  selectedStationCode: string | null;
  onSelectStationCode: (code: string | null) => void;
  lineDirections: Record<string, number>;
  onChangeLineDirection: (line: string, directionId: number) => void;
  activeBusRoutesData: Record<string, BusRouteDetailsResponse>;
  busVehicles: BusVehicle[];
  onSelectResult: (result: SearchSelection) => void;
  isRealtimeFallback?: boolean;
  hasCachedRoutes?: boolean;
  busMode?: "auto" | "light" | "full";
  onBusModeChange?: (mode: "auto" | "light" | "full") => void;
  uses3D?: boolean;
  favorites?: SearchSelection[];
  onToggleFavorite?: (item: SearchSelection) => void;
  onShare?: () => Promise<"shared" | "copied" | "failed">;
}

function getSnapPointFromHeight(heightPercent: number): SnapPoint {
  const points = Object.entries(SNAP_POINTS) as [SnapPoint, number][];
  let closest: SnapPoint = "peek";
  let minDiff = Infinity;

  for (const [name, value] of points) {
    const diff = Math.abs(heightPercent - value);
    if (diff < minDiff) {
      minDiff = diff;
      closest = name;
    }
  }
  return closest;
}

function getVelocitySnapPoint(
  currentHeight: number,
  velocity: number
): SnapPoint {
  if (Math.abs(velocity) > 0.5) {
    if (velocity > 0) {
      if (currentHeight < SNAP_POINTS.peek) return "peek";
      if (currentHeight < SNAP_POINTS.half) return "half";
      return "full";
    }

    if (currentHeight > SNAP_POINTS.half) return "half";
    if (currentHeight > SNAP_POINTS.peek) return "peek";
    return "closed";
  }

  return getSnapPointFromHeight(currentHeight);
}

function getRealtimeModeLabel(mode: MetroRealtimeMode): string {
  if (mode === "ws") {
    return "Recebendo previsões";
  }

  if (mode === "polling") {
    return "Atualizando previsões";
  }

  return "Aguardando previsões";
}

function formatTimeAgo(timestamp: string | null, now: number): string {
  if (!timestamp) {
    return "Sem atualização ainda";
  }

  const deltaMs = now - new Date(timestamp).getTime();
  if (!Number.isFinite(deltaMs) || deltaMs < 0) {
    return "Atualizado agora";
  }

  const seconds = Math.floor(deltaMs / 1000);
  if (seconds < 60) {
    return `Atualizado há ${seconds}s`;
  }

  const minutes = Math.floor(seconds / 60);
  return `Atualizado há ${minutes}min`;
}

function formatMetroOperation(status?: MetroScheduleEntry): string {
  if (!status) {
    return "Horário indisponível";
  }

  if (status.st_paralisado === "s") {
    return "Operação paralisada";
  }

  return `Operando hoje: ${status.ds_hora_inicio.slice(0, 5)} - ${status.ds_hora_fim.slice(0, 5)}`;
}

export default function BottomSheet({
  selectedStation,
  selectedPlatform,
  onSelectPlatform,
  metroTrains,
  metroStatus,
  metroRealtimeMode,
  isMetroLoading,
  metroError,
  isBusLoading,
  busError,
  onRetryBus,
  busLastUpdate,
  busDataQuality,
  now,
  selectedStopId,
  onSelectStop,
  socketState,
  selectedLines,
  focusedLine,
  onSelectFocusedLine,
  onRemoveLine,
  selectedStationCode,
  onSelectStationCode,
  lineDirections,
  onChangeLineDirection,
  activeBusRoutesData,
  busVehicles,
  onSelectResult,
  isRealtimeFallback = false,
  hasCachedRoutes = false,
  busMode = "auto",
  onBusModeChange,
  uses3D = false,
  favorites = [],
  onToggleFavorite,
  onShare,
}: BottomSheetProps) {
  const [shareStatus, setShareStatus] = useState<string | null>(null);
  const share = async () => {
    if (!onShare) return;
    const result = await onShare();
    setShareStatus(result === "copied" ? "Link copiado" : result === "failed" ? "Não foi possível copiar o link" : null);
    if (result !== "shared") window.setTimeout(() => setShareStatus(null), 2500);
  };
  const isFavorite = (id: string) => favorites.some((f) => f.id === id);
  const viewActions = (item: SearchSelection) => (
    <div className="flex shrink-0 items-center">
      {onToggleFavorite && (
        <button
          type="button"
          onClick={() => onToggleFavorite(item)}
          aria-pressed={isFavorite(item.id)}
          aria-label={isFavorite(item.id) ? "Remover dos favoritos" : "Adicionar aos favoritos"}
          className="flex h-10 w-10 items-center justify-center rounded-lg hover:bg-accent"
        >
          <Star className={cn("h-5 w-5", isFavorite(item.id) && "fill-current text-amber-600 dark:text-cta")} aria-hidden />
        </button>
      )}
      {onShare && (
        <button type="button" onClick={share} aria-label="Compartilhar" className="flex h-10 w-10 items-center justify-center rounded-lg hover:bg-accent">
          <Share2 className="h-5 w-5" aria-hidden />
        </button>
      )}
    </div>
  );
  const sheetRef = useRef<HTMLDivElement>(null);
  const [currentSnap, setCurrentSnap] = useState<SnapPoint>("peek");
  const [isDragging, setIsDragging] = useState(false);
  const [heightPercent, setHeightPercent] = useState<number>(SNAP_POINTS.peek);

  const dragState = useRef({
    startY: 0,
    startHeight: 0,
    lastY: 0,
    lastTime: 0,
    velocity: 0,
  });

  const rafRef = useRef<number | null>(null);
  const [isDesktop, setIsDesktop] = useState(false);

  const currentDirectionId = focusedLine ? (lineDirections[focusedLine] ?? 0) : 0;
  const currentRouteData = focusedLine ? activeBusRoutesData[focusedLine] : undefined;
  const currentDirection = currentRouteData?.directions.find(
    (d) => d.directionId === currentDirectionId
  );
  const routeStops = currentDirection?.tripDetails.stops ?? [];
  const dataLabels: Record<string, string> = { fresh: 'Posições recentes', mixed: 'Parte das posições está desatualizada', stale: 'Posições antigas', expired: 'Posições expiradas',
    unknown: 'Horário das posições não confirmado', waiting: 'Aguardando posições', unavailable: 'Dados ao vivo indisponíveis', empty: 'Nenhum veículo informado pela fonte' };

  useEffect(() => {
    const checkDesktop = () => setIsDesktop(window.innerWidth >= 768);
    checkDesktop();
    window.addEventListener("resize", checkDesktop);
    return () => window.removeEventListener("resize", checkDesktop);
  }, []);

  const animateToSnap = useCallback((snap: SnapPoint) => {
    const targetHeight = SNAP_POINTS[snap];
    setCurrentSnap(snap);
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { setHeightPercent(targetHeight); return; }

    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
    }

    const animate = () => {
      setHeightPercent((current) => {
        const diff = targetHeight - current;
        if (Math.abs(diff) < 0.5) {
          return targetHeight;
        }
        return current + diff * 0.15;
      });

      rafRef.current = requestAnimationFrame(animate);
    };

    animate();

    setTimeout(() => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
      setHeightPercent(targetHeight);
    }, 300);
  }, []);

  const handleDragStart = useCallback(
    (clientY: number) => {
      if (isDesktop) return;

      setIsDragging(true);
      dragState.current = {
        startY: clientY,
        startHeight: heightPercent,
        lastY: clientY,
        lastTime: Date.now(),
        velocity: 0,
      };

      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    },
    [heightPercent, isDesktop]
  );

  const handleDragMove = useCallback(
    (clientY: number) => {
      if (!isDragging || isDesktop) return;

      const { startY, startHeight, lastY, lastTime } = dragState.current;
      const deltaY = startY - clientY;
      const viewportHeight = window.innerHeight;
      const deltaPercent = (deltaY / viewportHeight) * 100;

      const now = Date.now();
      const timeDelta = now - lastTime;
      if (timeDelta > 0) {
        const velocityY = (lastY - clientY) / timeDelta;
        dragState.current.velocity = velocityY;
      }

      dragState.current.lastY = clientY;
      dragState.current.lastTime = now;

      let newHeight = startHeight + deltaPercent;
      newHeight = Math.max(SNAP_POINTS.closed, Math.min(SNAP_POINTS.full, newHeight));

      if (newHeight <= SNAP_POINTS.closed) {
        const overscroll = SNAP_POINTS.closed - (startHeight + deltaPercent);
        newHeight = SNAP_POINTS.closed - overscroll * 0.2;
      } else if (newHeight >= SNAP_POINTS.full) {
        const overscroll = startHeight + deltaPercent - SNAP_POINTS.full;
        newHeight = SNAP_POINTS.full + overscroll * 0.2;
      }

      setHeightPercent(newHeight);
    },
    [isDragging, isDesktop]
  );

  const handleDragEnd = useCallback(() => {
    if (!isDragging || isDesktop) return;

    setIsDragging(false);
    const { velocity } = dragState.current;
    const snap = getVelocitySnapPoint(heightPercent, velocity);
    animateToSnap(snap);
  }, [isDragging, heightPercent, animateToSnap, isDesktop]);

  const handlePointerDown = useCallback(
    (e: PointerEvent<HTMLDivElement>) => {
      if (!(e.target as HTMLElement).closest("[data-drag-handle]")) return;
      e.preventDefault();
      handleDragStart(e.clientY);
    },
    [handleDragStart]
  );

  const handlePointerMove = useCallback(
    (e: PointerEvent<HTMLDivElement>) => {
      if (!isDragging) return;
      e.preventDefault();
      handleDragMove(e.clientY);
    },
    [isDragging, handleDragMove]
  );

  const handlePointerUp = useCallback(() => {
    handleDragEnd();
  }, [handleDragEnd]);

  const handleTouchStart = useCallback(
    (e: TouchEvent<HTMLDivElement>) => {
      if (!(e.target as HTMLElement).closest("[data-drag-handle]")) return;
      handleDragStart(e.touches[0].clientY);
    },
    [handleDragStart]
  );

  const handleTouchMove = useCallback(
    (e: TouchEvent<HTMLDivElement>) => {
      if (!isDragging) return;
      e.preventDefault();
      handleDragMove(e.touches[0].clientY);
    },
    [isDragging, handleDragMove]
  );

  const handleTouchEnd = useCallback(() => {
    handleDragEnd();
  }, [handleDragEnd]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (isDesktop) return;

      const snapOrder: SnapPoint[] = ["closed", "peek", "half", "full"];
      const currentIndex = snapOrder.indexOf(currentSnap);

      switch (e.key) {
        case "ArrowUp":
        case "ArrowLeft":
          e.preventDefault();
          if (currentIndex < snapOrder.length - 1) {
            animateToSnap(snapOrder[currentIndex + 1]);
          }
          break;
        case "ArrowDown":
        case "ArrowRight":
          e.preventDefault();
          if (currentIndex > 0) {
            animateToSnap(snapOrder[currentIndex - 1]);
          }
          break;
        case "Home":
          e.preventDefault();
          animateToSnap("full");
          break;
        case "End":
          e.preventDefault();
          animateToSnap("peek");
          break;
        case "Escape":
          e.preventDefault();
          animateToSnap("peek");
          break;
      }
    },
    [currentSnap, animateToSnap, isDesktop]
  );

  useEffect(() => {
    if (currentSnap === "full" && !isDesktop) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }

    return () => {
      document.body.style.overflow = "";
    };
  }, [currentSnap, isDesktop]);

  const sheetHeight = isDesktop ? undefined : `${heightPercent}dvh`;
  const lineColor = currentRouteData?.route.color ?? "var(--muted)";
  const freshCount = busVehicles.filter((v) => positionQuality(v, now) === "fresh").length;

  // Recent searches are written by the search field.
  const recents = useSyncExternalStore(recentsStore.subscribe, recentsStore.read, recentsStore.readOnServer).slice(0, 5);

  return (
    <div
      ref={sheetRef}
      className={cn(
        "fixed z-10 bg-card/95 backdrop-blur-xl border-border/50 transition-shadow duration-300",
        "md:left-4 md:top-[5.5rem] md:bottom-4 md:right-auto md:w-[380px]",
        "md:rounded-xl md:border md:shadow-xl",
        "left-0 right-0 bottom-0 rounded-t-2xl border-t shadow-[0_-8px_30px_rgba(0,0,0,0.16)]",
        isDragging ? "cursor-grabbing" : "",
        currentSnap === "full" && !isDesktop
          ? "shadow-[0_-16px_50px_rgba(0,0,0,0.2)]"
          : ""
      )}
      style={{
        height: sheetHeight,
        minHeight: isDesktop ? undefined : "60px",
        maxHeight: isDesktop ? undefined : "90dvh",
        transition: isDragging ? "none" : "height 0.3s cubic-bezier(0.32, 0.72, 0, 1)",
        willChange: "height",
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      role="dialog"
      aria-label="Painel de navegação"
      aria-modal={currentSnap === "full"}
      tabIndex={0}
    >
      <div
        data-drag-handle
        className={cn(
          "w-full flex items-center justify-center gap-3 px-4 py-2 cursor-grab md:hidden",
          "touch-none select-none",
          isDragging && "cursor-grabbing"
        )}
      >
        <div role="slider" tabIndex={0} aria-label="Arraste para expandir ou recolher" aria-valuemin={0} aria-valuemax={85}
          aria-valuenow={Math.round(heightPercent)} onKeyDown={handleKeyDown} className="flex min-h-11 flex-1 items-center justify-center rounded-lg focus-visible:outline-2 focus-visible:outline-primary">
          <div className={cn("w-10 h-1 bg-muted-foreground/30 rounded-full transition-all duration-200", isDragging && "w-12 bg-muted-foreground/50")} />
        </div>
        <button
          onClick={() =>
            animateToSnap(currentSnap === "peek" ? "half" : "peek")
          }
          className={cn(
            "flex h-11 w-11 items-center justify-center rounded-full transition-transform duration-300 motion-reduce:transition-none",
            currentSnap !== "peek" && "rotate-180"
          )}
          aria-label={currentSnap === "peek" ? "Expandir" : "Recolher"}
        >
          <ChevronDown className="w-5 h-5 text-muted-foreground" />
        </button>
      </div>

      <div
        className={cn(
          "px-4 pb-safe-bottom md:p-4 overflow-y-auto overflow-x-hidden",
          "scrollbar-thin scrollbar-thumb-muted scrollbar-track-transparent",
          "h-full"
        )}
        style={{
          maxHeight: isDesktop ? undefined : `calc(${heightPercent}dvh - 60px)`,
        }}
      >
        {(selectedLines.length > 0 || selectedStationCode) && (
          <div className="mb-4 flex items-center gap-1.5 overflow-x-auto scrollbar-none select-none">
            {selectedStationCode && (
              <span
                className={cn(
                  "flex shrink-0 items-center rounded-full border text-sm font-medium",
                  focusedLine === null ? "border-foreground bg-foreground text-background" : "border-border text-muted-foreground"
                )}
              >
                <button type="button" onClick={() => onSelectFocusedLine(null)} className="flex min-h-9 items-center gap-1.5 pl-3 pr-1">
                  <TrainFront className="h-3.5 w-3.5" aria-hidden />
                  {selectedStation?.nome ?? selectedStationCode}
                </button>
                <button type="button" onClick={() => onSelectStationCode(null)} aria-label="Fechar estação" className="flex min-h-9 items-center pl-1 pr-2.5">
                  <X className="h-3.5 w-3.5" aria-hidden />
                </button>
              </span>
            )}
            {selectedLines.map((line) => (
              <span
                key={line}
                className={cn(
                  "flex shrink-0 items-center rounded-full border text-sm font-medium",
                  focusedLine === line ? "border-foreground bg-foreground text-background" : "border-border text-muted-foreground"
                )}
              >
                <button type="button" onClick={() => onSelectFocusedLine(line)} className="flex min-h-9 items-center gap-1.5 pl-3 pr-1 tabular-nums">
                  <Bus className="h-3.5 w-3.5" aria-hidden />
                  {line}
                </button>
                <button type="button" onClick={() => onRemoveLine(line)} aria-label={`Fechar linha ${line}`} className="flex min-h-9 items-center pl-1 pr-2.5">
                  <X className="h-3.5 w-3.5" aria-hidden />
                </button>
              </span>
            ))}
          </div>
        )}

        {/* Home: nothing selected yet */}
        {selectedLines.length === 0 && !selectedStationCode && (
          <div>
            <h2 className="text-lg font-semibold leading-tight">Para onde hoje?</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Busque uma linha ou estação no campo acima, ou trace uma rota entre dois lugares.
            </p>

            {favorites.length > 0 && (
              <section className="mt-5" aria-label="Favoritos">
                <h3 className="text-xs font-medium text-muted-foreground">Favoritos</h3>
                <ul className="mt-1 divide-y divide-border">
                  {favorites.map((item) => (
                    <li key={item.id}>
                      <button type="button" onClick={() => onSelectResult(item)} className="flex min-h-12 w-full items-center gap-3 text-left">
                        <Star className="h-4 w-4 shrink-0 fill-current text-amber-600 dark:text-cta" aria-hidden />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">{item.title}</span>
                          <span className="block truncate text-xs text-muted-foreground">{item.subtitle}</span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {recents.length > 0 && (
              <section className="mt-5" aria-label="Buscas recentes">
                <h3 className="text-xs font-medium text-muted-foreground">Recentes</h3>
                <ul className="mt-1 divide-y divide-border">
                  {recents.map((item) => (
                    <li key={item.id}>
                      <button type="button" onClick={() => onSelectResult(item)} className="flex min-h-12 w-full items-center gap-3 text-left">
                        {item.type === "line" ? (
                          <Bus className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                        ) : (
                          <TrainFront className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                        )}
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">{item.title}</span>
                          <span className="block truncate text-xs text-muted-foreground">{item.subtitle}</span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <div className="mt-5 flex items-center gap-3 border-t border-border pt-3 text-sm">
              <TrainFront className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
              <span className="flex-1 font-medium">Metrô</span>
              <span className="text-right text-muted-foreground">{formatMetroOperation(metroStatus)}</span>
            </div>
            {onBusModeChange && (
              <fieldset className="mt-4 border-t border-border pt-3">
                <legend className="sr-only">Ônibus no mapa</legend>
                <p className="text-sm font-medium" aria-hidden>Ônibus no mapa</p>
                <div className="mt-2 grid grid-cols-3 gap-1.5">
                  {([["auto", "Automático"], ["light", "Leve"], ["full", "3D"]] as const).map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      aria-pressed={busMode === value}
                      onClick={() => onBusModeChange(value)}
                      className={cn(
                        "min-h-11 rounded-lg border text-sm font-medium",
                        busMode === value ? "border-foreground bg-foreground text-background" : "border-border hover:bg-accent"
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <p className="mt-1.5 text-xs text-muted-foreground" suppressHydrationWarning>
                  {uses3D
                    ? "Usando modelos 3D. Aproxime o mapa para ver os ônibus e as paradas."
                    : busMode === "light"
                      ? "Usando ícones leves, que economizam bateria."
                      : busMode === "full"
                        ? "Este aparelho não oferece 3D. Usando ícones leves."
                        : "Usando ícones leves neste aparelho."}
                </p>
              </fieldset>
            )}
            <p role="status" className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
              <span className={cn("h-1.5 w-1.5 rounded-full", socketState === "open" ? "bg-cta" : "bg-muted-foreground/50")} aria-hidden />
              {socketState === "open" ? "Dados ao vivo conectados" : "Reconectando aos dados ao vivo"}
            </p>
          </div>
        )}

        {/* A bus line */}
        {focusedLine && (
          <div>
            <div className="flex items-start gap-3">
              <span
                className="shrink-0 rounded-md px-2.5 py-1 text-base font-bold tabular-nums"
                style={{ backgroundColor: lineColor, color: readableOn(currentRouteData?.route.color) }}
              >
                {focusedLine}
              </span>
              <div className="min-w-0 flex-1">
                <h2 className="text-base font-semibold leading-snug">
                  {currentRouteData?.route.longName ?? "Carregando itinerário…"}
                </h2>
                {currentRouteData?.route.price ? (
                  <p className="text-xs text-muted-foreground">Tarifa R$ {currentRouteData.route.price.toFixed(2).replace(".", ",")}</p>
                ) : null}
              </div>
              {viewActions(lineSelection(focusedLine, currentRouteData?.route.longName))}
            </div>
            {shareStatus && <p role="status" className="mt-2 text-xs text-muted-foreground">{shareStatus}</p>}

            {currentRouteData && currentRouteData.directions.length > 1 && (() => {
              const current = currentRouteData.directions.find((d) => d.directionId === currentDirectionId) ?? currentRouteData.directions[0];
              const other = currentRouteData.directions.find((d) => d.directionId !== current.directionId) ?? current;
              return (
                <button
                  type="button"
                  onClick={() => onChangeLineDirection(focusedLine, other.directionId)}
                  className="mt-3 flex min-h-12 w-full items-center gap-3 rounded-lg border border-border px-3 text-left hover:bg-accent"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block text-xs text-muted-foreground">Sentido</span>
                    <span className="block truncate text-sm font-medium">
                      {current.tripDetails.tripName || (current.directionId === 0 ? "Ida" : "Volta")}
                    </span>
                  </span>
                  <ArrowLeftRight className="h-4 w-4 shrink-0" aria-hidden />
                  <span className="sr-only">Inverter sentido</span>
                </button>
              );
            })()}

            <p role="status" className="mt-3 flex flex-wrap items-center gap-x-2 text-sm">
              <span className={cn("h-2 w-2 shrink-0 rounded-full", freshCount > 0 ? "bg-cta" : "bg-muted-foreground/50")} aria-hidden />
              <span className="font-medium">{freshCount > 0 ? `${freshCount} ônibus ao vivo` : dataLabels[busDataQuality]}</span>
              <span className="text-muted-foreground">{formatTimeAgo(busLastUpdate, now)}</span>
            </p>
            {isRealtimeFallback && (
              <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">Conexão ao vivo interrompida. Consultando as posições a cada 15 segundos.</p>
            )}
            {hasCachedRoutes && (
              <p className="mt-1 text-xs text-muted-foreground">Itinerário salvo no aparelho. A atualização ainda não foi confirmada.</p>
            )}
            {freshCount > 0 && ['mixed', 'stale', 'expired', 'unknown', 'unavailable'].includes(busDataQuality) && (
              <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">
                {dataLabels[busDataQuality]}. Posições antigas não confirmam a chegada do ônibus.
              </p>
            )}

            {isBusLoading && (
              <p className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                Carregando paradas e posições…
              </p>
            )}

            {busError && (
              <div role="alert" className="mt-4 rounded-lg border border-destructive/40 p-3 text-sm text-destructive">
                <p className="flex items-start gap-2">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                  <span>{busError}</span>
                </p>
                <button type="button" onClick={onRetryBus} className="mt-2 min-h-11 rounded-lg border border-current px-3 font-semibold">
                  Tentar novamente
                </button>
              </div>
            )}

            {!isBusLoading && !busError && routeStops.length > 0 && (
              <section className="mt-5" aria-label="Paradas">
                <h3 className="flex items-baseline justify-between text-xs font-medium text-muted-foreground">
                  <span>Paradas</span>
                  <span className="tabular-nums">{routeStops.length}</span>
                </h3>
                <p className="mt-0.5 text-xs text-muted-foreground">Toque em uma parada para ver as próximas chegadas.</p>
                <ol className="relative mt-1">
                  <span className="absolute bottom-6 left-[5px] top-6 w-0.5 rounded-full opacity-40" style={{ backgroundColor: lineColor }} aria-hidden />
                  {routeStops.map((stop, index) => {
                    const isEdge = index === 0 || index === routeStops.length - 1;
                    const isSelected = stop.stopId === selectedStopId;
                    return (
                      <li key={`${stop.stopId}:${index}`} className="relative pl-6">
                        <span
                          className="absolute left-0 top-[18px] h-3 w-3 rounded-full border-2 bg-card"
                          style={{ borderColor: lineColor, backgroundColor: isEdge || isSelected ? lineColor : undefined }}
                          aria-hidden
                        />
                        <button
                          type="button"
                          onClick={() => onSelectStop(isSelected ? null : stop.stopId)}
                          aria-expanded={isSelected}
                          className={cn("flex min-h-12 w-full items-center gap-2 text-left", !isSelected && "border-b border-border")}
                        >
                          <span className={cn("min-w-0 flex-1 truncate text-sm", (isEdge || isSelected) && "font-semibold")}>{stop.name}</span>
                          <ChevronDown className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform motion-reduce:transition-none", isSelected && "rotate-180")} aria-hidden />
                        </button>
                        {isSelected && currentRouteData && <ArrivalPanel routeId={currentRouteData.route.routeId} stop={stop} />}
                      </li>
                    );
                  })}
                </ol>
              </section>
            )}
          </div>
        )}

        {/* A metro station */}
        {focusedLine === null && selectedStationCode && (
          <div>
            <div className="flex items-start gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-foreground text-background">
                <TrainFront className="h-5 w-5" aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <h2 className="text-base font-semibold leading-snug">{selectedStation?.nome ?? selectedStationCode}</h2>
                <p className="text-xs text-muted-foreground">Linha {selectedStation?.linha ?? "indisponível"}</p>
                <p className="text-xs text-muted-foreground">{formatMetroOperation(metroStatus)}</p>
              </div>
              {selectedStationCode && viewActions(stationSelection(selectedStationCode, selectedStation?.nome, selectedStation?.linha))}
            </div>
            {shareStatus && <p role="status" className="mt-2 text-xs text-muted-foreground">{shareStatus}</p>}

            {selectedStation && (
              <div className="mt-3 flex flex-wrap gap-1.5" role="group" aria-label="Plataformas">
                {Object.entries(selectedStation.plataformas).map(([platform, sentido]) => (
                  <button
                    key={platform}
                    type="button"
                    onClick={() => onSelectPlatform(platform)}
                    aria-pressed={selectedPlatform === platform}
                    className={cn(
                      "min-h-12 rounded-lg border px-3 text-left",
                      selectedPlatform === platform ? "border-foreground bg-foreground text-background" : "border-border hover:bg-accent"
                    )}
                  >
                    <span className="block text-xs opacity-70">Plataforma {platform}</span>
                    <span className="block text-sm font-medium">{sentido}</span>
                  </button>
                ))}
              </div>
            )}

            <p role="status" className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
              <Radio className="h-3.5 w-3.5" aria-hidden />
              {getRealtimeModeLabel(metroRealtimeMode)}
            </p>

            {isMetroLoading && (
              <p className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                Carregando chegadas…
              </p>
            )}

            {metroError && (
              <p role="alert" className="mt-4 flex items-start gap-2 rounded-lg border border-destructive/40 p-3 text-sm text-destructive">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                <span>{metroError}</span>
              </p>
            )}

            {!isMetroLoading && !metroError && metroTrains && (
              <section className="mt-5" aria-label="Próximos trens">
                <h3 className="flex items-baseline justify-between text-xs font-medium text-muted-foreground">
                  <span>Próximos trens</span>
                  <span>{metroTrains.status_operacional}</span>
                </h3>
                {metroTrains.trens.length === 0 ? (
                  <p className="py-3 text-sm text-muted-foreground">Sem trens no momento para esta plataforma.</p>
                ) : (
                  <ul className="mt-1 divide-y divide-border">
                    {metroTrains.trens
                      .slice()
                      .sort((a, b) => a.chegada_em_minutos - b.chegada_em_minutos)
                      .map((train) => (
                        <li key={`${train.id_trem}-${train.chegada_em_minutos}`} className="flex min-h-12 items-center gap-3">
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium">{train.destino_final}</span>
                            <span className="block truncate text-xs text-muted-foreground">{train.sentido}</span>
                          </span>
                          <span className="shrink-0 text-sm font-semibold tabular-nums text-amber-700 dark:text-cta">
                            {train.chegada_em_minutos === 0 ? "Na estação" : `${train.chegada_em_minutos} min`}
                          </span>
                        </li>
                      ))}
                  </ul>
                )}
              </section>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
