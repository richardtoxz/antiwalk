"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Menu, Search, X, MapPin, Clock, ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import ThemeToggle from "./ThemeToggle";

interface SearchResult {
  id: string;
  title: string;
  subtitle: string;
  type: "location" | "line" | "station";
}

const mockResults: SearchResult[] = [
  {
    id: "1",
    title: "Rodoviária do Plano Piloto",
    subtitle: "Asa Norte, Brasília",
    type: "station",
  },
  {
    id: "2",
    title: "Estação Águas Claras",
    subtitle: "Metrô DF - Linha Verde",
    type: "station",
  },
  {
    id: "3",
    title: "Linha 0.116",
    subtitle: "W3 Norte / Eixo Monumental",
    type: "line",
  },
  {
    id: "4",
    title: "Praça dos Três Poderes",
    subtitle: "Zona Cívico-Administrativa",
    type: "location",
  },
];

interface SearchBarProps {
  onMenuClick?: () => void;
}

export default function SearchBar({ onMenuClick }: SearchBarProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleSearch = useCallback((searchQuery: string) => {
    setQuery(searchQuery);
    if (searchQuery.length > 0) {
      const filtered = mockResults.filter(
        (r) =>
          r.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          r.subtitle.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setResults(filtered);
    } else {
      setResults([]);
    }
  }, []);

  const handleExpand = useCallback(() => {
    setIsExpanded(true);
    setTimeout(() => inputRef.current?.focus(), 100);
  }, []);

  const handleCollapse = useCallback(() => {
    setIsExpanded(false);
    setQuery("");
    setResults([]);
    setIsFocused(false);
  }, []);

  const handleResultClick = useCallback((result: SearchResult) => {
    console.log("[v0] Selected result:", result);
    handleCollapse();
  }, [handleCollapse]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isExpanded) {
        handleCollapse();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isExpanded, handleCollapse]);

  // Handle click outside
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
      {/* Backdrop */}
      <div
        className={cn(
          "fixed inset-0 bg-foreground/20 backdrop-blur-sm z-20 transition-opacity duration-300",
          isExpanded ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
        aria-hidden="true"
      />

      {/* Search Container */}
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
            "bg-card/95 backdrop-blur-xl border border-border/50 transition-all duration-300 ease-out",
            isExpanded
              ? "rounded-none md:rounded-b-2xl shadow-2xl"
              : "rounded-2xl shadow-lg"
          )}
        >
          {/* Search Input Area */}
          <div
            className={cn(
              "flex items-center gap-2 px-3 transition-all duration-300",
              isExpanded ? "py-3 safe-top" : "py-2.5"
            )}
          >
            {/* Menu/Back Button */}
            <button
              onClick={isExpanded ? handleCollapse : onMenuClick}
              className={cn(
                "p-2.5 rounded-xl text-muted-foreground transition-all duration-200",
                "hover:bg-accent hover:text-foreground",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                "active:scale-95"
              )}
              aria-label={isExpanded ? "Fechar busca" : "Abrir menu"}
            >
              {isExpanded ? (
                <ArrowLeft className="w-5 h-5" />
              ) : (
                <Menu className="w-5 h-5" />
              )}
            </button>

            {/* Search Input */}
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
                aria-expanded={isExpanded && results.length > 0}
                aria-controls="search-results"
                role="combobox"
              />
            </div>

            {/* Search/Clear Button */}
            <button
              onClick={query ? () => handleSearch("") : handleExpand}
              className={cn(
                "p-2.5 rounded-xl transition-all duration-200",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                "active:scale-95",
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

            {/* Theme Toggle - only when not expanded */}
            {!isExpanded && <ThemeToggle />}
          </div>

          {/* Search Results */}
          <div
            id="search-results"
            role="listbox"
            className={cn(
              "overflow-hidden transition-all duration-300 ease-out",
              isExpanded && (results.length > 0 || isFocused)
                ? "max-h-[60vh] opacity-100"
                : "max-h-0 opacity-0"
            )}
          >
            <div className="border-t border-border/50">
              {results.length > 0 ? (
                <ul className="py-2 px-2">
                  {results.map((result, index) => (
                    <li key={result.id}>
                      <button
                        onClick={() => handleResultClick(result)}
                        className={cn(
                          "w-full flex items-center gap-3 p-3 rounded-xl text-left",
                          "hover:bg-accent transition-colors duration-150",
                          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
                          "active:scale-[0.99]"
                        )}
                        role="option"
                        aria-selected={false}
                        style={{
                          animationDelay: `${index * 50}ms`,
                        }}
                      >
                        <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-secondary flex items-center justify-center text-muted-foreground">
                          <MapPin className="w-5 h-5" />
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
                  <ul>
                    {mockResults.slice(0, 3).map((result) => (
                      <li key={result.id}>
                        <button
                          onClick={() => handleResultClick(result)}
                          className={cn(
                            "w-full flex items-center gap-3 p-3 rounded-xl text-left",
                            "hover:bg-accent transition-colors duration-150",
                            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
                          )}
                        >
                          <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-secondary flex items-center justify-center text-muted-foreground">
                            <Clock className="w-5 h-5" />
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
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
