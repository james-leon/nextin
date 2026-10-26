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

export function OrgTypeIcon({ type }: { type: OrgType }) {
  const Icon = ICONS[type];
  return <Icon aria-hidden />;
}
