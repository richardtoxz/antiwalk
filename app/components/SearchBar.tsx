"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import {
  ArrowLeft,
  Bus,
  Clock,
  Menu,
  Search,
  TrainFront,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { MetroStationsResponse, SearchSelection } from "@/lib/transport/types";
import ThemeToggle from "./ThemeToggle";

const RECENTS_STORAGE_KEY = "transporte-df-recent-searches";
const MAX_RESULTS = 20;
const MAX_RECENTS = 6;

function isSearchSelection(value: unknown): value is SearchSelection {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<SearchSelection>;
  if (
    typeof candidate.id !== "string" ||
    typeof candidate.title !== "string" ||
    typeof candidate.subtitle !== "string"
  ) {
    return false;
  }

  if (candidate.type === "line") {
    return typeof candidate.shortName === "string";
  }

  if (candidate.type === "station") {
    return typeof candidate.stationCode === "string";
  }

  return false;
}

function loadRecentSearches(): SearchSelection[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const raw = localStorage.getItem(RECENTS_STORAGE_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter(isSearchSelection).slice(0, MAX_RECENTS);
  } catch {
    return [];
  }
}

function persistRecentSearches(items: SearchSelection[]): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    localStorage.setItem(RECENTS_STORAGE_KEY, JSON.stringify(items.slice(0, MAX_RECENTS)));
  } catch {
    // Ignore storage failures and keep search functional.
  }
}

function pushRecentSearch(
  items: SearchSelection[],
  selected: SearchSelection
): SearchSelection[] {
  const withoutDuplicate = items.filter((item) => item.id !== selected.id);
  return [selected, ...withoutDuplicate].slice(0, MAX_RECENTS);
}

interface SearchBarProps {
  lines: string[];
  stations?: MetroStationsResponse;
  isLoading?: boolean;
  onSelectResult: (result: SearchSelection) => void;
  onMenuClick?: () => void;
  selectedLines?: string[];
  onRemoveLine?: (line: string) => void;
}

export default function SearchBar({
  lines,
  stations,
  isLoading = false,
  onSelectResult,
  onMenuClick,
  selectedLines = [],
  onRemoveLine,
}: SearchBarProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [query, setQuery] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const [recentSearches, setRecentSearches] = useState<SearchSelection[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setRecentSearches(loadRecentSearches());
  }, []);

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

      setRecentSearches((current) => {
        const next = pushRecentSearch(current, result);
        persistRecentSearches(next);
        return next;
      });

      handleCollapse();
    },
    [handleCollapse, onSelectResult]
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
          "fixed inset-0 bg-foreground/20 backdrop-blur-sm z-20 transition-opacity duration-300",
          isExpanded ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
        aria-hidden="true"
      />

      <div
        ref={containerRef}
        className={cn(
          "fixed z-30 transition-all duration-300 ease-out",
          isExpanded
            ? "inset-x-0 top-0 mx-0"
            : "top-4 left-1/2 -translate-x-1/2 w-[calc(100%-2rem)] max-w-md"
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
              onClick={isExpanded ? handleCollapse : onMenuClick}
              className={cn(
                "p-2.5 rounded-lg text-muted-foreground transition-all duration-200",
                "hover:bg-accent hover:text-foreground",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              )}
              aria-label={isExpanded ? "Fechar busca" : "Abrir menu"}
            >
              {isExpanded ? (
                <ArrowLeft className="w-5 h-5" />
              ) : (
                <Menu className="w-5 h-5" />
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
                placeholder="Buscar linha ou estação..."
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
              onClick={query ? () => handleSearch("") : handleExpand}
              className={cn(
                "p-2.5 rounded-lg transition-all duration-200",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                query
                  ? "text-muted-foreground hover:text-foreground hover:bg-accent"
                  : "text-primary bg-primary/10 hover:bg-primary/20"
              )}
              aria-label={query ? "Limpar busca" : "Buscar"}
            >
              {query ? (
                <X className="w-5 h-5" />
              ) : (
                <Search className="w-5 h-5" />
              )}
            </button>

            {!isExpanded && <ThemeToggle />}
          </div>

          {selectedLines && selectedLines.length > 0 && (
            <div className="flex items-center gap-1.5 px-4 pb-3 overflow-x-auto scrollbar-none border-t border-border/10 pt-2.5">
              {selectedLines.map((line) => (
                <div
                  key={line}
                  className="flex items-center gap-1.5 bg-primary/10 border border-primary/20 text-primary text-xs font-semibold px-2.5 py-1 rounded-full whitespace-nowrap"
                >
                  <span>Linha {line}</span>
                  <button
                    onClick={() => onRemoveLine?.(line)}
                    className="hover:bg-primary/20 rounded-full p-0.5 transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div
            id="search-results"
            role="listbox"
            className={cn(
              "overflow-hidden transition-all duration-300 ease-out",
              isExpanded && (filteredResults.length > 0 || isFocused)
                ? "max-h-[60vh] opacity-100"
                : "max-h-0 opacity-0"
            )}
          >
            <div className="border-t border-border/50">
              {query.length > 0 && isLoading ? (
                <div className="py-8 px-4 text-center">
                  <p className="text-muted-foreground">Carregando dados...</p>
                </div>
              ) : filteredResults.length > 0 ? (
                <ul className="py-2 px-2">
                  {filteredResults.map((result, index) => (
                    <li key={result.id}>
                      <button
                        onClick={() => handleResultClick(result)}
                        className={cn(
                          "w-full flex items-center gap-3 p-3 rounded-lg text-left",
                          "hover:bg-accent transition-colors duration-150",
                          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
                        )}
                        role="option"
                        aria-selected={false}
                        style={{
                          animationDelay: `${index * 50}ms`,
                        }}
                      >
                        <div
                          className={cn(
                            "flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center",
                            result.type === "line"
                              ? "bg-primary/10 text-primary"
                              : "bg-cta/10 text-cta"
                          )}
                        >
                          {result.type === "line" ? (
                            <Bus className="w-5 h-5" />
                          ) : (
                            <TrainFront className="w-5 h-5" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-foreground truncate">
                            {result.title}
                          </p>
                          <p className="text-sm text-muted-foreground truncate">
                            {result.subtitle}
                          </p>
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : query.length > 0 ? (
                <div className="py-8 px-4 text-center">
                  <p className="text-muted-foreground">
                    Nenhum resultado encontrado
                  </p>
                </div>
              ) : (
                <div className="py-4 px-4">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3 px-1">
                    Buscas recentes
                  </p>
                  {recentSearches.length === 0 ? (
                    <p className="px-3 pb-2 text-sm text-muted-foreground">
                      Nenhuma busca recente ainda.
                    </p>
                  ) : (
                    <ul>
                      {recentSearches.map((result) => (
                      <li key={result.id}>
                        <button
                          onClick={() => handleResultClick(result)}
                          className={cn(
                            "w-full flex items-center gap-3 p-3 rounded-lg text-left",
                            "hover:bg-accent transition-colors duration-150",
                            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
                          )}
                        >
                          <div
                            className={cn(
                              "flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center",
                              result.type === "line"
                                ? "bg-primary/10 text-primary"
                                : "bg-cta/10 text-cta"
                            )}
                          >
                            {result.type === "line" ? (
                              <Bus className="w-5 h-5" />
                            ) : (
                              <Clock className="w-5 h-5" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-foreground truncate">
                              {result.title}
                            </p>
                            <p className="text-sm text-muted-foreground truncate">
                              {result.subtitle}
                            </p>
                          </div>
                        </button>
                      </li>
                    ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
