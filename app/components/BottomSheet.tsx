"use client";

import {
  useRef,
  useEffect,
  useCallback,
  useState,
  type PointerEvent,
  type TouchEvent,
} from "react";
import { MapPin, Bus, TrainFront, ChevronDown, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

const SNAP_POINTS = {
  closed: 0,
  peek: 15,
  half: 50,
  full: 85,
} as const;

type SnapPoint = keyof typeof SNAP_POINTS;

interface RecentPlace {
  id: string;
  title: string;
  subtitle: string;
  icon: typeof MapPin;
  type: "bus" | "metro" | "location";
}

const recentPlaces: RecentPlace[] = [
  {
    id: "1",
    title: "Rodoviária do Plano Piloto",
    subtitle: "Asa Norte",
    icon: MapPin,
    type: "location",
  },
  {
    id: "2",
    title: "Estação Águas Claras",
    subtitle: "Metrô DF",
    icon: TrainFront,
    type: "metro",
  },
  {
    id: "3",
    title: "Linha 0.116",
    subtitle: "W3 Norte / Eixo Monumental",
    icon: Bus,
    type: "bus",
  },
  {
    id: "4",
    title: "Estação Central",
    subtitle: "Metrô DF - Asa Sul",
    icon: TrainFront,
    type: "metro",
  },
  {
    id: "5",
    title: "Terminal Asa Norte",
    subtitle: "Integração de ônibus",
    icon: Bus,
    type: "bus",
  },
];

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
    } else {
      if (currentHeight > SNAP_POINTS.half) return "half";
      if (currentHeight > SNAP_POINTS.peek) return "peek";
      return "closed";
    }
  }
  return getSnapPointFromHeight(currentHeight);
}

export default function BottomSheet() {
  const sheetRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
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

  useEffect(() => {
    const checkDesktop = () => setIsDesktop(window.innerWidth >= 768);
    checkDesktop();
    window.addEventListener("resize", checkDesktop);
    return () => window.removeEventListener("resize", checkDesktop);
  }, []);

  const animateToSnap = useCallback((snap: SnapPoint) => {
    const targetHeight = SNAP_POINTS[snap];
    setCurrentSnap(snap);

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
  const showFullContent = isDesktop || currentSnap !== "peek";

  return (
    <div
      ref={sheetRef}
      className={cn(
        "fixed z-10 bg-card/95 backdrop-blur-xl border-border/50 transition-shadow duration-300",
        "md:left-4 md:bottom-4 md:right-auto md:w-[380px] md:max-h-[calc(100dvh-6rem)]",
        "md:rounded-2xl md:border md:shadow-2xl",
        "left-0 right-0 bottom-0 rounded-t-3xl border-t shadow-[0_-8px_30px_rgba(0,0,0,0.12)]",
        isDragging ? "cursor-grabbing" : "",
        currentSnap === "full" && !isDesktop ? "shadow-[0_-16px_50px_rgba(0,0,0,0.2)]" : ""
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
      onKeyDown={handleKeyDown}
      role="dialog"
      aria-label="Painel de navegação"
      aria-modal={currentSnap === "full"}
      tabIndex={0}
    >
      <div
        data-drag-handle
        className={cn(
          "w-full flex flex-col items-center pt-3 pb-2 cursor-grab md:hidden",
          "touch-none select-none",
          isDragging && "cursor-grabbing"
        )}
        aria-label="Arraste para expandir ou recolher"
        role="slider"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(heightPercent)}
      >
        <div
          className={cn(
            "w-10 h-1 bg-muted-foreground/30 rounded-full transition-all duration-200",
            isDragging && "w-12 bg-muted-foreground/50"
          )}
        />
        <button
          onClick={() =>
            animateToSnap(currentSnap === "peek" ? "half" : "peek")
          }
          className={cn(
            "mt-2 p-1 rounded-full transition-transform duration-300",
            currentSnap !== "peek" && "rotate-180"
          )}
          aria-label={currentSnap === "peek" ? "Expandir" : "Recolher"}
        >
          <ChevronDown className="w-5 h-5 text-muted-foreground" />
        </button>
      </div>

      <div
        ref={contentRef}
        className={cn(
          "px-4 pb-safe-bottom md:p-5 overflow-y-auto overflow-x-hidden",
          "scrollbar-thin scrollbar-thumb-muted scrollbar-track-transparent",
          isDesktop ? "max-h-[calc(100dvh-8rem)]" : "h-full"
        )}
        style={{
          maxHeight: isDesktop ? undefined : `calc(${heightPercent}dvh - 60px)`,
        }}
      >
        <div className="grid grid-cols-2 gap-3 mb-5">
          <button
            className={cn(
              "group flex items-center justify-center gap-2.5 py-3.5 px-4 rounded-xl",
              "bg-primary text-primary-foreground font-medium",
              "transition-colors duration-200 ease-out",
              "hover:bg-primary/90",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card"
            )}
          >
            <Bus className="w-5 h-5" />
            <span>Ônibus</span>
          </button>
          <button
            className={cn(
              "group flex items-center justify-center gap-2.5 py-3.5 px-4 rounded-xl",
              "bg-cta text-cta-foreground font-medium",
              "transition-colors duration-200 ease-out",
              "hover:bg-cta/90",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cta/80 focus-visible:ring-offset-2 focus-visible:ring-offset-card"
            )}
          >
            <TrainFront className="w-5 h-5" />
            <span>Metrô</span>
          </button>
        </div>

        <div
          className={cn(
            "mb-5 p-4 rounded-xl bg-primary/5 border border-primary/20",
            "transition-all duration-300",
            showFullContent
              ? "opacity-100 translate-y-0"
              : "opacity-0 -translate-y-2 h-0 mb-0 p-0 overflow-hidden"
          )}
        >
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-primary flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <p className="font-semibold text-foreground text-sm">
                Sugestão inteligente
              </p>
              <p className="text-sm text-muted-foreground mt-0.5">
                Com base no horário, a Linha 0.116 está com tempo estimado de 8
                min.
              </p>
            </div>
          </div>
        </div>

        <div
          className={cn(
            "transition-all duration-300",
            showFullContent
              ? "opacity-100 translate-y-0"
              : "opacity-100 translate-y-0"
          )}
        >
          <div className="flex items-center justify-between mb-3 px-1">
            <h3 className="text-foreground font-semibold">Buscas Recentes</h3>
            <button className="text-sm text-primary font-medium hover:text-primary/80 transition-colors focus-visible:outline-none focus-visible:underline">
              Ver tudo
            </button>
          </div>

          <div className="flex flex-col gap-1">
            {recentPlaces
              .slice(0, showFullContent ? recentPlaces.length : 3)
              .map((place, index) => (
                <button
                  key={place.id}
                  className={cn(
                    "group flex items-start gap-3 p-3 rounded-lg text-left",
                    "hover:bg-accent transition-colors duration-150",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
                  )}
                  style={{
                    animationDelay: `${index * 50}ms`,
                  }}
                >
                  <div
                    className={cn(
                      "flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center transition-colors",
                      place.type === "bus" &&
                      "bg-primary/10 text-primary dark:bg-primary/20",
                      place.type === "metro" &&
                      "bg-cta/10 text-cta dark:bg-cta/20",
                      place.type === "location" &&
                      "bg-secondary text-muted-foreground"
                    )}
                  >
                    <place.icon className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-foreground font-medium truncate group-hover:text-primary transition-colors">
                      {place.title}
                    </p>
                    <p className="text-sm text-muted-foreground truncate">
                      {place.subtitle}
                    </p>
                  </div>
                </button>
              ))}
          </div>
        </div>
      </div>
    </div>
  );
}
