import { useSyncExternalStore } from "react";

/**
 * Notifications du personnel propres à l'appareil (maquette v2 07, « Notifications ») : réglage gardé dans le
 * navigateur, lu par l'écran de l'accueil. Activé par défaut ; une lecture impossible (navigation privée) vaut « activé ».
 */
export type StaffAlert = "help";

const KEY = (alert: StaffAlert) => `nextin_alert_${alert}`;
const listeners = new Set<() => void>();

export function alertEnabled(alert: StaffAlert): boolean {
  try {
    return window.localStorage.getItem(KEY(alert)) !== "off";
  } catch {
    return true;
  }
}

export function setAlertEnabled(alert: StaffAlert, on: boolean) {
  try {
    window.localStorage.setItem(KEY(alert), on ? "on" : "off");
  } catch {
    // Stockage indisponible : le réglage vaut pour la page ouverte seulement.
  }
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

export function useAlertEnabled(alert: StaffAlert): boolean {
  return useSyncExternalStore(subscribe, () => alertEnabled(alert), () => true);
}
