"use client";

import { useSyncExternalStore } from "react";

/** Mode compact du poste : préférence de l'appareil (localStorage), partagée entre les onglets. */
const KEY = "nextin.desk.compact";
const listeners = new Set<() => void>();
// Repli si le stockage est indisponible (navigation privée) : le mode vaut alors pour cette page seulement.
let memory = false;

function read(): boolean {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return memory;
  }
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  const onStorage = (e: StorageEvent) => e.key === KEY && cb();
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", onStorage);
  };
}

export function setDeskCompact(on: boolean) {
  memory = on;
  try {
    if (on) localStorage.setItem(KEY, "1");
    else localStorage.removeItem(KEY);
  } catch {
    // Stockage indisponible : repli en mémoire.
  }
  listeners.forEach((l) => l());
}

export function useDeskCompact(): boolean {
  return useSyncExternalStore(subscribe, read, () => false);
}
