"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";

type Theme = "light" | "dark" | "system";
type ResolvedTheme = "light" | "dark";

interface ThemeContextType {
  theme: Theme;
  resolvedTheme: ResolvedTheme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const STORAGE_KEY = "transporte-df-theme";
const THEME_EVENT = "transporte-df-theme";
const DARK_QUERY = "(prefers-color-scheme: dark)";

function readTheme(): Theme {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === "light" || stored === "dark" ? stored : "system";
  } catch {
    return "system";
  }
}

function subscribeTheme(notify: () => void) {
  window.addEventListener(THEME_EVENT, notify);
  window.addEventListener("storage", notify);
  return () => {
    window.removeEventListener(THEME_EVENT, notify);
    window.removeEventListener("storage", notify);
  };
}

function subscribeSystem(notify: () => void) {
  const query = window.matchMedia(DARK_QUERY);
  query.addEventListener("change", notify);
  return () => query.removeEventListener("change", notify);
}

const readSystemDark = () => window.matchMedia(DARK_QUERY).matches;

export function ThemeProvider({ children }: { children: ReactNode }) {
  // Both values live outside React; the server renders with the defaults.
  const theme = useSyncExternalStore(subscribeTheme, readTheme, (): Theme => "system");
  const systemDark = useSyncExternalStore(subscribeSystem, readSystemDark, () => false);
  const resolvedTheme: ResolvedTheme = theme === "system" ? (systemDark ? "dark" : "light") : theme;

  // The inline script in the layout sets the class before paint; this keeps it current.
  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove("light", "dark");
    root.classList.add(resolvedTheme);
  }, [resolvedTheme]);

  const setTheme = useCallback((next: Theme) => {
    try {
      if (next === "system") localStorage.removeItem(STORAGE_KEY);
      else localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Without storage the choice cannot persist; the event still updates this page.
    }
    window.dispatchEvent(new Event(THEME_EVENT));
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(resolvedTheme === "dark" ? "light" : "dark");
  }, [resolvedTheme, setTheme]);

  const value = useMemo(() => ({ theme, resolvedTheme, setTheme, toggleTheme }), [theme, resolvedTheme, setTheme, toggleTheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
