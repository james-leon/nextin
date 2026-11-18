import { Building2, Hospital, Landmark, RadioTower, Shapes, Stethoscope, Zap } from "lucide-react";
import type { Database } from "@nextin/shared/database";

type OrgType = Database["public"]["Enums"]["org_type"];

const ICONS = {
  clinic: Stethoscope,
  hospital: Hospital,
  telecom: RadioTower,
  bank: Landmark,
  utility: Zap,
  administration: Building2,
  other: Shapes,
} satisfies Record<OrgType, unknown>;

/**
 * Couleur du carré d'icône par secteur (listes groupées v2, façon Réglages iOS) : palette fixe comme
 * `SERVICE_COLORS`, l'icône est décorative (le nom de l'établissement est écrit à côté).
 */
export const SECTOR_COLORS: Record<OrgType, string> = {
  clinic: "#1A6BB5",
  hospital: "#1A6BB5",
  bank: "#0E7A44",
  utility: "#C98A0C",
  telecom: "#7A4FD6",
  administration: "#5856D6",
  other: "#8E8E93",
};

export function sectorColor(type: string): string {
  return SECTOR_COLORS[type as OrgType] ?? SECTOR_COLORS.other;
}

/** Icône du secteur d'un établissement (trait fin façon SF Symbols), décorative : le libellé est donné à côté. */
export function OrgTypeIcon({ type }: { type: OrgType | string }) {
  const Icon = ICONS[type as OrgType] ?? Shapes;
  return <Icon aria-hidden />;
}
