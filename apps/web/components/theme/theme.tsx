"use client";

import { useCallback, useSyncExternalStore } from "react";

export type ThemePreference = "auto" | "light" | "dark";
export { THEME_STORAGE_KEY } from "./theme-init";
import { THEME_STORAGE_KEY } from "./theme-init";

function readPreference(): ThemePreference {
  const v = document.documentElement.dataset.themePreference;
  return v === "light" || v === "dark" ? v : "auto";
}

const listeners = new Set<() => void>();

function apply(pref: ThemePreference) {
  const dark = pref === "dark" || (pref === "auto" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.dataset.theme = dark ? "dark" : "light";
  document.documentElement.dataset.themePreference = pref;
  try {
    localStorage.setItem(THEME_STORAGE_KEY, pref);
  } catch {
    // Stockage indisponible (navigation privée) : le choix vaut pour la session.
  }
  listeners.forEach((l) => l());
}

export function useThemePreference(): [ThemePreference, (pref: ThemePreference) => void] {
  const pref = useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    readPreference,
    () => "auto" as ThemePreference,
  );
  const set = useCallback((p: ThemePreference) => apply(p), []);
  return [pref, set];
}
