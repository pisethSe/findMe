"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { LandingLocale } from "../landing/landing-icons";

type Theme = "light" | "dark";
const Preferences = createContext({
  locale: "en" as LandingLocale,
  theme: "light" as Theme,
  setLocale: (_locale: LandingLocale) => {},
  setTheme: (_theme: Theme) => {},
});

export function SitePreferences({ children }: { children: ReactNode }) {
  const [locale, setLocale] = useState<LandingLocale>("en");
  const [theme, setTheme] = useState<Theme>("light");
  const [ready, setReady] = useState(false);
  useEffect(() => {
    try {
      const language = localStorage.getItem("rentme-locale");
      const appearance = localStorage.getItem("rentme-appearance-v2");
      if (language === "en" || language === "km") setLocale(language);
      if (appearance === "light" || appearance === "dark") setTheme(appearance);
    } catch {
      // Storage can be disabled. Preferences still work for the current visit.
    }
    setReady(true);
  }, []);
  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dataset.appearance = theme;
    if (!ready) return;
    try {
      localStorage.setItem("rentme-locale", locale);
      localStorage.setItem("rentme-appearance-v2", theme);
    } catch {
      // In-memory preferences remain available when storage is blocked.
    }
  }, [locale, theme, ready]);
  return (
    <Preferences.Provider value={{ locale, theme, setLocale, setTheme }}>
      {children}
    </Preferences.Provider>
  );
}

export const useSitePreferences = () => useContext(Preferences);
