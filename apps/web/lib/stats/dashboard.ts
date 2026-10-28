import type { StatsPeriod } from "@nextin/shared/stats";

/** Indicateurs d'une période (`stats_totals`). Durées en secondes, taux en %. */
export type StatsTotals = {
  issued: number;
  served: number;
  no_show: number;
  cancelled: number;
  remote: number;
  wait_avg_seconds: number | null;
  max_wait_seconds: number | null;
  service_avg_seconds: number | null;
  abandon_rate: number | null;
  rating_avg: number | null;
  rating_count: number;
};

/** Réponse de `dashboard_stats` : aucune donnée personnelle. */
export type DashboardData = {
  totals: StatsTotals;
  previous: StatsTotals | null;
  hourly: number[];
  daily: { day: string; issued: number; wait_avg_seconds: number | null }[];
  services: {
    id: string;
    name: string;
    name_en: string | null;
    prefix: string;
    color: string;
    branch: string;
    issued: number;
    served: number;
    wait_avg_seconds: number | null;
    service_avg_seconds: number | null;
    abandon_rate: number | null;
    rating_avg: number | null;
  }[];
  counters: {
    id: string;
    kind: string;
    number: number;
    label: string | null;
    branch: string;
    status: "open" | "paused" | "closed";
    practitioner: string | null;
    called: number;
    served: number;
    no_show: number;
    service_avg_seconds: number | null;
    rating_avg: number | null;
    open_seconds: number;
    pause_seconds: number;
  }[];
  practitioners: {
    id: string;
    name: string;
    branch: string;
    appointments: number;
    appointment_no_show: number;
    absences: number;
    late: number;
    served: number;
    service_avg_seconds: number | null;
    rating_avg: number | null;
  }[];
  appointments: { booked: number; completed: number; checked_in: number; no_show: number; cancelled: number; upcoming: number };
  live: {
    branch: string;
    id: string;
    name: string;
    name_en: string | null;
    color: string;
    prefix: string;
    open: boolean;
    waiting: number;
    wait_seconds: number;
  }[];
};

export type DashboardQuery = { branchId: string | null; period: StatsPeriod; anchor: string };
