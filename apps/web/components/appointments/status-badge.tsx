"use client";

import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import type { AppointmentDisplayStatus } from "@/lib/desk/appointments";

const TONES: Record<AppointmentDisplayStatus, "accent" | "orange" | "green" | "neutral" | "red"> = {
  confirmed: "accent",
  waiting: "orange",
  checked_in: "green",
  completed: "neutral",
  rescheduled: "neutral",
  cancelled: "red",
  no_show: "orange",
};

/** Statut d'un rendez-vous (pastille). */
export function AppointmentStatusBadge({ status, shape = "tag" }: { status: AppointmentDisplayStatus; shape?: "tag" | "pill" }) {
  const t = useTranslations("appointments.status");
  return (
    <Badge tone={TONES[status]} shape={shape}>
      {t(status)}
    </Badge>
  );
}
