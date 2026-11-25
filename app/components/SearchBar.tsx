"use client";

import { useState, useRef, useEffect, useCallback, useMemo, useSyncExternalStore, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  Bus,
  MapPin,
  Route,
  Search,
  TrainFront,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { MetroStationsResponse, SearchSelection } from "@/lib/transport/types";
import { getPlaces, placeKindLabel, type Place } from "@/lib/transport/journeys";
import { recentsStore, rememberSearch } from "@/lib/navigation/selection-store";
import ThemeToggle from "./ThemeToggle";

function ResultRow({ icon, title, subtitle, trailing, onClick }: {
  icon: ReactNode; title: string; subtitle: string; trailing?: string; onClick: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className="flex min-h-12 w-full items-center gap-3 rounded-lg px-2 text-left hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted text-foreground">{icon}</span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">{title}</span>
          <span className="block truncate text-xs text-muted-foreground">{subtitle}</span>
        </span>
        {trailing && <span className="shrink-0 rounded-full border border-border px-2.5 py-1 text-xs font-semibold">{trailing}</span>}
      </button>
    </li>
  );
}

const MAX_RESULTS = 20;

interface SearchBarProps {
  lines: string[];
  stations?: MetroStationsResponse;
  isLoading?: boolean;
  onSelectResult: (result: SearchSelection) => void;
  onPlanRoute?: () => void;
  onGoTo?: (place: Place) => void;
}

export default function SearchBar({
  lines,
  stations,
  isLoading = false,
  onSelectResult,
  onPlanRoute,
  onGoTo,
}: SearchBarProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [query, setQuery] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const recentSearches = useSyncExternalStore(recentsStore.subscribe, recentsStore.read, recentsStore.readOnServer);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const searchableItems = useMemo<SearchSelection[]>(() => {
    const stationItems: SearchSelection[] = Object.entries(stations ?? {}).map(
      ([stationCode, station]) => ({
        id: `station-${stationCode}`,
        type: "station",
        title: station.nome,
        subtitle: `Metrô DF - Linha ${station.linha}`,
        stationCode,
      })
    );

    const lineItems: SearchSelection[] = lines.map((line) => ({
      id: `line-${line}`,
      type: "line",
      title: `Linha ${line}`,
      subtitle: "Ônibus DF",
      shortName: line,
    }));

    return [...stationItems, ...lineItems];
  }, [lines, stations]);

  const filteredResults = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) {
      return [];
    }

    return searchableItems
      .filter(
        (item) =>
          item.title.toLowerCase().includes(normalizedQuery) ||
          item.subtitle.toLowerCase().includes(normalizedQuery)
      )
      .slice(0, MAX_RESULTS);
  }, [query, searchableItems]);

  const handleExpand = useCallback(() => {
    setIsExpanded(true);
    setTimeout(() => inputRef.current?.focus(), 100);
  }, []);

  const handleCollapse = useCallback(() => {
    setIsExpanded(false);
    setQuery("");
    setIsFocused(false);
  }, []);

  const handleResultClick = useCallback(
    (result: SearchSelection) => {
      onSelectResult(result);

      rememberSearch(result);

      handleCollapse();
    },
    [handleCollapse, onSelectResult]
  );

  const trimmedQuery = query.trim();
  const lineResults = filteredResults.filter((item) => item.type === "line").slice(0, 6);
  const stationResults = filteredResults.filter((item) => item.type === "station").slice(0, 4);

  // Places come from the server and cost quota, so wait for typing to settle.
  const [placeTerm, setPlaceTerm] = useState("");
  useEffect(() => {
    const timer = window.setTimeout(() => setPlaceTerm(trimmedQuery), 500);
    return () => window.clearTimeout(timer);
  }, [trimmedQuery]);
  const placesQuery = useQuery({
    queryKey: ["journey", "places", placeTerm],
    queryFn: ({ signal }) => getPlaces(placeTerm, signal),
    enabled: isExpanded && placeTerm.length >= 3 && placeTerm.length <= 100,
    staleTime: 300000,
    retry: false,
    refetchOnWindowFocus: false,
  });
  const placesPending = placeTerm !== trimmedQuery || placesQuery.isFetching;
  // Keep room for addresses: the server lists stops first and they would fill the list.
  const allPlaces = placesQuery.data?.places ?? [];
  const places = [
    ...allPlaces.filter((place) => place.kind !== "address").slice(0, 4),
    ...allPlaces.filter((place) => place.kind === "address").slice(0, 3),
  ];

  const handleGoTo = useCallback(
    (place: Place) => {
      onGoTo?.(place);
      handleCollapse();
    },
    [handleCollapse, onGoTo]
  );

  const handleSearch = useCallback((searchQuery: string) => {
    setQuery(searchQuery);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isExpanded) {
        handleCollapse();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isExpanded, handleCollapse]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node) &&
        isExpanded
      ) {
        handleCollapse();
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isExpanded, handleCollapse]);

  return (
    <>
      <div
        className={cn(
          "fixed inset-0 bg-foreground/20 backdrop-blur-sm z-20 transition-opacity duration-300 md:hidden",
          isExpanded ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
        aria-hidden="true"
      />

      <div
        ref={containerRef}
        className={cn(
          "fixed z-30 transition-all duration-300 ease-out",
          isExpanded
            ? "inset-x-0 top-0 mx-0 md:inset-x-auto md:left-4 md:top-4 md:w-[380px]"
            : "top-[max(1rem,env(safe-area-inset-top))] left-1/2 -translate-x-1/2 w-[calc(100%-2rem)] max-w-md md:left-4 md:translate-x-0 md:w-[380px] md:max-w-none"
        )}
      >
        <div
          className={cn(
            "bg-card/95 backdrop-blur-xl border border-border/50 transition-all duration-200 ease-out",
            isExpanded
              ? "rounded-none md:rounded-b-xl shadow-md"
              : "rounded-xl shadow-md"
          )}
        >
          <div
            className={cn(
              "flex items-center gap-2 px-3 transition-all duration-300",
              isExpanded ? "py-3 safe-top" : "py-2.5"
            )}
          >
            <button
              onClick={isExpanded ? handleCollapse : handleExpand}
              className={cn(
                "p-2.5 rounded-lg text-muted-foreground transition-all duration-200",
                "hover:bg-accent hover:text-foreground",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              )}
              aria-label={isExpanded ? "Fechar busca" : "Buscar"}
            >
              {isExpanded ? (
                <ArrowLeft className="w-5 h-5" />
              ) : (
                <Search className="w-5 h-5" />
              )}
            </button>

            <div className="flex-1 relative">
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => handleSearch(e.target.value)}
                onFocus={() => {
                  setIsFocused(true);
                  if (!isExpanded) handleExpand();
                }}
                placeholder="Para onde?"
                className={cn(
                  "w-full bg-transparent py-2 px-1 text-foreground placeholder:text-muted-foreground",
                  "outline-none font-medium text-base",
                  "transition-all duration-200"
                )}
                aria-label="Campo de busca"
                aria-expanded={isExpanded && filteredResults.length > 0}
                aria-controls="search-results"
                role="combobox"
              />
            </div>

            <button
              onClick={query ? () => handleSearch("") : onPlanRoute}
              className={cn(
                "p-2.5 rounded-lg transition-all duration-200",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                query
                  ? "text-muted-foreground hover:text-foreground hover:bg-accent"
                  : "bg-primary text-primary-foreground hover:opacity-90"
              )}
              aria-label={query ? "Limpar busca" : "Traçar rota"}
            >
              {query ? (
                <X className="w-5 h-5" />
              ) : (
                <Route className="w-5 h-5" />
              )}
            </button>

            {!isExpanded && <ThemeToggle />}
          </div>

          <div
            id="search-results"
            role="listbox"
            className={cn(
              "overflow-hidden transition-all duration-300 ease-out",
              isExpanded && (trimmedQuery.length > 0 || isFocused)
                ? "max-h-[60vh] opacity-100"
                : "max-h-0 opacity-0"
            )}
          >
            <div className="max-h-[60vh] overflow-y-auto border-t border-border px-2 py-2">
              {trimmedQuery.length === 0 ? (
                <section aria-label="Buscas recentes">
                  <h3 className="px-2 pb-1 pt-1 text-xs font-medium text-muted-foreground">Recentes</h3>
                  {recentSearches.length === 0 ? (
                    <p className="px-2 pb-2 text-sm text-muted-foreground">
                      Busque uma linha, uma estação ou um lugar para onde você quer ir.
                    </p>
                  ) : (
                    <ul>
                      {recentSearches.map((result) => (
                        <ResultRow
                          key={result.id}
                          icon={result.type === "line" ? <Bus className="h-4 w-4" aria-hidden /> : <TrainFront className="h-4 w-4" aria-hidden />}
                          title={result.title}
                          subtitle={result.subtitle}
                          onClick={() => handleResultClick(result)}
                        />
                      ))}
                    </ul>
                  )}
                </section>
              ) : (
                <>
                  {isLoading && <p className="px-2 py-2 text-sm text-muted-foreground">Carregando linhas e estações…</p>}

                  {lineResults.length > 0 && (
                    <section aria-label="Linhas">
                      <h3 className="px-2 pb-1 pt-1 text-xs font-medium text-muted-foreground">Linhas</h3>
                      <ul>
                        {lineResults.map((result) => (
                          <ResultRow
                            key={result.id}
                            icon={<Bus className="h-4 w-4" aria-hidden />}
                            title={result.title}
                            subtitle={result.subtitle}
                            onClick={() => handleResultClick(result)}
                          />
                        ))}
                      </ul>
                    </section>
                  )}

                  {stationResults.length > 0 && (
                    <section aria-label="Estações do metrô">
                      <h3 className="px-2 pb-1 pt-2 text-xs font-medium text-muted-foreground">Estações do metrô</h3>
                      <ul>
                        {stationResults.map((result) => (
                          <ResultRow
                            key={result.id}
                            icon={<TrainFront className="h-4 w-4" aria-hidden />}
                            title={result.title}
                            subtitle={result.subtitle}
                            onClick={() => handleResultClick(result)}
                          />
                        ))}
                      </ul>
                    </section>
                  )}

                  {placeTerm.length >= 3 && (
                    <section aria-label="Lugares e paradas">
                      <h3 className="px-2 pb-1 pt-2 text-xs font-medium text-muted-foreground">Lugares e paradas</h3>
                      {placesPending && <p role="status" className="px-2 py-2 text-sm text-muted-foreground">Buscando lugares…</p>}
                      {!placesPending && placesQuery.error && (
                        <p role="status" className="px-2 py-2 text-sm text-muted-foreground">A busca de lugares está indisponível agora.</p>
                      )}
                      {!placesPending && places.length > 0 && (
                        <ul>
                          {places.map((place, index) => (
                            <ResultRow
                              key={place.id ?? `${place.lat}:${place.lng}:${index}`}
                              icon={place.kind === "metro" ? <TrainFront className="h-4 w-4" aria-hidden /> : <MapPin className="h-4 w-4" aria-hidden />}
                              title={place.name}
                              subtitle={placeKindLabel(place)}
                              trailing="Ir"
                              onClick={() => handleGoTo(place)}
                            />
                          ))}
                        </ul>
                      )}
                      {!placesPending && !placesQuery.error && places.length === 0 && (
                        <p className="px-2 py-2 text-sm text-muted-foreground">Nenhum lugar encontrado com esse nome.</p>
                      )}
                    </section>
                  )}

                  {!isLoading && lineResults.length === 0 && stationResults.length === 0 && placeTerm.length < 3 && (
                    <p className="px-2 py-2 text-sm text-muted-foreground">
                      Nenhuma linha ou estação com esse nome. Digite pelo menos três letras para buscar lugares.
                    </p>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
