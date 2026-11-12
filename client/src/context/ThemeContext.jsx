import {
  createContext,
  useContext,
  useLayoutEffect,
  useState,
  useSyncExternalStore,
} from "react";

import {
  readThemePreference,
  resolveTheme,
  saveThemeChoice,
  toggledTheme,
} from "./themePreference";

const ThemeContext = createContext();

const DARK_QUERY = "(prefers-color-scheme: dark)";

function systemTheme() {
  return window.matchMedia(DARK_QUERY).matches ? "dark" : "light";
}

function subscribeSystemTheme(onChange) {
  const query = window.matchMedia(DARK_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

// Reading the property itself throws when the browser blocks storage.
function themeStorage() {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function ThemeProvider({ children }) {
  const system = useSyncExternalStore(
    subscribeSystemTheme,
    systemTheme,
    () => "light",
  );
  // "system" until the reader picks a theme with the toggle.
  const [preference, setPreference] = useState(() =>
    readThemePreference(themeStorage(), systemTheme()),
  );
  const theme = resolveTheme(preference, system);

  // A layout effect, so a toggle inside the theme transition lands before its new snapshot.
  useLayoutEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute("content", theme === "dark" ? "#111113" : "#fafafc");
  }, [theme]);

  // Only a pick is saved; following the system leaves storage alone.
  useLayoutEffect(() => {
    if (preference !== "system") saveThemeChoice(themeStorage(), preference);
  }, [preference]);

  // Read from the latest state: a queued theme transition may run an older click's toggle.
  const toggleTheme = () =>
    setPreference((current) => toggledTheme(current, systemTheme()));

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
