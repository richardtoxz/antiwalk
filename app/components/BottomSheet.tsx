"use client";

import {
  useRef,
  useEffect,
  useCallback,
  useState,
  useMemo,
  type PointerEvent,
  type TouchEvent,
} from "react";
import {
  AlertCircle,
  Bus,
  ChevronDown,
  Clock3,
  Loader2,
  Radio,
  TrainFront,
  Wifi,
  X,
  TrendingUp,
} from "lucide-react";
import { cn } from "@/lib/utils";
import ArrivalPanel from './ArrivalPanel';
import { positionQuality } from '@/lib/transport/quality';
import type {
  BusRouteDetailsResponse,
  BusStop,
  BusVehicle,
  MetroRealtimeMode,
  MetroScheduleEntry,
  MetroStation,
  MetroTrainsResponse,
  SocketConnectionState,
} from "@/lib/transport/types";

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
}: BottomSheetProps) {
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

  const sheetHeight = isDesktop ? "auto" : `${heightPercent}dvh`;

  return (
    <div
      ref={sheetRef}
      className={cn(
        "fixed z-10 bg-card/95 backdrop-blur-xl border-border/50 transition-shadow duration-300",
        "md:left-4 md:bottom-4 md:right-auto md:w-[380px] md:max-h-[calc(100dvh-6rem)]",
        "md:rounded-2xl md:border md:shadow-2xl",
        "left-0 right-0 bottom-0 rounded-t-3xl border-t shadow-[0_-8px_30px_rgba(0,0,0,0.12)]",
        isDragging ? "cursor-grabbing" : "",
        currentSnap === "full" && !isDesktop
          ? "shadow-[0_-16px_50px_rgba(0,0,0,0.2)]"
          : ""
      )}
      style={{
        height: sheetHeight,
        minHeight: isDesktop ? "auto" : "60px",
        maxHeight: isDesktop ? "calc(100dvh - 6rem)" : "90dvh",
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
          "px-4 pb-safe-bottom md:p-5 overflow-y-auto overflow-x-hidden",
          "scrollbar-thin scrollbar-thumb-muted scrollbar-track-transparent",
          isDesktop ? "max-h-[calc(100dvh-8rem)]" : "h-full"
        )}
        style={{
          maxHeight: isDesktop ? undefined : `calc(${heightPercent}dvh - 60px)`,
        }}
      >
        {/* Horizontal scrollable tab bar */}
        {(selectedLines.length > 0 || selectedStationCode) && (
          <div className="flex items-center gap-2 overflow-x-auto pb-3 mb-4 scrollbar-none border-b border-border/50 select-none">
            {selectedStationCode && (
              <button
                onClick={() => onSelectFocusedLine(null)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all duration-200 border",
                  focusedLine === null
                    ? "bg-cta/10 text-cta border-cta/30 shadow-sm"
                    : "bg-muted/40 text-muted-foreground border-transparent hover:bg-muted"
                )}
              >
                <TrainFront className="w-3.5 h-3.5" />
                <span>Metrô: {selectedStation?.nome ?? selectedStationCode}</span>
                <span
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectStationCode(null);
                  }}
                  className="hover:bg-muted-foreground/20 p-0.5 rounded-full ml-1"
                >
                  <X className="w-3 h-3" />
                </span>
              </button>
            )}

            {selectedLines.map((line) => {
              const routeData = activeBusRoutesData[line];
              const isFocused = focusedLine === line;
              const color = routeData?.route.color ?? "#2563eb";

              return (
                <button
                  key={line}
                  onClick={() => onSelectFocusedLine(line)}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all duration-200 border",
                    isFocused
                      ? "shadow-sm"
                      : "bg-muted/40 text-muted-foreground border-transparent hover:bg-muted"
                  )}
                  style={{
                    backgroundColor: isFocused ? `${color}15` : undefined,
                    color: isFocused ? color : undefined,
                    borderColor: isFocused ? `${color}30` : undefined,
                  }}
                >
                  <Bus className="w-3.5 h-3.5" />
                  <span>Linha {line}</span>
                  <span
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemoveLine(line);
                    }}
                    className="hover:bg-muted-foreground/20 p-0.5 rounded-full ml-1"
                  >
                    <X className="w-3 h-3" />
                  </span>
                </button>
              );
            })}
          </div>
        )}

        <div className="mb-4 rounded-xl border border-border bg-background/50 p-3">
          <div className="flex items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-1.5 text-muted-foreground font-medium">
              <Wifi className="w-3.5 h-3.5" />
              <span>{focusedLine ? dataLabels[busDataQuality] : socketState === 'open' ? 'Conexão disponível' : 'Reconectando'}</span>
            </div>
            {focusedLine === null && selectedStationCode ? (
              <div className="flex items-center gap-1.5 text-muted-foreground font-medium">
                <Radio className="w-3.5 h-3.5 animate-pulse text-cta" />
                <span>{getRealtimeModeLabel(metroRealtimeMode)}</span>
              </div>
            ) : null}
          </div>
        </div>

        {/* Empty State */}
        {selectedLines.length === 0 && !selectedStationCode && (
          <div className="space-y-3">
            <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
              <p className="text-sm font-semibold text-foreground">Escolha uma linha ou estação</p>
              <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                Use a barra de busca acima para ver o trajeto de ônibus com GPS em tempo real, ou selecione uma estação do metrô.
              </p>
            </div>
            <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
              <p className="text-sm font-semibold text-foreground">Funcionalidades</p>
              <ul className="mt-2 space-y-2.5 text-xs text-muted-foreground">
                <li className="flex items-center gap-2">
                  <Bus className="w-4 h-4 text-primary" />
                  <span>Pesquise múltiplas linhas de ônibus simultaneamente</span>
                </li>
                <li className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-emerald-500" />
                  <span>Filtre ônibus e paradas por sentido (Ida/Volta)</span>
                </li>
                <li className="flex items-center gap-2">
                  <TrainFront className="w-4 h-4 text-cta" />
                  <span>Chegada dos trens e status operacional do Metrô-DF</span>
                </li>
              </ul>
            </div>
          </div>
        )}

        {/* Focused Bus Line Details */}
        {focusedLine && (
          <div className="space-y-3">
            <div className="rounded-xl border border-border bg-card p-4 shadow-sm relative overflow-hidden">
              <div
                className="absolute left-0 top-0 bottom-0 w-1.5"
                style={{ backgroundColor: currentRouteData?.route.color ?? "#2563eb" }}
              />
              <div className="pl-2">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Linha ativa</p>
                <h3 className="mt-0.5 text-lg font-bold text-foreground">
                  Linha {focusedLine}
                </h3>
                <p className="mt-0.5 text-xs text-muted-foreground leading-relaxed">
                  {currentRouteData?.route.longName ?? "Carregando itinerário..."}
                </p>

                {currentRouteData && (
                  <div className="mt-3 flex flex-wrap gap-2 text-[10px] font-semibold">
                    <span
                      className="rounded-full px-2 py-0.5"
                      style={{
                        backgroundColor: `${currentRouteData.route.color}15`,
                        color: currentRouteData.route.color
                      }}
                    >
                      {busVehicles.filter(v => positionQuality(v, now) === 'fresh').length} posição(ões) recente(s)
                    </span>
                    <span className="rounded-full bg-secondary/50 px-2 py-0.5 text-foreground">
                      {routeStops.length} paradas
                    </span>
                    {currentRouteData.route.price ? (
                      <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-emerald-600 dark:text-emerald-400">
                        Tarifa R$ {currentRouteData.route.price.toFixed(2)}
                      </span>
                    ) : null}
                  </div>
                )}
                <p className="mt-3 text-xs text-muted-foreground">{formatTimeAgo(busLastUpdate, now)} · consulta à fonte</p>
                {['mixed', 'stale', 'expired', 'unknown', 'unavailable'].includes(busDataQuality) && <p role="status" className="mt-2 text-xs text-amber-600">{dataLabels[busDataQuality]}. Posições antigas não confirmam a chegada do ônibus.</p>}
              </div>
            </div>

            {/* Direction toggle */}
            {currentRouteData && currentRouteData.directions.length > 0 && (
              <div className="rounded-xl border border-border bg-card p-3 shadow-sm">
                <h4 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
                  Sentido da Rota
                </h4>
                {currentRouteData.directions.length === 1 ? (
                  <div className="flex items-center gap-2 rounded-lg bg-muted/40 p-2 text-xs text-muted-foreground font-medium">
                    <TrendingUp className="h-4 w-4 text-emerald-500" />
                    <span>Sentido único (Circular)</span>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    {currentRouteData.directions.map((dir) => {
                      const isSelected = dir.directionId === currentDirectionId;
                      const color = currentRouteData.route.color ?? "#2563eb";
                      return (
                        <button
                          key={dir.directionId}
                          onClick={() => onChangeLineDirection(focusedLine, dir.directionId)}
                          className={cn(
                            "flex flex-col items-start gap-0.5 rounded-lg border p-2 text-left transition-all duration-200",
                            isSelected
                              ? "shadow-sm"
                              : "border-border bg-background hover:bg-muted/30"
                          )}
                          style={{
                            borderColor: isSelected ? color : undefined,
                            backgroundColor: isSelected ? `${color}08` : undefined,
                          }}
                        >
                          <div className="flex items-center gap-1.5">
                            <span
                              className="w-1.5 h-1.5 rounded-full"
                              style={{ backgroundColor: isSelected ? color : "#9ca3af" }}
                            />
                            <span
                              className="text-xs font-bold"
                              style={{ color: isSelected ? color : "#4b5563" }}
                            >
                              {dir.directionId === 0 ? "Ida" : "Volta"}
                            </span>
                          </div>
                          <span className="text-[9px] text-muted-foreground font-medium truncate w-full">
                            {dir.tripDetails.tripName || "Ver no mapa"}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {isBusLoading && (
              <div className="rounded-xl border border-border bg-card p-4 text-xs text-muted-foreground shadow-sm">
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  <span>Sincronizando paradas e GPS...</span>
                </div>
              </div>
            )}

            {busError && (
              <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-xs text-destructive shadow-sm">
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 mt-0.5" />
                  <span>{busError}</span>
                </div>
                <button type="button" onClick={onRetryBus} className="mt-2 min-h-11 rounded-lg border border-current px-3 font-semibold">Tentar novamente</button>
              </div>
            )}

            {currentRouteData && routeStops.length > 0 && <ArrivalPanel routeId={currentRouteData.route.routeId} stops={routeStops} selectedStopId={selectedStopId} onSelectStop={onSelectStop} />}

            {/* Vertical timeline itinerario */}
            {!isBusLoading && !busError && routeStops.length > 0 && (
              <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
                <div className="mb-3 flex items-center justify-between border-b border-border/50 pb-2">
                  <h4 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Itinerário</h4>
                  <span className="text-[10px] text-muted-foreground font-semibold">
                    {routeStops.length} paradas
                  </span>
                </div>
                <div className="relative pl-4 space-y-3 max-h-[220px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-muted">
                  {/* Timeline bar */}
                  <div
                    className="absolute left-[6px] top-1.5 bottom-1.5 w-[2px] rounded-full"
                    style={{
                      backgroundColor: currentRouteData?.route.color
                        ? `${currentRouteData.route.color}20`
                        : "rgba(37,99,235,0.15)"
                    }}
                  />
                  {routeStops.map((stop, index) => {
                    const isFirst = index === 0;
                    const isLast = index === routeStops.length - 1;
                    const color = currentRouteData?.route.color ?? "#2563eb";
                    return (
                      <div key={stop.stopId} className="relative flex items-start gap-2.5">
                        {/* Circle Bullet */}
                        <div
                          className="absolute -left-[14px] top-1.5 w-2 h-2 rounded-full border border-card bg-background z-10"
                          style={{
                            borderColor: isFirst || isLast ? color : `${color}40`,
                            backgroundColor: isFirst || isLast ? color : "#ffffff",
                            transform: isFirst || isLast ? "scale(1.2)" : "scale(1.0)",
                          }}
                        />
                        <button type="button" onClick={() => onSelectStop(stop.stopId)} className="flex-1 min-w-0 min-h-11 text-left" aria-label={`Ver chegadas em ${stop.name}`}>
                          <p className={cn(
                            "text-xs text-foreground truncate",
                            (isFirst || isLast) && "font-bold"
                          )}>
                            {stop.name}
                          </p>
                          <span className="text-[9px] text-muted-foreground font-medium">
                            Parada #{stop.stopId}
                          </span>
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Focused Station Details */}
        {focusedLine === null && selectedStationCode && (
          <div className="space-y-3">
            <div className="rounded-xl border border-border bg-card p-4 shadow-sm relative overflow-hidden">
              <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-cta" />
              <div className="pl-2">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Estação ativa</p>
                <h3 className="mt-0.5 text-lg font-bold text-foreground">
                  {selectedStation?.nome ?? selectedStationCode}
                </h3>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Linha {selectedStation?.linha ?? "indisponível"}
                </p>
                <p className="mt-3 text-[10px] text-muted-foreground font-semibold">{formatMetroOperation(metroStatus)}</p>
              </div>
            </div>

            {selectedStation && (
              <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
                <h4 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">Plataformas</h4>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(selectedStation.plataformas).map(
                    ([platform, sentido]) => (
                      <button
                        key={platform}
                        onClick={() => onSelectPlatform(platform)}
                        className={cn(
                          "rounded-lg border px-3 py-1.5 text-xs font-semibold transition-all duration-200",
                          selectedPlatform === platform
                            ? "border-cta bg-cta/10 text-cta shadow-sm"
                            : "border-border bg-background text-foreground hover:bg-muted/40"
                        )}
                      >
                        P{platform}: {sentido}
                      </button>
                    )
                  )}
                </div>
              </div>
            )}

            {isMetroLoading && (
              <div className="rounded-xl border border-border bg-card p-4 text-xs text-muted-foreground shadow-sm">
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin text-cta" />
                  <span>Sincronizando chegadas em tempo real...</span>
                </div>
              </div>
            )}

            {metroError && (
              <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-xs text-destructive shadow-sm">
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 mt-0.5" />
                  <span>{metroError}</span>
                </div>
              </div>
            )}

            {!isMetroLoading && !metroError && metroTrains && (
              <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
                <div className="mb-2.5 flex items-center justify-between border-b border-border/50 pb-2">
                  <h4 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Próximos Trens</h4>
                  <span className="text-[10px] text-emerald-500 font-semibold uppercase">
                    {metroTrains.status_operacional}
                  </span>
                </div>

                {metroTrains.trens.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-2 text-center">
                    Sem trens no momento para esta plataforma.
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {metroTrains.trens
                      .slice()
                      .sort(
                        (a, b) => a.chegada_em_minutos - b.chegada_em_minutos
                      )
                      .map((train) => (
                        <li
                          key={`${train.id_trem}-${train.chegada_em_minutos}`}
                          className="rounded-lg bg-background border border-border/40 px-3 py-2 shadow-sm"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-foreground truncate">
                                {train.destino_final}
                              </p>
                              <p className="text-[10px] text-muted-foreground font-medium truncate">
                                Trem #{train.id_trem} • {train.sentido}
                              </p>
                            </div>
                            <div className="flex items-center gap-1 text-xs font-bold text-cta whitespace-nowrap bg-cta/5 px-2 py-1 rounded-full border border-cta/15">
                              <Clock3 className="h-3.5 w-3.5" />
                              <span>{train.chegada_em_minutos} min</span>
                            </div>
                          </div>
                        </li>
                      ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
